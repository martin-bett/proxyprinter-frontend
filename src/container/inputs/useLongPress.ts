import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Wie lange ein Feld gedrückt gehalten werden muss, bis der lange Klick auslöst. */
export const LONG_PRESS_MS = 2000;

/** Tooltip für Filter, die per langem Klick nur einen Eintrag auswählen. */
export const ONLY_THIS_HINT = 'Hold for 2 seconds to show only this one';

/**
 * Langer Klick (Maus und Touch) auf einem Element. Nach dem Auslösen wird der folgende
 * normale Klick verschluckt, damit z.B. eine Checkbox nicht zusätzlich umschaltet.
 * Ohne Callback liefert der Hook keine Handler und das Element verhält sich wie gehabt.
 */
const useLongPress = (onLongPress?: () => void, delay = LONG_PRESS_MS) => {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPressing(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  if (!onLongPress) return { pressing: false, handlers: {} };

  const handlers = {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      cancel();
      fired.current = false;
      setPressing(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        setPressing(false);
        onLongPress();
      }, delay);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    // Touch: Scrollen bricht den Druck ab
    onPointerCancel: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (fired.current) {
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    // Touch: kein Kontextmenü beim Gedrückthalten
    onContextMenu: (event: React.MouseEvent) => {
      if (timer.current !== null || fired.current) event.preventDefault();
    },
  };

  return { pressing, handlers };
};

export default useLongPress;
