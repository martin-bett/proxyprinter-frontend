// Vorgefertigte Farbsets. Jeder Schlüssel in `colors` wird als CSS-Variable
// `--<schlüssel>` auf <html> gesetzt und von allen CSS-Dateien verwendet.

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

export const THEMES: AppTheme[] = [
  {
    id: 'classic',
    name: 'Klassisch',
    mode: 'light',
    colors: {
      ...lightBase,
      'app-bg': '#D9AFD9',
      'app-bg-gradient-start': '#D9AFD9',
      'app-bg-gradient-end': '#97D9E1',
      'accent': '#3b82f6',
      'accent-soft': '#b5ceff',
      'accent-strong': '#6685e8',
      'card-border': 'hsl(283, 88%, 20%)',
      'input-bg': 'rgb(214, 238, 248)',
      'rating': '#3273a8',
    },
  },
  {
    id: 'light',
    name: 'Hell',
    mode: 'light',
    colors: {
      ...lightBase,
      'app-bg': '#f4f5f7',
      'app-bg-gradient-start': '#f4f5f7',
      'app-bg-gradient-end': '#e4e7ec',
      'accent': '#2563eb',
      'accent-soft': '#cfdcfb',
      'accent-strong': '#1d4ed8',
      'card-border': '#c3c8d0',
      'input-bg': '#ffffff',
      'rating': '#2563eb',
      'scrollbar': '#b8bec8',
      'scrollbar-hover': '#9aa1ad',
    },
  },
  {
    id: 'dark',
    name: 'Dunkel',
    mode: 'dark',
    colors: {
      ...darkBase,
      'app-bg': '#16191d',
      'app-bg-gradient-start': '#16191d',
      'app-bg-gradient-end': '#23272e',
      'accent': '#60a5fa',
      'accent-soft': '#1e3a5f',
      'accent-strong': '#93c5fd',
      'card-border': '#4a515c',
      'input-bg': '#262b33',
      'rating': '#60a5fa',
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
      'accent': '#a78bfa',
      'accent-soft': '#3b2d6b',
      'accent-strong': '#c4b5fd',
      'card-border': '#5b4a9a',
      'input-bg': '#1a2238',
      'rating': '#a78bfa',
    },
  },
  {
    id: 'forest',
    name: 'Wald',
    mode: 'light',
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
    id: 'sunset',
    name: 'Sonnenuntergang',
    mode: 'light',
    colors: {
      ...lightBase,
      'surface-muted': '#fdf3ec',
      'app-bg': '#f6c28b',
      'app-bg-gradient-start': '#f6a28b',
      'app-bg-gradient-end': '#fbe2a6',
      'accent': '#d9480f',
      'accent-soft': '#ffd8c2',
      'accent-strong': '#a63a0c',
      'card-border': '#8a3b12',
      'input-bg': '#fff4e8',
      'rating': '#d9480f',
    },
  },
];

export const DEFAULT_THEME_ID = 'classic';

export function getThemeById(id: string | null | undefined): AppTheme {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}
