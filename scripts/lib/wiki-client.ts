import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * A deliberately slow, cached client for the OSRS Wiki API.
 *
 * The wiki asks tools to identify themselves, avoid parallel requests and cache
 * what they fetch. So every request here goes out one at a time, at least
 * `minIntervalMs` apart, with a descriptive User-Agent, and every successful
 * response is cached on disk: a re-run with a warm cache sends zero requests.
 */

export const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
export const USER_AGENT =
  'slayer-playground/0.1 (+https://github.com/prettyrocket/slayer-playground)';

/** `action=query` accepts at most 50 titles per request for normal users. */
export const MAX_TITLES_PER_REQUEST = 50;
/** Bucket's own maximum `limit`. */
export const BUCKET_PAGE_SIZE = 5000;

export type Params = Record<string, string>;

export interface WikiClientOptions {
  /** Directory for cached responses, e.g. `.cache/wiki`. */
  cacheDir: string;
  /** Ignore cached responses (they are still rewritten). */
  refresh?: boolean;
  /** Minimum gap between the starts of two network requests. */
  minIntervalMs?: number;
  /** Attempts per request, including the first. */
  maxAttempts?: number;
  /** Backoff before the first retry; doubles each time. */
  retryBaseMs?: number;
  apiUrl?: string;
  userAgent?: string;
  // Injected in tests.
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

export interface WikiClientStats {
  network: number;
  cached: number;
  retries: number;
}

/** The API answered, but with an error payload (Bucket and MediaWiki both use HTTP 200 for these). */
export class WikiApiError extends Error {
  readonly params: Params;

  constructor(message: string, params: Params) {
    super(message);
    this.name = 'WikiApiError';
    this.params = params;
  }
}

/** A non-2xx response that retries did not fix. */
export class WikiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WikiHttpError';
    this.status = status;
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class WikiClient {
  readonly stats: WikiClientStats = { network: 0, cached: 0, retries: 0 };

  private readonly opts: Required<WikiClientOptions>;
  private lastRequestAt = -Infinity;
  // Chains requests so they never overlap, even if callers don't await in order.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: WikiClientOptions) {
    this.opts = {
      refresh: false,
      minIntervalMs: 1000,
      maxAttempts: 4,
      retryBaseMs: 2000,
      apiUrl: WIKI_API,
      userAgent: USER_AGENT,
      fetch: (...args) => fetch(...args),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      log: (message) => console.log(message),
      ...options,
    };
  }

  /** GET `api.php` with `params` (plus `format=json`), from cache when possible. */
  async get<T>(params: Params): Promise<T> {
    const full: Params = { format: 'json', formatversion: '2', ...params };
    const file = path.join(this.opts.cacheDir, `${cacheKey(full)}.json`);

    if (!this.opts.refresh) {
      const cached = await readCache<T>(file);
      if (cached !== undefined) {
        this.stats.cached++;
        return cached;
      }
    }

    const body = await this.enqueue(() => this.fetchWithRetry<T>(full));
    await mkdir(this.opts.cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify({ params: full, body }));
    return body;
  }

  /**
   * Run one Bucket query and return its rows. `query` is the Lua expression,
   * e.g. `bucket('infobox_monster').select('page_name').limit(10).run()`.
   */
  async bucket<Row>(query: string): Promise<Row[]> {
    const params = { action: 'bucket', query };
    const res = await this.get<{ bucket?: Row[]; error?: string }>(params);
    if (res.error !== undefined || !Array.isArray(res.bucket)) {
      throw new WikiApiError(`Bucket query failed: ${res.error ?? 'no rows array'}`, params);
    }
    return res.bucket;
  }

