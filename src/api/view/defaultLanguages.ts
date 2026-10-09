import type { ParseKeys } from 'i18next';

// Sprachen, in denen es Magic-Karten gibt (ISO-639-1, Phyrexianisch als "ph").
// Auswahl für "Default Language": Sprache für Karten, zu denen die Quelle keine Sprache liefert.
// Zweiter Wert: i18n-Key des Anzeigenamens (wird beim Rendern übersetzt).
export const DEFAULT_LANGUAGE_OPTIONS: [string, ParseKeys][] = [
  ['', 'common.none'],
  ['en', 'configCommon.languages.en'],
  ['de', 'configCommon.languages.de'],
  ['fr', 'configCommon.languages.fr'],
  ['it', 'configCommon.languages.it'],
  ['es', 'configCommon.languages.es'],
  ['pt', 'configCommon.languages.pt'],
  ['ja', 'configCommon.languages.ja'],
  ['ko', 'configCommon.languages.ko'],
  ['ru', 'configCommon.languages.ru'],
  ['zh', 'configCommon.languages.zh'],
  ['ph', 'configCommon.languages.ph'],
];
