import React, { useRef, useEffect, useState } from "react";

const CARD_WIDTH = 56; // 80 * 0.7
const CARD_SPACING = 45; // Abstand zwischen Karten
const CARD_COUNT_CENTER = 13; // Anzahl der Karten mit Buchstaben (PROXYP RINTER)
const CARD_LABELS = [
  "", "", "", "", "", // Platzhalter für links
  "P", "R", "O", "X", "Y", "P", "R", "I", "N", "T", "E", "R",
  "", "", "", "", "" // Platzhalter für rechts
];

function getCardLabels(total, centerLabels) {
  // Füllt links/rechts mit "" und zentriert die Buchstaben
  const side = Math.floor((total - centerLabels.length) / 2);
  return [
    ...Array(side).fill(""),
    ...centerLabels,
    ...Array(total - side - centerLabels.length).fill("")
  ];
}

const TitleDiv = () => {
  const containerRef = useRef(null);
  const [cardCount, setCardCount] = useState(25);

  useEffect(() => {
    function updateCardCount() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth || window.innerWidth;
      // Berechne wie viele Karten reinpassen
      const count = Math.ceil(width / CARD_SPACING) + 2; // +2 für Rand
      setCardCount(count);
    }
    updateCardCount();
    window.addEventListener("resize", updateCardCount);
    return () => window.removeEventListener("resize", updateCardCount);
  }, []);

  const labels = getCardLabels(cardCount, [
    "P", "R", "O", "X", "Y", "P", "R", "I", "N", "T", "E", "R"
  ]);

  return (
    <div className="headline" ref={containerRef} style={{ width: "100%" }}>
      <svg
        width="100%"
        height="140"
        viewBox={`0 0 ${cardCount * CARD_SPACING} 140`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {labels.map((label, i) => (
          <g
            key={i}
            transform={`translate(${i * CARD_SPACING},10) scale(0.7) rotate(10 50 80)`}
          >
            <rect
              x="10"
              y="20"
              width="80"
              height="120"
              rx="10"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            {label && (
              <text
                x={label === "I" ? 40 : 35}
                y="95"
                fontFamily="Arial Black"
                fontSize="48"
                fill="black"
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default TitleDiv;