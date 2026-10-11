# ProxyPrinter – Frontend

Web app behind [proxyprinter.eu](https://proxyprinter.eu): paste a decklist, pick card art from configurable
API and gallery sources, crop images and generate a printable proxy PDF.

This repository holds the React frontend. The backend (Spring Boot, PDF generation, config storage) lives in
[martin-bett/proxyprinter-backend](https://github.com/martin-bett/proxyprinter-backend).

## Run locally

Requirements: Node 18, a running backend on `http://localhost:8080` (see the backend README).

```bash
npm ci --legacy-peer-deps   # plain npm ci fails: TypeScript 5 vs react-scripts 5
npm start                   # dev server on http://localhost:3000, /api is proxied to :8080
```

Checks (the same ones CI runs):

```bash
npx tsc --noEmit
CI=true npx react-scripts test --watchAll=false
npm run build
```

## Project layout

- `src/viewer/` – main page (`DeckInputAndViewer.tsx`) and UI parts
- `src/service/` – search over API/gallery configs, caches, decklist parser
- `src/api/view/` – dialogs and wizards for API, gallery and deckfinder configs
- `src/i18n/` – translations; every visible text is a key in `src/i18n/locales/en.json` and the other locale files
- `CLAUDE.md` – short developer notes (also used by AI coding agents)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

Copyright (C) 2024-2026 martin-bett and the ProxyPrinter contributors.

The source code is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).
If you run a modified version as a web service, you must offer its source code to its users.

Not covered by this license: names, logos and trademarks of games and publishers (for example the icons in the
frontend's `public/icons/` and `public/flags/`) belong to their respective owners, as does all card artwork.

## Disclaimer

ProxyPrinter is an unofficial, non-commercial fan project. It is not affiliated with, endorsed or sponsored by
Wizards of the Coast or any other publisher. Magic: The Gathering and all related names, symbols and logos are
trademarks of their respective owners. This repository contains no card images; the app loads them at runtime
from public sources and third-party APIs, and all rights to the artwork remain with their owners.
Logos of games and publishers in `public/icons/` and `public/flags/` belong to their respective owners.
