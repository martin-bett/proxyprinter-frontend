# Translation glossary

Rules for every language file in `locales/`:

- `en.json` is the source. Same keys, same `{{placeholders}}`, same `<0>…</0>` tags in every language.
- No direct address of the reader: use imperatives, infinitives or nouns ("Delete deck", "Löschen"), no du/Sie/vous/tu/usted/ты/вы.
- Keep these terms in English in every language: Commander, Sideboard, Token, Proxy, Proxyprinter, PDF, API, URL, JSON, HTML, CSRF, DPI, Scryfall, Snapshot (translate only if the language has a common MTG-neutral word; otherwise keep).
- Keep technical identifiers and examples (e.g. `linkPattern`, `{id}`, `(?<id>...)`, regex, `type_line`) unchanged.
- Theme names (`themes.*`): use the official MTG basic land names of the language (Plains, Island, Swamp, Mountain, Forest), "Midnight" is translated normally.
- Plural keys use the plural categories of the language (`_one`/`_other` for de/en/es/it/fr, `_one`/`_few`/`_many`/`_other` for ru, only `_other` for ja/zh). French treats 0 and 1 as `_one`.
- Keep UI texts short; buttons and table headers must stay compact.
