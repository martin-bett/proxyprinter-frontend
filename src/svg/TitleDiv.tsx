import React, { useId } from "react";

const CARD_SPACING = 45; // Abstand zwischen Karten
const HEIGHT = 140;
const LETTERS = ["P", "R", "O", "X", "Y", "P", "R", "I", "N", "T", "E", "R"];
// Verschiebung der ganzen Kette nach links (in px), damit links eine angeschnittene Karte steht
const LEFT_OFFSET = 30;
// Leere Karten je Seite; reicht für Fenster bis ca. 8000px Breite
const SIDE_CARDS = 90;
// Kartenplätze (Index in LETTERS) für die Prozentanzeige: Ziffern rechtsbündig, "%" immer auf der letzten
const PERCENT_SLOTS = [4, 5, 6, 7];

// Kette relativ zur Mitte: das innere SVG sitzt bei x=50%, alles darüber hinaus schneidet das äußere ab.
// So hängt nichts an einer gemessenen Breite (die unter html { zoom } je nach Browser abweicht).
const firstLetterX = -(LETTERS.length * CARD_SPACING) / 2 - LEFT_OFFSET;
const cardIndexes: number[] = [];
for (let j = -SIDE_CARDS; j < LETTERS.length + SIDE_CARDS; j++) cardIndexes.push(j);

function labelsFor(progress: number | null): string[] {
  if (progress === null) return LETTERS;
  const chars = `${Math.round(progress)}%`.split("");
  const labels: string[] = LETTERS.map(() => "");
  const start = PERCENT_SLOTS.length - chars.length;
  chars.forEach((c, i) => { labels[PERCENT_SLOTS[start + i]] = c; });
  return labels;
}

function labelX(label: string): number {
  if (label === "I" || label === "1") return 40;
  if (label === "%") return 28;
  return 35;
}

const Card: React.FC<{ x: number; label: string; filled?: boolean }> = ({ x, label, filled }) => (
  <g transform={`translate(${x},10) scale(0.7) rotate(10 50 80)`}>
    <rect
      x="10"
      y="20"
      width="80"
      height="120"
      rx="10"
      fill={filled ? "currentColor" : "none"}
      // Gefüllte Karten überlappen; ein Rand in Hintergrundfarbe hält sie auseinander
      style={{ stroke: filled ? "var(--app-bg)" : "currentColor" }}
      strokeWidth={filled ? 3 : 2}
    />
    {label && (
      <text
        x={labelX(label)}
        y="95"
        fontFamily="Arial Black"
        fontSize="48"
        style={{ fill: filled ? "var(--app-bg)" : "currentColor" }}
      >
        {label}
      </text>
    )}
  </g>
);

interface TitleDivProps {
  // Fortschritt 0..100 einer laufenden Aktion; null = Ruhezustand mit "PROXYPRINTER"
  progress?: number | null;
}

// Die Kartenkette ist zugleich Fortschrittsbalken: eine zweite, gefüllte Kette liegt darüber und wird
// von links bis progress% der Bildschirmbreite freigegeben. Buchstaben darin erscheinen invertiert.
const TitleDiv: React.FC<TitleDivProps> = ({ progress = null }) => {
  const clipId = useId();
  const running = progress !== null;
  const value = running ? Math.max(0, Math.min(100, progress)) : 0;
  const labels = labelsFor(running ? value : null);
  const chain = (filled: boolean) => (
    <svg x="50%" y="0" overflow="visible">
      {cardIndexes.map(j => (
        <Card key={j} x={firstLetterX + j * CARD_SPACING} label={labels[j] ?? ""} filled={filled} />
      ))}
    </svg>
  );

  return (
    <div
      className="headline"
      role={running ? "progressbar" : undefined}
      aria-valuemin={running ? 0 : undefined}
      aria-valuemax={running ? 100 : undefined}
      aria-valuenow={running ? Math.round(value) : undefined}
    >
      <svg
        width="100%"
        height={HEIGHT}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", overflow: "hidden", color: "var(--accent-strong)" }}
      >
        {chain(false)}
        {running && (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect className="headline-progress-clip" x="0" y="0" height="100%" style={{ width: `${value}%` }} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>{chain(true)}</g>
          </>
        )}
      </svg>
    </div>
  );
};

export default TitleDiv;
