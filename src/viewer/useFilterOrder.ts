import { useCallback, useState } from 'react';
import { mergeOrder } from './filterPriority';

const STORAGE_PREFIX = 'filter-order:';

const readOrder = (key: string): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? '[]');
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Gespeicherte Reihenfolge einer Filtergruppe (Priorität), bleibt über Suchen und Neuladen erhalten.
 * reorder bekommt die neue Reihenfolge der gerade angezeigten Werte.
 */
const useFilterOrder = (key: string): [string[], (reordered: string[]) => void] => {
  const [order, setOrder] = useState<string[]>(() => readOrder(key));

  const reorder = useCallback((reordered: string[]) => {
    setOrder(prev => {
      const next = mergeOrder(prev, reordered);
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(next));
      } catch {
        // Ohne localStorage gilt die Reihenfolge nur bis zum Neuladen
      }
      return next;
    });
  }, [key]);

  return [order, reorder];
};

export default useFilterOrder;
