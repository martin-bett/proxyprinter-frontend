import React, { useEffect, useId, useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import './inputs.css';

interface CollapsibleSectionProps {
  // Schlüssel für localStorage, damit der Zustand ein Neuladen übersteht.
  // Ohne Schlüssel startet der Abschnitt immer mit defaultOpen.
  storageKey?: string;
  title: React.ReactNode;
  // Kurzinfo rechts im Header, nur im zugeklappten Zustand sichtbar (z. B. "4 / 9")
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  // Optionaler Zusatz-Button rechts im Header (z. B. Zahnrad), getrennt durch eine Kante
  action?: {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
  };
  className?: string;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'section-open:';

const readOpen = (key: string | undefined, fallback: boolean): boolean => {
  if (!key) return fallback;
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    return saved === null ? fallback : saved === 'true';
  } catch {
    return fallback;
  }
};

// Einklappbarer Abschnitt: Header im Button-Stil mit Pfeil links statt Haken
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  storageKey, title, summary, defaultOpen = true, action, className, children,
}) => {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));
  const bodyId = useId();

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, String(open));
    } catch {
      // Ohne localStorage bleibt der Zustand nur bis zum Neuladen erhalten
    }
  }, [storageKey, open]);

  return (
    <section className={`collapsible-section ${open ? 'is-open' : ''} ${className ?? ''}`}>
      <div className="input-tile collapsible-header">
        <button
          type="button"
          className="collapsible-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(o => !o)}
        >
          <span className="input-tile-lead" aria-hidden="true">
            <KeyboardArrowDownIcon className="collapsible-arrow" />
          </span>
          <span className="input-tile-title">{title}</span>
          {!open && summary !== undefined && summary !== null && summary !== '' && (
            <span className="collapsible-summary">{summary}</span>
          )}
        </button>
        {action && (
          <button
            type="button"
            className="collapsible-action"
            title={action.title}
            aria-label={action.title}
            onClick={action.onClick}
          >
            {action.icon}
          </button>
        )}
      </div>
      <div id={bodyId} className="collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
};

export default CollapsibleSection;
