import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BUCKET_PAGE_SIZE,
  USER_AGENT,
  WikiApiError,
  WikiClient,
  type WikiClientOptions,
  WikiHttpError,
  cacheKey,
} from './wiki-client.ts';

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'wiki-client-'));
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

/** A client on a fake clock: `sleep` advances time instead of waiting. */
function setup(responses: (Response | Error)[], options: Partial<WikiClientOptions> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const queue = [...responses];
  const fetchMock = vi.fn(async (): Promise<Response> => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = new WikiClient({
    cacheDir,
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    log: () => {},
    ...options,
  });
  const urls = () => fetchMock.mock.calls.map((call) => new URL(String((call as unknown[])[0])));
  return { client, fetchMock, sleeps, urls };
}

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

describe('WikiClient.get', () => {
  it('sends the User-Agent and format params', async () => {
    const { client, fetchMock, urls } = setup([json({ ok: 1 })]);
    await expect(client.get({ action: 'query', meta: 'siteinfo' })).resolves.toEqual({ ok: 1 });

    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init[1].headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT);
    expect(USER_AGENT).toContain('github.com/prettyrocket/slayer-playground');
    expect(Object.fromEntries(urls()[0].searchParams)).toEqual({
      action: 'query',
      meta: 'siteinfo',
      format: 'json',
      formatversion: '2',
    });
  });

  it('serves repeat requests from the disk cache, even from a new client', async () => {
    const first = setup([json({ n: 1 })]);
    await first.client.get({ action: 'query', b: '2', a: '1' });

    // Same params in a different order, from a fresh client: no network.
    const second = setup([]);
    await expect(second.client.get({ a: '1', action: 'query', b: '2' })).resolves.toEqual({ n: 1 });
    expect(second.fetchMock).not.toHaveBeenCalled();
    expect(second.client.stats).toEqual({ network: 0, cached: 1, retries: 0 });
  });

  it('ignores the cache with refresh, and rewrites it', async () => {
    await setup([json({ v: 'old' })]).client.get({ action: 'query' });

    const fresh = setup([json({ v: 'new' })], { refresh: true });
    await expect(fresh.client.get({ action: 'query' })).resolves.toEqual({ v: 'new' });

    await expect(setup([]).client.get({ action: 'query' })).resolves.toEqual({ v: 'new' });
  });

  it('spaces requests at least minIntervalMs apart', async () => {
    const { client, sleeps } = setup([json(1), json(2), json(3)], { minIntervalMs: 1000 });
    await client.get({ action: 'a' });
    await client.get({ action: 'b' });
    await client.get({ action: 'c' });
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('never overlaps requests, even when callers fire them together', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const client = new WikiClient({
      cacheDir,
      minIntervalMs: 0,
      log: () => {},
      fetch: (async () => {
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return json({});
      }) as unknown as typeof fetch,
    });
    await Promise.all([1, 2, 3, 4].map((n) => client.get({ action: `x${n}` })));
    expect(maxInFlight).toBe(1);
  });

  it('retries 429 and 5xx with exponential backoff, honouring Retry-After', async () => {
    const { client, sleeps } = setup(
      [
        new Response(null, { status: 503 }),
        new Response(null, { status: 429, headers: { 'Retry-After': '30' } }),
        json({ ok: true }),
      ],
      { minIntervalMs: 0, retryBaseMs: 2000 },
    );
    await expect(client.get({ action: 'query' })).resolves.toEqual({ ok: true });
    expect(sleeps).toEqual([2000, 30_000]);
    expect(client.stats).toMatchObject({ network: 3, retries: 2 });
  });

  it('retries network errors', async () => {
    const { client } = setup([new TypeError('fetch failed'), json({ ok: true })], {
      minIntervalMs: 0,
    });
    await expect(client.get({ action: 'query' })).resolves.toEqual({ ok: true });
  });

  it('gives up after maxAttempts and caches nothing', async () => {
    const { client } = setup(
      Array.from({ length: 3 }, () => new Response(null, { status: 502 })),
      {
        maxAttempts: 3,
        minIntervalMs: 0,
      },
    );
    await expect(client.get({ action: 'query' })).rejects.toBeInstanceOf(WikiHttpError);
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('does not retry other 4xx responses', async () => {
    const { client, fetchMock } = setup([new Response(null, { status: 403 })]);
    await expect(client.get({ action: 'query' })).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('WikiClient.bucket', () => {
  it('returns rows and URL-encodes the Lua query', async () => {
    const { client, urls } = setup([json({ bucket: [{ page_name: 'Abyssal demon' }] })]);
    const query =
      "bucket('infobox_monster').select('page_name').where('name','Abyssal demon').run()";
    await expect(client.bucket(query)).resolves.toEqual([{ page_name: 'Abyssal demon' }]);
    expect(urls()[0].searchParams.get('query')).toBe(query);
    expect(urls()[0].search).not.toContain("'");
  });

  it('throws WikiApiError on an error payload, without caching it', async () => {
    const { client } = setup([json({ error: 'Invalid field name: *' })]);
    await expect(client.bucket("bucket('x').select('*').run()")).rejects.toBeInstanceOf(
      WikiApiError,
    );
    expect(await readdir(cacheDir)).toEqual([]);
  });

  // A full page whose last 3 rows share the key "Kree'arra".
  const fullPage = () => [
    ...Array.from({ length: BUCKET_PAGE_SIZE - 3 }, (_, i) => ({ page: `A${i}` })),
    ...[1, 2, 3].map(() => ({ page: "Kree'arra" })),
  ];
  const query = "bucket('dropsline').select('page')";

  it('pages by key, restarting at the last key so no row is lost or repeated', async () => {
    const tail = [1, 2, 3, 4].map(() => ({ page: "Kree'arra" }));
    const { client, urls } = setup([json({ bucket: fullPage() }), json({ bucket: tail })], {
      minIntervalMs: 0,
    });
    const rows = await client.bucketAll<{ page: string }>(query, 'page');
    expect(rows).toHaveLength(BUCKET_PAGE_SIZE - 3 + 4);
    expect(urls().map((u) => u.searchParams.get('query'))).toEqual([
      `${query}.orderBy('page','asc').limit(${BUCKET_PAGE_SIZE}).run()`,
      `${query}.where('page','>=','Kree\\'arra').orderBy('page','asc').limit(${BUCKET_PAGE_SIZE}).run()`,
    ]);
  });

  it('fails rather than loop when one key fills a page', async () => {
    const same = Array.from({ length: BUCKET_PAGE_SIZE }, () => ({ page: 'X' }));
    const { client } = setup([json({ bucket: same })]);
    await expect(client.bucketAll<{ page: string }>(query, 'page')).rejects.toThrow(
      'rows share one page',
    );
  });

  it('caches all pages as one result, and nothing if a page fails', async () => {
    const failing = setup([json({ bucket: fullPage() }), json({ error: 'timeout' })], {
      minIntervalMs: 0,
    });
    await expect(failing.client.bucketAll<{ page: string }>(query, 'page')).rejects.toBeInstanceOf(
      WikiApiError,
    );
    expect(await readdir(cacheDir)).toEqual([]);

    await setup([json({ bucket: fullPage() }), json({ bucket: [] })], {
      minIntervalMs: 0,
    }).client.bucketAll<{ page: string }>(query, 'page');
    expect(await readdir(cacheDir)).toHaveLength(1);

    const warm = setup([]);
    await expect(warm.client.bucketAll<{ page: string }>(query, 'page')).resolves.toHaveLength(
      BUCKET_PAGE_SIZE - 3,
    );
    expect(warm.fetchMock).not.toHaveBeenCalled();
  });
});

describe('WikiClient errors and timeouts', () => {
  it('does not cache a MediaWiki error payload', async () => {
    const { client } = setup([json({ error: { code: 'maxlag', info: 'Waiting for db' } })]);
    await expect(client.get({ action: 'query' })).rejects.toThrow('Waiting for db');
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('gives every request a timeout signal', async () => {
    const { client, fetchMock } = setup([json({})]);
    await client.get({ action: 'query' });
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('WikiClient.wikitext', () => {
  const page = (title: string, content: string) => ({
    title,
    revisions: [{ slots: { main: { content } } }],
  });

  it('keys results by the requested title through normalization and redirects', async () => {
    const { client } = setup([
      json({
        query: {
          normalized: [{ from: 'slayer task/nech', to: 'Slayer task/nech' }],
          redirects: [{ from: 'Slayer task/nech', to: 'Slayer task/Nechryael' }],
          pages: [
            page('Slayer task/Nechryael', 'nech text'),
            page('Vannaka', 'vannaka text'),
            { title: 'Nope', missing: true },
          ],
        },
      }),
    ]);
    const result = await client.wikitext(['slayer task/nech', 'Vannaka', 'Nope']);
    expect(Object.fromEntries(result)).toEqual({
      'slayer task/nech': 'nech text',
      Vannaka: 'vannaka text',
      Nope: null,
    });
  });

  it('batches 50 titles per request and drops duplicates', async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `Page ${i}`);
    const { client, urls } = setup(
      [0, 1, 2].map(() => json({ query: { pages: [] } })),
      { minIntervalMs: 0 },
    );
    await client.wikitext([...titles, 'Page 0']);
    expect(urls().map((u) => u.searchParams.get('titles')!.split('|').length)).toEqual([
      50, 50, 20,
    ]);
  });
});

describe('cacheKey', () => {
  const api = 'https://example.test/api.php';

  it('is independent of param order and changes with values', () => {
    expect(cacheKey(api, { a: '1', b: '2' })).toBe(cacheKey(api, { b: '2', a: '1' }));
    expect(cacheKey(api, { a: '1' })).not.toBe(cacheKey(api, { a: '2' }));
  });

  it('does not collide when a value contains & or =, or across API URLs', () => {
    expect(cacheKey(api, { a: '1&b=2' })).not.toBe(cacheKey(api, { a: '1', b: '2' }));
    expect(cacheKey(api, { a: '1' })).not.toBe(cacheKey('https://other.test/api.php', { a: '1' }));
  });
});
