// Vorgefertigte Farbsets. Jeder Schlüssel in `colors` wird als CSS-Variable
// `--<schlüssel>` auf <html> gesetzt und von allen CSS-Dateien verwendet.

import type { ManaColor } from './ManaSymbol';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  'app-bg': string;            // Grundfarbe des Hintergrunds
  'app-bg-gradient-start': string;
  'app-bg-gradient-end': string;
  'surface': string;           // Dialoge, Karten, Panels
  'surface-muted': string;     // leicht abgesetzte Flächen (Tabellenköpfe, Labels)
  'surface-raised': string;    // Icon-Leiste
  'input-bg': string;          // Decklist-Textarea, Log
  'text': string;
  'text-muted': string;
  'text-inverse': string;      // Text auf dunklem Overlay
  'border': string;
  'border-strong': string;
  'hover': string;
  'accent': string;            // Primärfarbe (auch MUI primary)
  'accent-soft': string;       // Auswahl-Hintergrund
  'accent-strong': string;     // aktive Rahmen
  'card-border': string;       // Rahmen der Karten im Grid
  'overlay-bg': string;        // Bild-Info Overlay
  'disabled-overlay': string;  // Overlay über deaktivierten Feldern
  'shadow': string;
  'scrollbar': string;
  'scrollbar-hover': string;
  'track': string;             // Hintergrund von Fortschrittsbalken
  'success': string;
  'success-soft': string;
  'warning': string;
  'warning-soft': string;
  'danger': string;
  'danger-soft': string;
  'info-soft': string;
  'rating': string;            // Sterne-Bewertung
}

export interface AppTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  mana?: ManaColor;            // Mana-Symbol als Wasserzeichen und in der Theme-Auswahl
  colors: ThemeColors;
}

const lightBase: Omit<ThemeColors, 'app-bg' | 'app-bg-gradient-start' | 'app-bg-gradient-end' | 'accent' | 'accent-soft' | 'accent-strong' | 'card-border' | 'input-bg' | 'rating'> = {
  'surface': '#ffffff',
  'surface-muted': '#f5f5f5',
  'surface-raised': '#eeeeee',
  'text': '#222222',
  'text-muted': '#888888',
  'text-inverse': '#ffffff',
  'border': '#dbdbdb',
  'border-strong': '#383838',
  'hover': 'hsl(0, 0%, 65%)',
  'overlay-bg': 'rgba(0, 0, 0, 0.7)',
  'disabled-overlay': 'rgba(255, 255, 255, 0.5)',
  'shadow': 'rgba(0, 0, 0, 0.1)',
  'scrollbar': '#ffffff',
  'scrollbar-hover': 'rgba(255, 255, 255, 0.7)',
  'track': '#f0f0f0',
  'success': '#4caf50',
  'success-soft': '#e1ffd4',
  'warning': '#f1c40f',
  'warning-soft': '#fff0b3',
  'danger': '#e74c3c',
  'danger-soft': '#ffb4a2',
  'info-soft': '#e0f4fc',
};

const darkBase: typeof lightBase = {
  'surface': '#1f2329',
  'surface-muted': '#2a2f37',
  'surface-raised': '#2a2f37',
  'text': '#e6e6e6',
  'text-muted': '#9aa0a6',
  'text-inverse': '#ffffff',
  'border': '#3c434d',
  'border-strong': '#c8c8c8',
  'hover': 'hsl(0, 0%, 35%)',
  'overlay-bg': 'rgba(0, 0, 0, 0.75)',
  'disabled-overlay': 'rgba(0, 0, 0, 0.5)',
  'shadow': 'rgba(0, 0, 0, 0.4)',
  'scrollbar': '#5a6270',
  'scrollbar-hover': '#7a8494',
  'track': '#2a2f37',
  'success': '#43a047',
  'success-soft': '#24402a',
  'warning': '#f1c40f',
  'warning-soft': '#4a4220',
  'danger': '#ef5350',
  'danger-soft': '#4d2a2a',
  'info-soft': '#1f3a48',
};

