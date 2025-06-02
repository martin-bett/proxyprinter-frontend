import { CardEntrySelection } from '../ApiFactory.js';

export class CardSelectionService {
  constructor() {
    this.entries = new Map();
    this.uniquePrints = false; // global
  }

  makeKey(name, selectionCategory) {
    return `${name}:${selectionCategory}`;
  }

  setEntry(entry) {
    this.entries.set(this.makeKey(entry.name, entry.selectionCategory), entry);
  }

  getEntry(name, selectionCategory) {
    return this.entries.get(this.makeKey(name, selectionCategory));
  }

  getAllEntries() {
    return Array.from(this.entries.values());
  }

  setSelectedIndexes(name, selectionCategory, selectedIndexes) {
    const entry = this.getEntry(name, selectionCategory);
    if (entry) {
      entry.selectedIndexes = selectedIndexes;
      this.setEntry(entry);
    }
  }

  setCount(name, selectionCategory, count) {
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

  setUniquePrints(unique) {
    this.uniquePrints = unique;
    // Alle Einträge anpassen
    this.entries.forEach(entry => {
      if (unique) {
        // Jeder Print nur einmal auswählbar, maximal so viele wie results
        entry.selectedIndexes = Array.from({ length: Math.min(entry.count, entry.results.length) }, (_, i) => i);
      } else {
        // Standard: alle auf das erste Bild
        entry.selectedIndexes = Array(entry.count).fill(0);
      }
      this.setEntry(entry);
    });
  }

  clear() {
    this.entries.clear();
  }
}

export const cardSelectionService = new CardSelectionService();