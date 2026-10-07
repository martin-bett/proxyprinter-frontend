import React, { useEffect, useRef, useState } from "react";
import { CardResult } from "../../api/types/types";
import { useProxiedImage } from "../../container/CropImageOverlay";

const HOVER_DELAY_MS = 1000;
// Bewegung bis zu so vielen Pixeln gilt noch als Stillstand
const STILL_TOLERANCE_PX = 6;
const MAX_VIEWPORT_FRACTION = 0.8;
const CURSOR_GAP = 16;

const Popup: React.FC<{ card: CardResult; x: number; y: number }> = ({ card, x, y }) => {
  const { imageSrc, previewSrc } = useProxiedImage(card);
  const src = imageSrc || previewSrc;
  if (!src) return null;
  const maxH = Math.round(window.innerHeight * MAX_VIEWPORT_FRACTION);
  const maxW = Math.round(window.innerWidth * 0.4);
  // Rechts vom Zeiger, bei Platzmangel links davon
  const left = x + CURSOR_GAP + maxW > window.innerWidth ? Math.max(0, x - CURSOR_GAP - maxW) : x + CURSOR_GAP;
  const top = Math.min(Math.max(0, y - maxH / 2), window.innerHeight - maxH);
  return (
    <div className="hover-preview" style={{ left, top, maxWidth: maxW, maxHeight: maxH }}>
      <img src={src} alt={card.name} style={{ maxWidth: maxW, maxHeight: maxH }} />
    </div>
  );
};

/** Zeigt nach 1 s Stillstand der Maus eine unverkleinerte, in der Größe begrenzte Vorschau des Bildes. */
const HoverPreview: React.FC<{ card: CardResult; children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  card, children, className, onClick,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const last = useRef({ x: 0, y: 0 });

  const stop = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  const arm = (x: number, y: number) => {
    window.clearTimeout(timer.current);
    last.current = { x, y };
    timer.current = window.setTimeout(() => setPos({ x, y }), HOVER_DELAY_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className={className}
      onClick={() => { stop(); onClick?.(); }}
      onMouseEnter={(e) => arm(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        const moved = Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) > STILL_TOLERANCE_PX;
        if (!moved) return;
        if (pos) setPos(null);
        arm(e.clientX, e.clientY);
      }}
      onMouseLeave={stop}
    >
      {children}
      {pos && <Popup card={card} x={pos.x} y={pos.y} />}
    </div>
  );
};

export default HoverPreview;
