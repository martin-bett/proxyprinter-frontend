# CLAUDE.md – mtgprint-front (Frontend)

React frontend for proxyprinter.eu: paste a decklist, search card art via configurable API/gallery sources,
pick and crop images, generate a printable proxy PDF. Backend lives in `martin-bett/mtgprint` (all `/api/*` calls).

## Stack
- Create React App (`react-scripts` 5), TypeScript 5, React 18, MUI 6 + Bulma, `mana-font` for theme icons
- Dev server proxies `/api` to `http://localhost:8080` (`src/setupProxy.js`)
- Production: `docker.dockerfile` builds with Node 18 and serves via nginx (`nginx.conf`, `nginx/`)

## Where things live (`src/`)
- `viewer/DeckInputAndViewer.tsx` – main page and most state (decklist, search, selection, PDF generation); `App.tsx` only renders it
- `viewer/` – UI parts: `grid/` (card grid, image select, `crop/`), `pdf/`, `snapshot/`, `cache/`, `log/`, `deckfinder/`, `info/`
- `service/ApiFactory.ts` – config types (`ApiConfig`, `GalleryConfig`, …) and the generic search over configs
- `service/` – `cache/` (IndexedDB caches, server search cache), `deck/` (decklist parser, set catalog), `snapshot/`,
  `deckfinder/`, `quality/` (image sharpness), `configs/initialConfigs.ts`, `RequestThrottle.ts`
- `api/view/` – config dialogs and wizards for API, gallery and deckfinder configs
- `container/` – shared UI pieces (`inputs/` with `CollapsibleSection`, `ActionButton`, …)
- `theme/` – theme chooser and theme definitions
- `i18n/` – i18next setup, `locales/en.json`, language chooser (flag bubble next to the `?` bubble). New UI texts go in `en.json` and are used via `useTranslation`; the UI language never changes card language filters. Concept: `concepts/mehrsprachigkeit.md` in the project files.
- Configs are loaded from the backend (`/api/configs`). `src/api/configs/*.ts` is not imported anywhere.
- Tests sit next to the code as `*.test.ts(x)`; tests touching IndexedDB import `fake-indexeddb/auto` themselves.

## Build, test, run
- Install: `npm ci --legacy-peer-deps` (plain `npm ci` fails with ERESOLVE: TypeScript 5 vs react-scripts 5)
- Typecheck: `npx tsc --noEmit`
- Tests: `CI=true npx react-scripts test --watchAll=false` (single file: append its path)
- Build: `npm run build`
- These are the steps CI runs (`.github/workflows/ci.yml`, Node 18).

## Branches and deploy
- `develop` is the default branch. All PRs target `develop` (CI only, no deploy).
- Release = PR `develop` → `master`. Only a push to `master` deploys (`.github/workflows/deploy.yml`).
- Release order: backend first, wait for green Deploy, then frontend.

## Working conventions
- Answer martin in German. UI texts are English.
- Commit and push early and often; open a draft PR early (unpushed work has been lost before).
- Prefer generic solutions driven by API/gallery configs over source-specific special cases in code;
  keep UX simple.
- `TODO` is martin's feature backlog (German). `archive/` holds old recovered code; don't edit it.
