const APP_TITLE = 'ProxyPrinter';

// Fortschrittsangabe, die vor dem App-Namen steht, z.B. "45% "
const PROGRESS_PREFIX = /\d+% (?=ProxyPrinter)/;

/**
 * Zeigt den Ladefortschritt im Tab-Titel vor dem App-Namen, z.B. "[TEST] 45% ProxyPrinter".
 * null entfernt die Anzeige wieder. Das Instanz-Präfix bleibt erhalten.
 */
export function setLoadingProgressTitle(percent: number | null): void {
  const plainTitle = document.title.replace(PROGRESS_PREFIX, '');
  if (percent === null) {
    document.title = plainTitle;
    return;
  }
  const appIndex = plainTitle.indexOf(APP_TITLE);
  if (appIndex < 0) return;
  document.title = `${plainTitle.slice(0, appIndex)}${Math.round(percent)}% ${plainTitle.slice(appIndex)}`;
}
