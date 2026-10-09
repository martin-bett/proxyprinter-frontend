import { useEffect, useState } from 'react';

/**
 * Blendet ein Element weich ein und aus: `mounted` sagt, ob es im DOM sein muss,
 * `shown` schaltet die sichtbare CSS-Klasse (Transition) um.
 */
export function useFadePresence(visible: boolean, fadeMs = 500): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Erst nach dem ersten Paint einblenden, sonst startet die Transition nicht
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timeout = setTimeout(() => setMounted(false), fadeMs);
    return () => clearTimeout(timeout);
  }, [visible, fadeMs]);

  return { mounted, shown };
}
