import React, { useLayoutEffect, useRef } from "react";

// Kleinste Schriftgröße relativ zur normalen Titelgröße, bevor umgebrochen wird
const MIN_FIT = 0.7;

interface CardTitleProps {
  name: string;
}

// Kartenname als Overlay oben auf dem Bild. Zu lange Namen werden erst kleiner
// (bis MIN_FIT), dann auf zwei Zeilen umgebrochen und erst danach mit "…" gekürzt.
const CardTitle: React.FC<CardTitleProps> = ({ name }) => {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    const box = text?.parentElement;
    if (!text || !box) return;

    const fit = () => {
      text.style.setProperty("--title-fit", "1");
      text.classList.remove("card-title-wrap");
      const available = text.clientWidth;
      const needed = text.scrollWidth;
      if (available <= 0 || needed <= available) return;
      // Textbreite wächst linear mit der Schriftgröße, eine Messung reicht
      const ratio = (available / needed) * 0.98;
      text.style.setProperty("--title-fit", String(Math.max(ratio, MIN_FIT)));
      if (ratio < MIN_FIT) text.classList.add("card-title-wrap");
    };

    fit();
    // Grid Size, Fenstergröße und nachgeladene Schriften ändern die verfügbare Breite
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(box);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => observer?.disconnect();
  }, [name]);

  return (
    <div className="card-title" title={name}>
      <span ref={textRef} className="card-title-text">{name}</span>
    </div>
  );
};

export default CardTitle;
