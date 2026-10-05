import React, { useRef, useState } from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { moveItem } from '../../viewer/filterPriority';
import './inputs.css';

export const PRIORITY_HINT = 'Drag to set the priority: the top entry wins, the ones below are fallbacks';

interface SortableListProps {
  items: string[];
  onReorder: (items: string[]) => void;
  /** handle wird in den Eintrag gesetzt, z. B. als trailing eines ChoiceButton */
  renderItem: (item: string, handle: React.ReactNode) => React.ReactNode;
  className?: string;
  handleTitle?: string;
}

/**
 * Liste, deren Einträge sich am Griff ⠿ verschieben lassen (Maus und Touch per Pointer-Events,
 * Tastatur mit Pfeil hoch/runter). Die Liste ordnet sich schon während des Ziehens um.
 */
const SortableList: React.FC<SortableListProps> = ({ items, onReorder, renderItem, className, handleTitle = PRIORITY_HINT }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [dragging, setDragging] = useState<string | null>(null);

  const moveTo = (item: string, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const current = itemsRef.current;
    // Ziel = Anzahl der anderen Einträge, deren Mitte über dem Zeiger liegt
    let target = 0;
    container.querySelectorAll<HTMLElement>(':scope > [data-sort-key]').forEach(element => {
      if (element.dataset.sortKey === item) return;
      const rect = element.getBoundingClientRect();
      if (rect.top + rect.height / 2 < clientY) target++;
    });
    const next = moveItem(current, current.indexOf(item), target);
    if (next !== current) {
      itemsRef.current = next;
      onReorder(next);
    }
  };

  const handleFor = (item: string) => {
    const index = items.indexOf(item);
    return (
      <span
        role="button"
        tabIndex={0}
        className="sort-handle"
        title={handleTitle}
        aria-label={`${handleTitle} (position ${index + 1} of ${items.length})`}
        onPointerDown={event => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          // Kein langer Klick und kein Umschalten des Eintrags
          event.stopPropagation();
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(item);
        }}
        onPointerMove={event => {
          if (dragging === item) moveTo(item, event.clientY);
        }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={event => {
          const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
          if (step === 0) return;
          event.preventDefault();
          event.stopPropagation();
          const next = moveItem(items, index, index + step);
          if (next !== items) onReorder(next);
        }}
      >
        <DragIndicatorIcon />
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`sortable-list ${dragging ? 'is-sorting' : ''} ${className ?? ''}`}>
      {items.map(item => (
        <div key={item} data-sort-key={item} className={`sortable-item ${dragging === item ? 'is-dragging' : ''}`}>
          {renderItem(item, handleFor(item))}
        </div>
      ))}
    </div>
  );
};

export default SortableList;

/** Kleine Rangnummer im Filtereintrag: 1 = bevorzugt, die weiteren sind Fallback. */
export const PriorityRank: React.FC<{ rank?: number }> = ({ rank }) =>
  // Zahl per CSS, damit sie nicht zum Text des Eintrags gehört
  rank ? <span className="priority-rank" data-rank={rank} title={rank === 1 ? 'Preferred' : `Fallback ${rank - 1}`} /> : null;
