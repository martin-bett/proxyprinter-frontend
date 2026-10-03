import React from 'react';
import './LanguageFlag.css';

// Flaggen aus flag-icons (MIT, siehe public/flags/LICENSE-flag-icons.txt). Schlüssel sind die
// normalisierten Sprachnamen aus ApiFactory.normalizeLanguageName plus ein paar Rohcodes.
const FLAG_BY_LANGUAGE: Record<string, string> = {
  english: 'gb',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  'pt-br': 'br',
  'portuguese brazil': 'br',
  japanese: 'jp',
  korean: 'kr',
  russian: 'ru',
  chinese: 'cn',
  'chinese simplified': 'cn',
  'chinese traditional': 'tw',
  zhs: 'cn',
  zht: 'tw',
  hebrew: 'il',
  latin: 'va',
  greek: 'gr',
  'ancient greek': 'gr',
  arabic: 'sa',
  sanskrit: 'in',
};

const NO_LANGUAGE = 'no language';

interface LanguageFlagProps {
  language?: string;
  className?: string;
}

/** Kleines Sprachsymbol: Landesflagge, Phyrexia-Zeichen oder ein Kürzel als Rückfall. */
const LanguageFlag: React.FC<LanguageFlagProps> = ({ language, className }) => {
  const key = language?.trim().toLowerCase();
  if (!key || key === NO_LANGUAGE) return null;
  const classes = `language-flag ${className ?? ''}`;

  if (key === 'phyrexian' || key === 'ph') {
    return <img src="/flags/phyrex.png" alt="Phyrexian" title="Phyrexian" className={`${classes} language-flag-phyrexian`} />;
  }
  const flag = FLAG_BY_LANGUAGE[key];
  if (flag) {
    return <img src={`/flags/${flag}.svg`} alt={language} title={language} className={classes} />;
  }
  return (
    <span title={language} className={`${classes} language-flag-text`}>
      {language!.slice(0, 2).toUpperCase()}
    </span>
  );
};

export default LanguageFlag;
