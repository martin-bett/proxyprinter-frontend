# Archiv: deployter Frontend-Stand vom 24.06.2025

Unveränderte Sicherung des Codes, der bis August 2026 auf proxyprinter.eu lief, aber nie committet wurde.
Quelle: claude.ai-Artefakt "ProxyPrinter Code-Archiv" (https://claude.ai/artifact/5xRTdvPMZLE3N16woCbT3F), am 03.10.2026 auf dem VPS erstellt.

- `src/` ist aus den Source-Maps des CRA-Builds rekonstruiert (Originalcode mit Kommentaren, JavaScript vor der TypeScript-Umstellung).
- `public-*` sind die Dateien aus dem Build-Root (`index.html`, `manifest.json`, ...). Bilder/Icons waren nicht im Artefakt.
- `public-index.html` verlinkt `main.c39a9658.css`, die im Artefakt fehlt; das CSS liegt aber als Quelle in `src/`.

Nur als Vorlage zum Portieren gedacht, wird nicht gebaut. Bitte aus Lint/TS-Checks ausnehmen falls nötig.
