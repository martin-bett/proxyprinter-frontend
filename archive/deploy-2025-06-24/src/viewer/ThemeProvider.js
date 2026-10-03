import React, { createContext, useContext, useEffect, useCallback } from "react";

const defaultTheme = {
  "--color-bg": "#f1c1eb",
  "--color-bg-gradient": "linear-gradient(135deg, #f1c1eb 0%, #a5d3f3 100%)",
  "--color-bg-dialog": "#d6eef8",
  "--color-bg-dialog-inner": "#ffffff",
  "--color-primary-1": "#a084ca",
  "--color-primary-2": "#6a8cff",
  "--color-accent-1": "#800080",
  "--color-accent-2": "#43aa8b",
  "--color-accent-3": "#ffd1b8",
  "--color-accent-4": "#f7b801",
  "--color-accent-5": "#a5d3f3",
  "--color-button-bg": "#f2f2f2",
  "--color-button-text": "#000000",
  "--color-text": "#22223b",
  "--color-text-1": "#22223b",
  "--color-text-2": "#444",
  "--color-text-3": "#888",
  "--color-headline": "#5a3577",
  "--color-headline-text": "#5a3577",
  "--font-main": "'JetBrains Mono', monospace",
  "--font-heading": "'JetBrains Mono', monospace"
};

export const darkTheme = {
  "--color-bg": "#181a20",
  "--color-bg-gradient": "linear-gradient(135deg,rgb(19, 37, 30) 0%, #181a20 100%)",
  "--color-bg-dialog": "#23233a",
  "--color-bg-dialog-inner": "#23233a",
  "--color-primary-1": "#ccffee",      
  "--color-primary-2": "#43ffb0",     
  "--color-accent-1": "#43ffb0",       
  "--color-accent-2": "#1e90ff",       
  "--color-accent-3": "#00e6e6",       
  "--color-accent-4": "#00ff99",       
  "--color-accent-5": "#223344",       
  "--color-button-bg": "#ccffee",
  "--color-button-text": "#4d4d4d",
  "--color-text": "#e0e0e0",
  "--color-text-1": "#e0e0e0",
  "--color-text-2": "#b0b0b0",
  "--color-text-3": "#888",
  "--color-headline": "#43ffb0",
  "--color-headline-text": "#43ffb0",
  "--font-main": "'Share Tech Mono', 'JetBrains Mono', monospace",
  "--font-heading": "'Share Tech Mono', 'JetBrains Mono', monospace"
};

const ThemeContext = createContext({
  theme: darkTheme,
  setThemeVar: () => { },
  setThemeVars: () => { },
  setTheme: () => { }
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Prüfe prefers-color-scheme beim ersten Render
  const getInitialTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
    return defaultTheme;
  };

  const [theme, setThemeState] = React.useState(getInitialTheme);

  // Set a single variable
  const setThemeVar = useCallback((key, value) => {
    setThemeState((prev) => {
      const next = { ...prev, [key]: value };
      document.documentElement.style.setProperty(key, value);
      return next;
    });
  }, []);

  // Set multiple variables at once
  const setThemeVars = useCallback((vars) => {
    setThemeState((prev) => {
      const next = { ...prev, ...vars };
      Object.entries(vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      return next;
    }, []);
  });

  // Set a whole theme (replace all)
  const setTheme = useCallback((vars) => {
    setThemeState(vars);
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, []);

  const setLightTheme = useCallback(() => setTheme(defaultTheme), [setTheme]);
  const setDarkTheme = useCallback(() => setTheme(darkTheme), [setTheme]);

  // On mount, set all variables
  useEffect(() => {
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setThemeVar, setThemeVars, setTheme, setLightTheme, setDarkTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
export default ThemeProvider;