  /**
   * Page through a Bucket query `BUCKET_PAGE_SIZE` rows at a time. `build`
   * receives the `.limit(…).offset(…)` suffix to put before `.run()`.
   */
  async bucketAll<Row>(build: (page: string) => string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += BUCKET_PAGE_SIZE) {
      const page = await this.bucket<Row>(build(`.limit(${BUCKET_PAGE_SIZE}).offset(${offset})`));
      rows.push(...page);
      if (page.length < BUCKET_PAGE_SIZE) return rows;
    }
  }

  /**
   * Fetch the current wikitext of `titles`, following redirects, up to 50 per
   * request. Returns a map keyed by the titles as requested; missing pages map to null.
   */
  async wikitext(titles: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    const unique = [...new Set(titles)];
    for (let i = 0; i < unique.length; i += MAX_TITLES_PER_REQUEST) {
      const chunk = unique.slice(i, i + MAX_TITLES_PER_REQUEST);
      const res = await this.get<QueryRevisionsResponse>({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        redirects: '1',
        titles: chunk.join('|'),
      });
      if (res.error) throw new WikiApiError(res.error.info, { titles: chunk.join('|') });

      const renamed = new Map<string, string>();
      for (const { from, to } of [
        ...(res.query?.normalized ?? []),
        ...(res.query?.redirects ?? []),
      ]) {
        renamed.set(from, to);
      }
      const content = new Map<string, string>();
      for (const page of res.query?.pages ?? []) {
        const text = page.revisions?.[0]?.slots?.main?.content;
        if (typeof text === 'string') content.set(page.title, text);
      }
      for (const title of chunk) {
        // A title can be normalized and then redirected, so follow the chain.
        let resolved = title;
        for (let hops = 0; renamed.has(resolved) && hops < 5; hops++)
          resolved = renamed.get(resolved)!;
        out.set(title, content.get(resolved) ?? null);
      }
    }
    return out;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetchWithRetry<T>(params: Params): Promise<T> {
    const url = `${this.opts.apiUrl}?${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt++) {
      const wait = this.lastRequestAt + this.opts.minIntervalMs - this.opts.now();
      if (wait > 0) await this.opts.sleep(wait);
      this.lastRequestAt = this.opts.now();
      this.stats.network++;

      const res = await this.opts
        .fetch(url, {
          headers: { 'User-Agent': this.opts.userAgent, Accept: 'application/json' },
        })
        .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

      let failure: Error;
      let retryAfterMs: number | undefined;
      if (res instanceof Error) {
        // Network failure (DNS, reset, timeout): worth another try.
        failure = res;
      } else {
        if (res.ok) {
          this.opts.log(`  GET ${describe(params)} -> ${res.status}`);
          return (await res.json()) as T;
        }
        failure = new WikiHttpError(res.status, `HTTP ${res.status} for ${describe(params)}`);
        if (!RETRYABLE_STATUS.has(res.status)) throw failure;
        retryAfterMs = parseRetryAfter(res.headers.get('Retry-After'));
      }

      if (attempt >= this.opts.maxAttempts) throw failure;
      const backoff = Math.max(retryAfterMs ?? 0, this.opts.retryBaseMs * 2 ** (attempt - 1));
      this.stats.retries++;
      this.opts.log(`  ${failure.message}; retrying in ${Math.round(backoff / 1000)}s`);
      await this.opts.sleep(backoff);
    }
  }
}

interface QueryRevisionsResponse {
  error?: { code: string; info: string };
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: {
      title: string;
      missing?: boolean;
      revisions?: { slots?: { main?: { content?: string } } }[];
    }[];
  };
}

/** Stable across param order, so the same request always hits the same file. */
export function cacheKey(params: Params): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

async function readCache<T>(file: string): Promise<T | undefined> {
  try {
    return (JSON.parse(await readFile(file, 'utf8')) as { body: T }).body;
  } catch {
    return undefined;
  }
}

/** Retry-After is either seconds or an HTTP date. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** A short label for logs: the action and its most telling parameter. */
function describe(params: Params): string {
  const detail = params.query ?? params.titles ?? '';
  return `${params.action} ${detail.length > 80 ? `${detail.slice(0, 77)}...` : detail}`;
}
