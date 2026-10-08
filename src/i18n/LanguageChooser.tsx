import React, { useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import 'flag-icons/css/flag-icons.min.css';
import { changeUiLanguage, UI_LANGUAGES } from './index';
import '../viewer/cache/MemoryButtons.css';
import './LanguageChooser.css';

// Bubble next to the "?" help bubble: flag of the current interface language, menu lists all languages.
// Only affects the interface texts, not the card languages or the image filters.
const LanguageChooser: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const current = UI_LANGUAGES.find(l => l.code === i18n.language) ?? UI_LANGUAGES[0];

  return (
    <>
      <button
        className="memory-button language-chooser-button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        title={t('language.title', { name: current.name })}
        aria-label={t('language.aria', { name: current.name })}
        aria-haspopup="menu"
      >
        <span className={`fi fi-${current.country} language-chooser-flag`} />
      </button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ className: 'language-chooser-menu', subheader: <li className="language-chooser-hint">{t('language.hint')}</li> }}
      >
        {UI_LANGUAGES.map(l => (
          <MenuItem
            key={l.code}
            selected={l.code === current.code}
            onClick={() => { void changeUiLanguage(l.code); setAnchorEl(null); }}
          >
            <span className={`fi fi-${l.country} language-chooser-flag`} />
            {l.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageChooser;