// Fünf Themes in den Magic-Farben (WUBRG) plus Mitternacht.
export const THEMES: AppTheme[] = [
  {
    id: 'plains',
    name: 'Ebene',
    mode: 'light',
    mana: 'W',
    colors: {
      ...lightBase,
      'surface': '#fffdf6',
      'surface-muted': '#f8f0da',
      'surface-raised': '#f1e6c6',
      'border': '#e0d3ad',
      'app-bg': '#efdcaa',
      'app-bg-gradient-start': '#e9cf8f',
      'app-bg-gradient-end': '#faf1d6',
      'accent': '#a8760c',
      'accent-soft': '#f3dfa2',
      'accent-strong': '#7a5508',
      'card-border': '#8f6f2c',
      'input-bg': '#fffaea',
      'rating': '#a8760c',
      'scrollbar': '#e6d7ab',
      'scrollbar-hover': '#d4c08a',
    },
  },
  {
    id: 'island',
    name: 'Insel',
    mode: 'light',
    mana: 'U',
    colors: {
      ...lightBase,
      'surface-muted': '#eef5fc',
      'surface-raised': '#e2eef9',
      'app-bg': '#a9cdee',
      'app-bg-gradient-start': '#86b6e3',
      'app-bg-gradient-end': '#d7ebfa',
      'accent': '#1d6fc0',
      'accent-soft': '#c4ddf5',
      'accent-strong': '#0f4f8f',
      'card-border': '#1e4f80',
      'input-bg': '#eaf4fc',
      'rating': '#1d6fc0',
    },
  },
  {
    id: 'swamp',
    name: 'Sumpf',
    mode: 'dark',
    mana: 'B',
    colors: {
      ...darkBase,
      'surface': '#1e1b22',
      'surface-muted': '#29242f',
      'surface-raised': '#29242f',
      'border': '#3d3645',
      'app-bg': '#141117',
      'app-bg-gradient-start': '#100e12',
      'app-bg-gradient-end': '#2a2230',
      'accent': '#a98bc2',
      'accent-soft': '#3a2e47',
      'accent-strong': '#cdb6e0',
      'card-border': '#544760',
      'input-bg': '#231f28',
      'rating': '#a98bc2',
    },
  },
  {
    id: 'mountain',
    name: 'Gebirge',
    mode: 'light',
    mana: 'R',
    colors: {
      ...lightBase,
      'surface-muted': '#fbece3',
      'surface-raised': '#f6dfd2',
      'app-bg': '#e3946c',
      'app-bg-gradient-start': '#d9745a',
      'app-bg-gradient-end': '#efc17e',
      'accent': '#b8360f',
      'accent-soft': '#f8cbb5',
      'accent-strong': '#86270a',
      'card-border': '#6e240c',
      'input-bg': '#fdeee2',
      'rating': '#b8360f',
    },
  },
  {
    id: 'forest',
    name: 'Wald',
    mode: 'light',
    mana: 'G',
    colors: {
      ...lightBase,
      'surface-muted': '#f1f6ef',
      'app-bg': '#c9dfc1',
      'app-bg-gradient-start': '#a8c8a0',
      'app-bg-gradient-end': '#e6efd8',
      'accent': '#2e7d32',
      'accent-soft': '#c8e6c9',
      'accent-strong': '#1b5e20',
      'card-border': '#3e6b40',
      'input-bg': '#eef6ea',
      'rating': '#2e7d32',
    },
  },
  {
    id: 'midnight',
    name: 'Mitternacht',
    mode: 'dark',
    colors: {
      ...darkBase,
      'surface': '#141b2d',
      'surface-muted': '#1c2540',
      'surface-raised': '#1c2540',
      'border': '#2d3a5c',
      'app-bg': '#0b1020',
      'app-bg-gradient-start': '#0b1020',
      'app-bg-gradient-end': '#2a1b4a',
      'accent': '#2dd4bf',
      'accent-soft': '#134e4a',
      'accent-strong': '#5eead4',
      'card-border': '#1f7a72',
      'input-bg': '#1a2238',
      'rating': '#2dd4bf',
    },
  },
];

export const DEFAULT_THEME_ID = 'island';

// Alte Theme-IDs aus localStorage auf die neuen abbilden
const LEGACY_THEME_IDS: Record<string, string> = {
  classic: 'island',
  light: 'plains',
  dark: 'swamp',
  sunset: 'mountain',
};

export function getThemeById(id: string | null | undefined): AppTheme {
  const resolved = id ? (LEGACY_THEME_IDS[id] ?? id) : id;
  return THEMES.find(t => t.id === resolved) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}
