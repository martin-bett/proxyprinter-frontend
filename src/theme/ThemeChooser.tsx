import React, { useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from './ThemeContext';
import { AppTheme } from './themes';
import ManaSymbol from './ManaSymbol';
import '../viewer/cache/MemoryButtons.css';
import './ThemeChooser.css';

// Darstellung der Mana-Kreise: 'vivid' = sattere Kreisfarben, 'ring' = blasse Originalfarben mit dunklem Rand
export type ManaChooserStyle = 'vivid' | 'ring';
export const MANA_CHOOSER_STYLE: ManaChooserStyle = 'vivid';

// Phyrexia hat keine eigene Manafarbe: Symbol in der Akzentfarbe des Themes auf dessen dunkler Fläche
const manaStyle = (t: AppTheme): React.CSSProperties | undefined =>
  t.mana === 'P' ? { color: t.colors.accent, backgroundColor: t.colors['app-bg'] } : undefined;

const ThemeIcon: React.FC<{ theme: AppTheme; size: 'button' | 'menu' }> = ({ theme, size }) =>
  theme.mana
    ? <ManaSymbol
        color={theme.mana}
        circle
        className={`theme-chooser-mana theme-chooser-mana-${size} mana-style-${MANA_CHOOSER_STYLE}`}
        style={manaStyle(theme)}
      />
    : <PaletteIcon />;

// Bubble oben links, im selben Stil wie die Cache-Bubbles oben rechts; nur Symbole, Namen als Tooltip
const ThemeChooser: React.FC = () => {
  const { t } = useTranslation();
  const { theme, themes, setThemeId } = useAppTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div className="theme-chooser-bar">
      <button
        className="memory-button theme-chooser-button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        title={t('themeChooser.title', { name: theme.name })}
        aria-label={t('themeChooser.aria', { name: theme.name })}
        aria-haspopup="menu"
      >
        <ThemeIcon theme={theme} size="button" />
      </button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ className: 'theme-chooser-menu' }}
      >
        {themes.map(th => (
          <MenuItem
            key={th.id}
            selected={th.id === theme.id}
            className="theme-chooser-item"
            title={th.name}
            aria-label={th.name}
            onClick={() => { setThemeId(th.id); setAnchorEl(null); }}
          >
            <ThemeIcon theme={th} size="menu" />
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default ThemeChooser;
