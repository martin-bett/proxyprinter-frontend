import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { AppTheme, THEMES, getThemeById } from './themes';

const STORAGE_KEY = 'appTheme';

interface AppThemeContextValue {
  theme: AppTheme;
  themes: AppTheme[];
  setThemeId: (id: string) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

function readStoredThemeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Schreibt die Farben als CSS-Variablen auf <html> und setzt data-theme für Bulma.
export function applyThemeToDocument(theme: AppTheme) {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  root.setAttribute('data-theme', theme.mode);
  root.setAttribute('data-app-theme', theme.id);
  root.style.colorScheme = theme.mode;
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<string>(() => getThemeById(readStoredThemeId()).id);
  const theme = getThemeById(themeId);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      // localStorage nicht verfügbar, Auswahl gilt nur für diese Sitzung
    }
  }, [theme]);

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: theme.mode,
      primary: { main: theme.colors.accent },
      success: { main: theme.colors.success },
      warning: { main: theme.colors.warning },
      error: { main: theme.colors.danger },
      background: {
        default: theme.colors['app-bg'],
        paper: theme.colors.surface,
      },
      text: {
        primary: theme.colors.text,
        secondary: theme.colors['text-muted'],
      },
      divider: theme.colors.border,
    },
  }), [theme]);

  const value = useMemo(() => ({ theme, themes: THEMES, setThemeId }), [theme]);

  return (
    <AppThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </AppThemeContext.Provider>
  );
};

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }
  return ctx;
}
