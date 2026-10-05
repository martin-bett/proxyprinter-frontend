import React, { useRef, useEffect, useState } from "react";

const CARD_SPACING = 45; // Abstand zwischen Karten
const HEIGHT = 140;
const LETTERS = ["P", "R", "O", "X", "Y", "P", "R", "I", "N", "T", "E", "R"];
// Verschiebung der ganzen Kette nach links (in px), damit links eine angeschnittene Karte steht
const LEFT_OFFSET = 30;

const TitleDiv: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Buchstaben mittig, links und rechts so viele leere Karten, dass die Kette über beide Ränder hinausläuft
  const firstLetterX = Math.round(width / 2 - (LETTERS.length * CARD_SPACING) / 2) - LEFT_OFFSET;
  const cardsLeft = Math.ceil(firstLetterX / CARD_SPACING) + 2;
  const cardsRight = Math.ceil((width - firstLetterX) / CARD_SPACING) - LETTERS.length + 2;
  const cards: { x: number; label: string }[] = [];
  for (let j = -cardsLeft; j < LETTERS.length + cardsRight; j++) {
    cards.push({ x: firstLetterX + j * CARD_SPACING, label: LETTERS[j] ?? "" });
  }

  return (
    <div className="headline" ref={containerRef}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", overflow: "hidden", color: "var(--accent-strong)" }}
        >
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
      )}
    </div>
  );
};

export default TitleDiv;
