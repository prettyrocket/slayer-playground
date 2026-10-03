import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import {
  abyssalDemonDrops,
  categoriesFixture,
  mastersFixture,
  metaFixture,
  monstersFixture,
  unlocksFixture,
} from '@/test/monsters';

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

// Tests never touch the network: fetch serves small monsters.json,
// categories.json and masters.json fixtures (the catalog every page's navigation uses) and answers
// 404 for anything else, unless a test mocks it, e.g.
//   vi.mocked(fetch).mockResolvedValueOnce(Response.json([...]))
const fixtures: Record<string, unknown> = {
  'data/monsters.json': monstersFixture,
  'data/categories.json': categoriesFixture,
  'data/drops/abyssal-demon.json': abyssalDemonDrops,
  'data/masters.json': mastersFixture,
  'data/meta.json': metaFixture,
  'data/unlocks.json': unlocksFixture,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const file = Object.keys(fixtures).find((path) => String(url).endsWith(path));
      return file
        ? Response.json(fixtures[file])
        : new Response(null, { status: 404, statusText: 'Not Found' });
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
