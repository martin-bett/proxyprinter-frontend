// Startet react-scripts mit REACT_APP_BUILD_NUMBER = Build-Zeitpunkt in UTC, auf Minuten genau (z. B. 20261009-1347).
// Ein von außen gesetzter Wert (Env oder Docker-Build-Arg) bleibt erhalten.
const { spawnSync } = require('child_process');

if (!process.env.REACT_APP_BUILD_NUMBER) {
  const iso = new Date().toISOString(); // 2026-10-09T13:47:42.000Z
  process.env.REACT_APP_BUILD_NUMBER = `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}`;
}

const bin = require.resolve('react-scripts/bin/react-scripts.js');
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
