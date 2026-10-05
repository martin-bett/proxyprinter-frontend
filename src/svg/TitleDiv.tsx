import React from "react";

const CARD_SPACING = 45; // Abstand zwischen Karten
const HEIGHT = 140;
const LETTERS = ["P", "R", "O", "X", "Y", "P", "R", "I", "N", "T", "E", "R"];
// Verschiebung der ganzen Kette nach links (in px), damit links eine angeschnittene Karte steht
const LEFT_OFFSET = 30;
// Leere Karten je Seite; reicht für Fenster bis ca. 8000px Breite
const SIDE_CARDS = 90;

// Kette relativ zur Mitte: das innere SVG sitzt bei x=50%, alles darüber hinaus schneidet das äußere ab.
// So hängt nichts an einer gemessenen Breite (die unter html { zoom } je nach Browser abweicht).
const firstLetterX = -(LETTERS.length * CARD_SPACING) / 2 - LEFT_OFFSET;
const cards: { x: number; label: string }[] = [];
for (let j = -SIDE_CARDS; j < LETTERS.length + SIDE_CARDS; j++) {
  cards.push({ x: firstLetterX + j * CARD_SPACING, label: LETTERS[j] ?? "" });
}

const TitleDiv: React.FC = () => (
  <div className="headline">
    <svg
      width="100%"
      height={HEIGHT}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", overflow: "hidden", color: "var(--accent-strong)" }}
    >
      <svg x="50%" y="0" overflow="visible">
        {cards.map(({ x, label }, i) => (
          <g
            key={i}
            transform={`translate(${x},10) scale(0.7) rotate(10 50 80)`}
          >
            <rect
              x="10"
              y="20"
              width="80"
              height="120"
              rx="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            {label && (
              <text
                x={label === "I" ? 40 : 35}
                y="95"
                fontFamily="Arial Black"
                fontSize="48"
                fill="currentColor"
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </svg>
  </div>
);

export default TitleDiv;
