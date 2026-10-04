import React, { useState } from 'react';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import { useAppTheme } from './ThemeContext';
import { AppTheme } from './themes';
import ManaSymbol from './ManaSymbol';
import '../viewer/cache/MemoryButtons.css';
import './ThemeChooser.css';

const Swatch: React.FC<{ theme: AppTheme }> = ({ theme }) => (
  <span className="theme-swatch" aria-hidden="true">
    <span style={{ background: `linear-gradient(0deg, ${theme.colors['app-bg-gradient-start']}, ${theme.colors['app-bg-gradient-end']})` }} />
    <span style={{ background: theme.colors.surface }} />
    <span style={{ background: theme.colors.accent }} />
  </span>
);

// Bubble oben links, im selben Stil wie die Cache-Bubbles oben rechts
const ThemeChooser: React.FC = () => {
  const { theme, themes, setThemeId } = useAppTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div className="theme-chooser-bar">
      <button
        className="memory-button theme-chooser-button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        title="Farbschema wählen"
        aria-haspopup="menu"
      >
        {theme.mana
          ? <ManaSymbol color={theme.mana} circle className="theme-chooser-mana" />
          : <PaletteIcon />}
        <span>{theme.name}</span>
      </button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {themes.map(t => (
          <MenuItem
            key={t.id}
            selected={t.id === theme.id}
            onClick={() => { setThemeId(t.id); setAnchorEl(null); }}
          >
            <ListItemIcon>
              <Swatch theme={t} />
              {t.mana
                ? <ManaSymbol color={t.mana} circle className="theme-chooser-mana" />
                : <span className="theme-chooser-mana theme-chooser-mana-empty" />}
            </ListItemIcon>
            <ListItemText>{t.name}</ListItemText>
            {t.id === theme.id && <CheckIcon fontSize="small" className="theme-chooser-check" />}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default ThemeChooser;
