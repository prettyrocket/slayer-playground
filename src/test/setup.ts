import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { monstersFixture } from '@/test/monsters';

// jsdom has no matchMedia; MUI's color scheme logic needs it. Report "light".
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// Tests never touch the network: fetch serves a small monsters.json fixture (the
// catalog every page's navigation uses) and answers 404 for anything else,
// unless a test mocks it, e.g.
//   vi.mocked(fetch).mockResolvedValueOnce(Response.json([...]))
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('data/monsters.json')
        ? Response.json(monstersFixture)
        : new Response(null, { status: 404, statusText: 'Not Found' }),
    ),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
