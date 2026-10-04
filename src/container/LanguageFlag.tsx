import React from 'react';
import ISO6391 from 'iso-639-1';
import 'flag-icons/css/flag-icons.min.css';
import './LanguageFlag.css';

// Sprache (ISO 639-1) -> Land (ISO 3166-1 alpha-2) für die Flaggen aus flag-icons.
// Sprachen ohne eigenes Land bekommen das Land mit den meisten Sprechern bzw. ein naheliegendes Symbol.
const COUNTRY_BY_LANGUAGE: Record<string, string> = {
  af: 'za', am: 'et', ar: 'sa', az: 'az', be: 'by', bg: 'bg', bn: 'bd', bs: 'ba',
  ca: 'es-ct', cs: 'cz', cy: 'gb-wls', da: 'dk', de: 'de', el: 'gr', en: 'gb', eo: 'un',
  es: 'es', et: 'ee', eu: 'es-pv', fa: 'ir', fi: 'fi', fil: 'ph', fr: 'fr', ga: 'ie',
  gd: 'gb-sct', gl: 'es-ga', gu: 'in', he: 'il', hi: 'in', hr: 'hr', ht: 'ht', hu: 'hu',
  hy: 'am', id: 'id', is: 'is', it: 'it', ja: 'jp', ka: 'ge', kk: 'kz', km: 'kh',
  kn: 'in', ko: 'kr', ku: 'iq', ky: 'kg', la: 'va', lb: 'lu', lo: 'la', lt: 'lt',
  lv: 'lv', mg: 'mg', mi: 'nz', mk: 'mk', ml: 'in', mn: 'mn', mr: 'in', ms: 'my',
  mt: 'mt', my: 'mm', nb: 'no', ne: 'np', nl: 'nl', nn: 'no', no: 'no', pa: 'in',
  pl: 'pl', ps: 'af', pt: 'pt', ro: 'ro', ru: 'ru', sa: 'in', si: 'lk', sk: 'sk',
  sl: 'si', so: 'so', sq: 'al', sr: 'rs', sv: 'se', sw: 'tz', ta: 'in', te: 'in',
  tg: 'tj', th: 'th', tk: 'tm', tl: 'ph', tr: 'tr', uk: 'ua', ur: 'pk', uz: 'uz',
  vi: 'vn', xh: 'za', yi: 'il', yo: 'ng', zh: 'cn', zu: 'za',
};

// Rohwerte, die ApiFactory.normalizeLanguageName nicht in einen ISO-Namen übersetzt
const COUNTRY_BY_SPECIAL: Record<string, string> = {
  'pt-br': 'br',
  'portuguese brazil': 'br',
  'brazilian portuguese': 'br',
  'chinese simplified': 'cn',
  'chinese traditional': 'tw',
  zhs: 'cn',
  zht: 'tw',
  'ancient greek': 'gr',
  grc: 'gr',
};

const NO_LANGUAGE = 'no language';

const countryFor = (language: string): string | undefined => {
  const key = language.trim().toLowerCase();
  if (COUNTRY_BY_SPECIAL[key]) return COUNTRY_BY_SPECIAL[key];
  const code = ISO6391.validate(key) ? key : ISO6391.getCode(language.trim()).toLowerCase();
  return code ? COUNTRY_BY_LANGUAGE[code] : undefined;
};

interface LanguageFlagProps {
  language?: string;
  className?: string;
}

/** Kleines Sprachsymbol: Landesflagge, Phyrexia-Zeichen oder ein Kürzel als Rückfall. */
const LanguageFlag: React.FC<LanguageFlagProps> = ({ language, className }) => {
  const key = language?.trim().toLowerCase();
  if (!language || !key || key === NO_LANGUAGE) return null;
  const classes = `language-flag ${className ?? ''}`;

  if (key === 'phyrexian' || key === 'ph') {
    return <img src="/flags/phyrex.png" alt="Phyrexian" title="Phyrexian" className={`${classes} language-flag-phyrexian`} />;
  }
  const country = countryFor(language);
  if (country) {
    return <span role="img" aria-label={language} title={language} className={`${classes} fi fi-${country}`} />;
  }
  return (
    <span title={language} className={`${classes} language-flag-text`}>
      {language.slice(0, 2).toUpperCase()}
    </span>
  );
};

export default LanguageFlag;
