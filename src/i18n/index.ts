import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export interface UiLanguage {
  code: string;
  /** Name in its own language */
  name: string;
  /** Country code for the flag (flag-icons) */
  country: string;
}

// A new language = a new locales/<code>.json, one loader and one entry here.
export const UI_LANGUAGES: UiLanguage[] = [
  { code: 'en', name: 'English', country: 'gb' },
  { code: 'de', name: 'Deutsch', country: 'de' },
  { code: 'fr', name: 'Français', country: 'fr' },
  { code: 'it', name: 'Italiano', country: 'it' },
  { code: 'es', name: 'Español', country: 'es' },
  { code: 'ru', name: 'Русский', country: 'ru' },
  { code: 'ja', name: '日本語', country: 'jp' },
  { code: 'zh', name: '中文', country: 'cn' },
];

const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  es: () => import('./locales/es.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  zh: () => import('./locales/zh.json'),
};

const FALLBACK = 'en';
const STORAGE_KEY = 'uiLanguage';

const isSupported = (code: string | null | undefined): code is string =>
  !!code && UI_LANGUAGES.some(l => l.code === code);

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Saved choice, else English. Browser language is not used yet: only a few texts are translated so far. */
export const detectLanguage = (): string => {
  const stored = readStored();
  return isSupported(stored) ? stored : FALLBACK;
};

const loadBundle = async (code: string) => {
  if (i18n.hasResourceBundle(code, 'translation')) return;
  const loader = LOADERS[code];
  if (!loader) return;
  const module = await loader();
  i18n.addResourceBundle(code, 'translation', module.default, true, true);
};

export const changeUiLanguage = async (code: string) => {
  if (!isSupported(code)) return;
  await loadBundle(code);
  await i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // storage may be blocked, the choice then only lasts for this visit
  }
};

i18n.on('languageChanged', lng => {
  document.documentElement.lang = lng;
});

const initial = detectLanguage();
i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: FALLBACK,
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
}).then(() => {
  if (initial !== FALLBACK) void changeUiLanguage(initial);
  else document.documentElement.lang = FALLBACK;
});

export default i18n;
