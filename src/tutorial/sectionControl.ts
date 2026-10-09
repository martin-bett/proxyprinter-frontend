// Fernsteuerung für CollapsibleSection: Tutorials klappen Abschnitte über ihren storageKey auf und zu,
// ohne dass DeckInputAndViewer davon wissen muss.

const EVENT = 'collapsible-section:set-open';

interface SetOpenDetail {
  key: string;
  open: boolean;
}

export const setSectionOpen = (key: string, open: boolean) => {
  window.dispatchEvent(new CustomEvent<SetOpenDetail>(EVENT, { detail: { key, open } }));
};

/** Aktueller Zustand eines Abschnitts, sofern er im DOM steht */
export const isSectionOpen = (key: string): boolean | undefined => {
  const section = document.querySelector(`[data-section="${key}"]`);
  return section ? section.classList.contains('is-open') : undefined;
};

/** Meldet sich für Befehle an einen Abschnitt an; gibt die Abmeldung zurück */
export const onSectionSetOpen = (key: string, handler: (open: boolean) => void) => {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<SetOpenDetail>;
    if (detail.key === key) handler(detail.open);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
