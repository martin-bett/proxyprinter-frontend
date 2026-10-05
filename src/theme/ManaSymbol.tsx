import React from 'react';
// Mana-Symbole von Andrew Gioia (https://mana.andrewgioia.com), npm-Paket mana-font.
// Font: SIL OFL 1.1, CSS: MIT. Symbole © Wizards of the Coast.
import 'mana-font/css/mana.css';

// W/U/B/R/G = Farben, P = Phyrexia
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'P';

interface ManaSymbolProps {
  color: ManaColor;
  className?: string;
  // Kreis wie auf den Karten (true) oder nur das Symbol in currentColor (false)
  circle?: boolean;
  style?: React.CSSProperties;
}

const ManaSymbol: React.FC<ManaSymbolProps> = ({ color, className, circle = false, style }) => (
  <i
    className={['ms', `ms-${color.toLowerCase()}`, circle ? 'ms-cost' : '', className].filter(Boolean).join(' ')}
    style={style}
    aria-hidden="true"
  />
);

export default ManaSymbol;
