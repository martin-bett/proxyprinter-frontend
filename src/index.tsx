import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppThemeProvider, applyThemeToDocument } from './theme/ThemeContext';
import { getThemeById } from './theme/themes';
import reportWebVitals from './reportWebVitals';
import { detectInstance } from './service/instance';

const container = document.getElementById('root');
if (!container) {
  throw new Error("Root element with id 'root' not found");
}
// Gespeichertes Farbschema vor dem ersten Rendern setzen, damit nichts aufblitzt
let storedThemeId: string | null = null;
try {
  storedThemeId = localStorage.getItem('appTheme');
} catch {
  // localStorage nicht verfügbar
}
applyThemeToDocument(getThemeById(storedThemeId));

// Test-/PR-/lokale Instanz im Browser-Tab kenntlich machen (Erkennung über den Hostnamen, Produktion bleibt unverändert)
const instance = detectInstance(window.location.hostname);
if (instance.label) {
  document.title = `${instance.label} ${document.title}`;
}
if (instance.favicon) {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) {
    icon.href = `${process.env.PUBLIC_URL}/${instance.favicon}`;
  }
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
