/**
 * Adjusts selection arrays when card count changes.
 * When count increases, new entries inherit from the first entry.
 * When count decreases, excess entries are removed from the end.
 */
export const adjustSelectionForCountChange = <T,>(
  currentArray: (T | null)[] | undefined,
  oldCount: number,
  newCount: number
): (T | null)[] => {
  if (oldCount === newCount) {
    return currentArray || [];
  }

  const current = currentArray || [];
  const diff = newCount - oldCount;

  if (diff > 0) {
    // Increasing count: inherit from first entry
    const firstEntry = current[0] || null;
    return [...current, ...Array(diff).fill(firstEntry)];
  } else {
    // Decreasing count: remove from end
    return current.slice(0, newCount);
  }
};
