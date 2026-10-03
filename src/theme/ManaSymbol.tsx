import React from 'react';

// Vereinfachte, selbst gezeichnete Mana-Symbole (100x100), gefüllt mit currentColor.
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

const sunRays = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const tip = (r: number, da: number) =>
    `${(50 + r * Math.sin(a + da)).toFixed(2)},${(50 - r * Math.cos(a + da)).toFixed(2)}`;
  return `M${tip(46, 0)} L${tip(26, 0.22)} L${tip(26, -0.22)} Z`;
}).join(' ');

const GLYPHS: Record<ManaColor, React.ReactNode> = {
  // Sonne
  W: <>
    <circle cx="50" cy="50" r="19" />
    <path d={sunRays} />
  </>,
  // Wassertropfen
  U: <path d="M50 6 C44 22 20 46 20 64 A30 30 0 0 0 80 64 C80 46 56 22 50 6 Z M36 62 A14 14 0 0 0 46 80 A18 18 0 0 1 36 62 Z" fillRule="evenodd" />,
  // Totenkopf
  B: <path
    fillRule="evenodd"
    d="M50 8 C28 8 14 24 14 44 C14 56 20 64 28 68 L28 82 C28 86 31 89 35 89 L65 89 C69 89 72 86 72 82 L72 68 C80 64 86 56 86 44 C86 24 72 8 50 8 Z
       M25 44 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z M53 44 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z
       M50 56 L44 66 L56 66 Z
       M40 76 L44 76 L44 89 L40 89 Z M48 76 L52 76 L52 89 L48 89 Z M56 76 L60 76 L60 89 L56 89 Z"
  />,
  // Flamme
  R: <path
    fillRule="evenodd"
    d="M54 4 C58 22 76 32 78 56 C80 78 66 94 50 94 C32 94 20 80 22 62 C23 50 30 42 34 34 C36 44 40 48 44 50 C42 34 46 18 54 4 Z
       M50 88 C60 88 66 80 64 70 C62 62 56 58 54 50 C50 58 42 62 40 72 C38 82 44 88 50 88 Z"
  />,
  // Baum
  G: <path d="M50 4 C38 4 30 12 30 22 C20 24 14 32 14 42 C14 54 24 62 36 62 L44 62 L44 82 L34 94 L66 94 L56 82 L56 62 L64 62 C76 62 86 54 86 42 C86 32 80 24 70 22 C70 12 62 4 50 4 Z" />,
};

// Hintergrundfarben der Mana-Kreise, wie auf den Karten
export const MANA_CIRCLE: Record<ManaColor, string> = {
  W: '#f8f3d6',
  U: '#b3ceea',
  B: '#c3b9b4',
  R: '#eb9f82',
  G: '#9bd3ae',
};

interface ManaSymbolProps {
  color: ManaColor;
  className?: string;
  // Kreis wie auf den Karten (true) oder nur das Symbol (false)
  circle?: boolean;
  style?: React.CSSProperties;
}

const ManaSymbol: React.FC<ManaSymbolProps> = ({ color, className, circle = false, style }) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true" focusable="false">
    {circle ? (
      <>
        <circle cx="50" cy="50" r="50" style={{ fill: MANA_CIRCLE[color] }} />
        <g transform="translate(18 18) scale(0.64)" style={{ fill: '#1a1410' }}>{GLYPHS[color]}</g>
      </>
    ) : (
      <g style={{ fill: 'currentColor' }}>{GLYPHS[color]}</g>
    )}
  </svg>
);

export default ManaSymbol;
