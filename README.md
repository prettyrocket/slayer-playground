# Slayer Playground

Scaffolded with [create-prettyrocket-app](https://www.npmjs.com/package/create-prettyrocket-app):
Vite + React + TypeScript + MUI, deployed to GitHub Pages.

Requires Node 22 or newer.

## Scripts

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Type-check and build to `dist/`                |
| `npm run preview`   | Serve the production build locally             |
| `npm test`          | Run tests once (`npm run test:watch` to watch) |
| `npm run lint`      | ESLint                                         |
| `npm run format`    | Prettier (write); `format:check` to verify     |
| `npm run typecheck` | TypeScript only                                |
| `npm run sync-data` | Snapshot wiki data into `public/data/`         |

## Layout

```
src/
├─ main.tsx              # providers: React Query → MUI theme → router
├─ theme.ts              # MUI theme; change ACCENT first
├─ api.ts                # fetchJson + HttpError
├─ queryClient.ts        # TanStack Query defaults
├─ layouts/RootLayout.tsx
├─ routing/              # routes.tsx (route table + navItems), paths.ts (page URLs),
│                        # useNavLocation (where the user is), navigation tests
├─ pages/                # one component per route
├─ components/           # shared components
├─ data/                 # data types, masters, and the catalog that loads monsters.json
├─ hooks/                # useLocalStorage
└─ test/                 # setup + renderWithProviders / renderRoute helpers
public/                  # served as-is (favicon, data/)
scripts/                 # build-time Node scripts (sync-data)
```

- **App title:** `VITE_APP_TITLE` in `.env` (browser tab and app bar).
- **Add a page:** create it in `src/pages/`, add a route in `routing/routes.tsx`, and
  add it to `navItems` if it belongs in the app bar.
- **Imports:** use `@/` for anything under `src/`.

## Theme and dark mode

`src/theme.ts` sets one `ACCENT` color; dark mode uses a lighter shade of it so
links stay readable. Add other palette values per scheme under
`colorSchemes.light` / `colorSchemes.dark`.
The app bar toggle cycles **system → light → dark**, and MUI remembers the
choice in localStorage. Use theme values (`color="text.secondary"`,
`sx={{ bgcolor: 'background.paper' }}`) rather than hex colors so both schemes work.

## Data

**Saved state** — `useLocalStorage(key, initial)` works like `useState` but
persists as JSON and syncs across tabs. Like `useState`, only the first
`initial` is used, so inline `[]`/`{}` is fine. If the browser refuses to save
(storage full or blocked), the value still works until the page reloads:

```tsx
const [favorites, setFavorites] = useLocalStorage<string[]>('favorites', []);
```

**Fetching** — use TanStack Query with `fetchJson` from `src/api.ts` (it throws
an `HttpError` with `.status` on non-2xx responses, so errors reach `isError`).
Paths like `/data/items.json` load files from `public/`;
absolute URLs call APIs directly. Queries retry network and server errors
twice, but not 4xx responses:

```tsx
export function useThings() {
  return useQuery({
    queryKey: ['things'],
    queryFn: () => fetchJson<Thing[]>('https://api.example.com/things'),
  });
}
```

GitHub Pages is static hosting: an API you call from the browser must allow
CORS, and anything in the code or `.env` is public, so never put secrets there.
React Query Devtools (a floating button, bottom-left) appear in `npm run dev` only.

## Wiki data sync

`npm run sync-data` snapshots Slayer data from the OSRS Wiki into `public/data/`
(committed, so `git diff` shows what changed on the wiki). The site never calls
the wiki itself. Node runs the TypeScript directly (22.18+).

| File                | From                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `monsters.json`     | every `infobox_monster` row with a Slayer category, plus superior links |
| `drops/<slug>.json` | `dropsline` rows, one file per monster                                  |
| `masters.json`      | each master's assignment table (weights, amounts, requirements)         |
| `categories.json`   | every Slayer category: monsters, masters, unlocks, extend, items        |
| `unlocks.json`      | the Slayer Rewards unlocks and extends, with costs                      |
| `meta.json`         | when the data last changed, and the wiki pages it came from             |

Types for all of them are in `src/data/types.ts`. The sync prints a `!` line
for anything it couldn't match (a new master row, a renamed column, a page the
equipment table links that isn't a monster); read them before committing.
`meta.json` keeps a hash of the other files, and its timestamp only moves when
that hash changes, so a sync with nothing new leaves no diff.

All requests go through `scripts/lib/wiki-client.ts`, which is built to be a
good citizen:

- a descriptive User-Agent with the repo URL, so wiki staff can reach us
- one request at a time, at least 1s apart, retrying 429/5xx with backoff
- batched requests (5000 rows per Bucket page), each with a 30s timeout
- every successful response cached in `.cache/wiki/` (gitignored), so re-runs send nothing;
  pass `-- --refresh` to refetch

Data is © the OSRS Wiki contributors, CC BY-NC-SA 3.0.

## Testing

Tests live next to the code as `*.test.ts(x)`. Helpers in `src/test/render.tsx`:

- `renderWithProviders(<Component />)` renders with the theme and a fresh
  QueryClient, and returns `user` (a userEvent instance) for interactions.
- `renderRoute('/about')` renders the whole app (layout + routes) at a path,
  and returns the `router` so you can assert on `router.state.location`.

`fetch` is stubbed in every test, so tests never hit the network. It serves
small `monsters.json` and `categories.json` fixtures (`src/test/monsters.ts`) and
answers 404 for anything else, unless you mock it:

```tsx
vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ id: 1 }]));
```

localStorage is cleared and mocks are restored after each test.

**Wiki parsers** are tested against real wiki responses in
`scripts/sync/fixtures/`: the master pages, Slayer Rewards, Slayer equipment
and Superior slayer monster as wikitext, plus the Bucket rows of a few monsters
picked for their quirks (listed in `scripts/update-fixtures.ts`). To check the
parsers against the wiki as it is now:

```sh
node scripts/update-fixtures.ts --refresh   # a handful of requests
npm test
```

A failure in `scripts/sync/fixtures.test.ts` then means the wiki changed its
markup (fix the parser) or its data (update the expectation). Commit the
refreshed fixtures with the fix.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, format check,
tests, build, then deploy to GitHub Pages at `https://<user>.github.io/<repo>/`.
Pull requests run the same checks without deploying.

If the repo was created by create-prettyrocket-app, `main` has two rulesets
(**Settings → Rules → Rulesets**): nobody can delete or force-push it, and
changes need a PR whose `build` job passed. You, as the owner, can bypass that
second one and push to `main` directly; everyone else, Dependabot included,
waits for green CI. (If you skipped the CLI's GitHub step, the repo has none;
add them under Settings → Rules.)
If Pages isn't enabled yet: **Settings → Pages → Source: GitHub Actions**.

How the pieces fit:

- **Base path.** A project site is served from `/<repo>/`, so the workflow
  builds with `BASE_PATH=/<repo>/`; Vite prefixes asset URLs with it and the
  router uses it as its basename. For a **custom domain** or a
  `<user>.github.io` repo the site is at the root: change the workflow to
  `BASE_PATH: /`.
- **`404.html`.** GitHub Pages has no SPA fallback: opening `/<repo>/about`
  directly would 404. The workflow copies `index.html` to `404.html`, so Pages
  serves the app for unknown paths and the router takes over. Keep that step.
- **Preview the Pages build locally:**
  `BASE_PATH=/<repo>/ npm run build && npm run preview`, then open
  `http://localhost:4173/<repo>/`. (In Git Bash on Windows, prefix with
  `MSYS_NO_PATHCONV=1` so the path isn't rewritten.)

## Bundle size

`vite.config.ts` puts React and MUI's styling runtime in their own chunks,
which stay cached between deploys and keep the main chunk under Vite's 500 kB
warning. If you add a large library (charts, editors, maps), load the page that
uses it lazily in `routing/routes.tsx`, and the library ships in that page's chunk:

```tsx
{
  path: 'charts',
  lazy: async () => ({ Component: (await import('@/pages/ChartsPage')).ChartsPage }),
},
```

Don't add a chunk group for it: a group captures a library even when only a
lazy page imports it, so it would load up front again.

## Dependencies

Dependabot (`.github/dependabot.yml`) opens weekly PRs: minor/patch updates
grouped by area, majors one at a time, and security fixes grouped together.
New releases wait 3 days before being proposed. CI runs on each PR, so a green
grouped PR is usually safe to merge; read the changelog before merging a major.
