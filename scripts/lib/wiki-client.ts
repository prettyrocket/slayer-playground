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
 * Error payloads are never cached.
 */

export const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
export const USER_AGENT =
  'slayer-playground/0.1 (+https://github.com/prettyrocket/slayer-playground)';

/** `action=query` accepts at most 50 titles per request for normal users. */
export const MAX_TITLES_PER_REQUEST = 50;
/** Bucket's own maximum `limit`. */
export const BUCKET_PAGE_SIZE = 5000;
/** Abort a request that has not responded by then; it counts as a network failure. */
export const REQUEST_TIMEOUT_MS = 30_000;

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

  /**
   * GET `api.php` with `params` (plus `format=json`), from cache when possible.
   * Throws `WikiApiError` on an error payload.
   */
  async get<T>(params: Params): Promise<T> {
    const full = withFormat(params);
    return this.cached(full, () => this.fetchJson<T>(full));
  }

  /**
   * Run one Bucket query and return its rows. `query` is the Lua expression,
   * e.g. `bucket('infobox_monster').select('page_name').limit(10).run()`.
   */
  async bucket<Row>(query: string): Promise<Row[]> {
    return bucketRows<Row>(await this.get({ action: 'bucket', query }), query);
  }

  /**
   * Fetch every row of a Bucket query, `BUCKET_PAGE_SIZE` at a time. `query`
   * stops before ordering, e.g. `bucket('dropsline').select('page_name_sub','item_name')`,
   * and must select `key`.
   *
   * Pages by key rather than offset (Bucket allows only one `orderBy`, so offsets
   * over a non-unique key aren't stable): each page is ordered by `key`, its
   * trailing run of the last key is dropped, and the next page starts at that
   * key. So no more than `BUCKET_PAGE_SIZE - 1` rows may share a key.
   *
   * The pages are cached together as one result, so an interrupted run never
   * leaves a mix of pages fetched at different times.
   */
  async bucketAll<Row extends object>(query: string, key: keyof Row & string): Promise<Row[]> {
    return this.cached(withFormat({ action: 'bucket', query, key, all: '1' }), async () => {
      const rows: Row[] = [];
      for (let from: string | null = null; ;) {
        const where: string = from === null ? '' : `.where('${key}','>=',${luaString(from)})`;
        const paged: string = `${query}${where}.orderBy('${key}','asc').limit(${BUCKET_PAGE_SIZE}).run()`;
        const page: Row[] = bucketRows<Row>(
          await this.fetchJson(withFormat({ action: 'bucket', query: paged })),
          paged,
        );
        if (page.length < BUCKET_PAGE_SIZE) return [...rows, ...page];

        // The database may compare keys case-insensitively, so match the tail the same way.
        const last = String(page.at(-1)![key]).toLowerCase();
        let cut = page.length;
        while (cut > 0 && String(page[cut - 1][key]).toLowerCase() === last) cut--;
        if (cut === 0)
          throw new WikiApiError(`Over ${BUCKET_PAGE_SIZE} rows share one ${key}`, { query });
        rows.push(...page.slice(0, cut));
        from = String(page[cut][key]);
      }
    });
  }

  /**
   * Current wikitext of each title, `MAX_TITLES_PER_REQUEST` per request,
   * keyed by the title as requested (following normalization and redirects).
   * Missing pages map to null.
   */
  async wikitext(titles: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    const unique = [...new Set(titles)];
    for (let i = 0; i < unique.length; i += MAX_TITLES_PER_REQUEST) {
      const chunk = unique.slice(i, i + MAX_TITLES_PER_REQUEST);
      const { query } = await this.get<QueryRevisionsResponse>({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        redirects: '1',
        titles: chunk.join('|'),
      });

      const renamed = new Map<string, string>();
      for (const { from, to } of [...(query?.normalized ?? []), ...(query?.redirects ?? [])]) {
        renamed.set(from, to);
      }
      const content = new Map<string, string>();
      for (const page of query?.pages ?? []) {
        const text = page.revisions?.[0]?.slots?.main?.content;
        if (typeof text === 'string') content.set(page.title, text);
      }
      for (const title of chunk) {
        // A title can be normalized and then redirected, so follow the chain.
        let resolved = title;
        for (let hops = 0; renamed.has(resolved) && hops < 5; hops++) {
          resolved = renamed.get(resolved)!;
        }
        out.set(title, content.get(resolved) ?? null);
      }
    }
    return out;
  }

  /** Serve `params` from the disk cache, or run `produce` and cache what it returns. */
  private async cached<T>(params: Params, produce: () => Promise<T>): Promise<T> {
    const file = path.join(this.opts.cacheDir, `${cacheKey(this.opts.apiUrl, params)}.json`);

    if (!this.opts.refresh) {
      const hit = await readCache<T>(file);
      if (hit !== undefined) {
        this.stats.cached++;
        return hit;
      }
    }

    const body = await produce();
    await mkdir(this.opts.cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify({ params, body }));
    return body;
  }

  /**
   * The bytes of a file on the wiki, e.g. an image URL from `prop=imageinfo`,
   * through the same queue, User-Agent and retries. Cached on disk by URL even
   * with `refresh`: the wiki versions file URLs (`...png?cd34f`), so a changed
   * file is a new URL, and refetching every image would be wasted requests.
   */
  async download(url: string): Promise<Buffer> {
    const origin = new URL(this.opts.apiUrl).origin;
    if (new URL(url).origin !== origin) throw new Error(`Not a wiki file: ${url}`);
    const file = path.join(
      this.opts.cacheDir,
      'files',
      `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.bin`,
    );
    const hit = await readFile(file).catch(() => undefined);
    if (hit) {
      this.stats.cached++;
      return hit;
    }
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url);
    const body = await this.enqueue(() =>
      this.fetchWithRetry(url, `file ${name}`, 'image/*', async (res) =>
        Buffer.from(await res.arrayBuffer()),
      ),
    );
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return body;
  }

  /** One request through the queue, with retries. Rejects on an error payload, so it is never cached. */
  private async fetchJson<T>(params: Params): Promise<T> {
    const url = `${this.opts.apiUrl}?${new URLSearchParams(params)}`;
    const body = await this.enqueue(() =>
      this.fetchWithRetry(
        url,
        describe(params),
        'application/json',
        (res) => res.json() as Promise<T>,
      ),
    );
    const error = (body as { error?: unknown } | null)?.error;
    if (error !== undefined) {
      const info = typeof error === 'string' ? error : (error as { info?: string }).info;
      throw new WikiApiError(
        `${describe(params)} failed: ${info ?? JSON.stringify(error)}`,
        params,
      );
    }
    return body;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetchWithRetry<T>(
    url: string,
    label: string,
    accept: string,
    read: (res: Response) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const wait = this.lastRequestAt + this.opts.minIntervalMs - this.opts.now();
      if (wait > 0) await this.opts.sleep(wait);
      this.lastRequestAt = this.opts.now();
      this.stats.network++;

      const res = await this.opts
        .fetch(url, {
          headers: { 'User-Agent': this.opts.userAgent, Accept: accept },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

      let failure: Error;
      let retryAfterMs: number | undefined;
      if (res instanceof Error) {
        // Network failure (DNS, reset, timeout): worth another try.
        failure = res;
      } else {
        if (res.ok) {
          this.opts.log(`  GET ${label} -> ${res.status}`);
          return await read(res);
        }
        failure = new WikiHttpError(res.status, `HTTP ${res.status} for ${label}`);
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

/**
 * Stable across param order, so the same request always hits the same file.
 * Hashes JSON rather than `k=v&…`, so a value containing `&` or `=` can't collide.
 */
export function cacheKey(apiUrl: string, params: Params): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]]);
  return createHash('sha256')
    .update(JSON.stringify([apiUrl, sorted]))
    .digest('hex')
    .slice(0, 32);
}

interface QueryRevisionsResponse {
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

/** A Lua string literal. */
function luaString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function withFormat(params: Params): Params {
  return { format: 'json', formatversion: '2', ...params };
}

function bucketRows<Row>(res: { bucket?: Row[] }, query: string): Row[] {
  if (!Array.isArray(res.bucket)) {
    throw new WikiApiError('Bucket query returned no rows array', { action: 'bucket', query });
  }
  return res.bucket;
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
  const detail = params.query ?? '';
  return `${params.action} ${detail.length > 80 ? `${detail.slice(0, 77)}...` : detail}`;
}
