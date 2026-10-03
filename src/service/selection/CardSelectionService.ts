import { CardEntrySelection } from '../ApiFactory';

export class CardSelectionService {
  private entries: Map<string, CardEntrySelection> = new Map();
  private uniquePrints: boolean = false; // global

  makeKey(name: string, selectionCategory: string): string {
    return `${name}:${selectionCategory}`;
  }

  setEntry(entry: CardEntrySelection): void {
    this.entries.set(this.makeKey(entry.name, entry.selectionCategory), entry);
  }

  getEntry(name: string, selectionCategory: string): CardEntrySelection | undefined {
    return this.entries.get(this.makeKey(name, selectionCategory));
  }

  getAllEntries(): CardEntrySelection[] {
    return Array.from(this.entries.values());
  }

  setSelectedIndexes(name: string, selectionCategory: string, selectedIndexes: number[]): void {
    const entry = this.getEntry(name, selectionCategory);
    if (entry) {
      entry.selectedIndexes = selectedIndexes;
      this.setEntry(entry);
    }
  }

  setCount(name: string, selectionCategory: string, count: number): void {
    const entry = this.getEntry(name, selectionCategory);
    if (entry) {
      entry.count = count;
      // selectedIndexes ggf. anpassen
      if (entry.selectedIndexes.length > count) {
        entry.selectedIndexes = entry.selectedIndexes.slice(0, count);
      } else {
        while (entry.selectedIndexes.length < count) {
          entry.selectedIndexes.push(0); // Default: erstes Bild
        }
      }
      this.setEntry(entry);
    }
  }

  setUniquePrints(unique: boolean): void {
    this.uniquePrints = unique;
    // Alle Einträge anpassen
    this.entries.forEach(entry => {
      if (unique) {
        // Jeder Print nur einmal auswählbar, maximal so viele wie results
        entry.selectedIndexes = Array.from(
          { length: Math.min(entry.count, entry.results.length) },
          (_, i) => i
        );
      } else {
        // Standard: alle auf das erste Bild
        entry.selectedIndexes = Array(entry.count).fill(0);
      }
      this.setEntry(entry);
    });
  }

  isUniquePrints(): boolean {
    return this.uniquePrints;
  }

  clear(): void {
    this.entries.clear();
  }
}

export const cardSelectionService = new CardSelectionService();
