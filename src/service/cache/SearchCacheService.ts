import { SearchResult } from '../ApiFactory';
import { openCacheDb } from './openCacheDb';

const DB_NAME = "mtg_search_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "searchResults";
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 Tage

export interface SearchApiResult {
  results: SearchResult[];
  rawResponse: string;
}

interface SearchCacheDbEntry {
  cacheKey: string;
  result: SearchApiResult;
  timestamp: number;
  apiKey?: string;
  cardName?: string;
}

export interface SearchCacheEntryInfo {
  apiKey: string;
  cardName: string;
  size: number;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return openCacheDb(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
    }
  });
}

async function saveToIndexedDB(entry: SearchCacheDbEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(entry);
}

async function getFromIndexedDB(cacheKey: string): Promise<SearchCacheDbEntry | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(cacheKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromIndexedDB(): Promise<SearchCacheDbEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromIndexedDB(cacheKey: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(cacheKey);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllFromIndexedDB(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
}

class SearchCacheService {
  private selectedImageCache: Map<string, string> = new Map();

  getSearchCacheKey(apiKey: string, cardName: string): string {
    return `search:${apiKey}:${cardName}`;
  }

  // Async Methoden für den Such-Cache
  async getSearchResult(apiKey: string, cardName: string): Promise<SearchApiResult | undefined> {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    const entry = await getFromIndexedDB(cacheKey);
    if (entry && entry.timestamp && (Date.now() - entry.timestamp < MAX_AGE_MS)) {
      return entry.result;
    }
    // Optional: alten Eintrag entfernen, wenn zu alt
    if (entry) await deleteFromIndexedDB(cacheKey);
    return undefined;
  }

  async setSearchResult(apiKey: string, cardName: string, result: SearchApiResult): Promise<void> {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    await saveToIndexedDB({
      cacheKey,
      result,
      timestamp: Date.now(),
      apiKey,
      cardName,
    });
  }

  async hasSearchResult(apiKey: string, cardName: string): Promise<boolean> {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    const entry = await getFromIndexedDB(cacheKey);
    return !!(entry && entry.timestamp && (Date.now() - entry.timestamp < MAX_AGE_MS));
  }

  // Bild-Cache bleibt im Speicher (optional: auch persistent machen)
  getImageCacheKey(cardName: string, position: number): string {
    return `image:${cardName}:${position}`;
  }

  getSelectedImage(cardName: string, position: number): string | undefined {
    return this.selectedImageCache.get(this.getImageCacheKey(cardName, position));
  }

  setSelectedImage(cardName: string, position: number, imageUrl: string): void {
    this.selectedImageCache.set(this.getImageCacheKey(cardName, position), imageUrl);
  }

  hasSelectedImage(cardName: string, position: number): boolean {
    return this.selectedImageCache.has(this.getImageCacheKey(cardName, position));
  }

  // Alle gültigen Suchen als { [apiKey]: { [cardName]: info } }
  async getAllSearches(): Promise<Record<string, Record<string, SearchCacheEntryInfo>>> {
    const all = await getAllFromIndexedDB();
    const grouped: Record<string, Record<string, SearchCacheEntryInfo>> = {};
    for (const entry of all) {
      if (!entry.timestamp || Date.now() - entry.timestamp >= MAX_AGE_MS) continue;
      const parsed = this.parseSearchCacheKey(entry);
      if (!parsed) continue;
      const { apiKey, cardName } = parsed;
      if (!grouped[apiKey]) grouped[apiKey] = {};
      grouped[apiKey][cardName] = {
        apiKey,
        cardName,
        size: entry.result?.results?.length || 0,
        timestamp: entry.timestamp,
      };
    }
    return grouped;
  }

  async getSearchCount(): Promise<number> {
    const all = await getAllFromIndexedDB();
    return all.filter(entry => entry.timestamp && Date.now() - entry.timestamp < MAX_AGE_MS).length;
  }

  async removeSearch(apiKey: string, cardName: string): Promise<void> {
    await deleteFromIndexedDB(this.getSearchCacheKey(apiKey, cardName));
  }

  // Ältere Einträge haben apiKey/cardName nicht gespeichert, dann aus dem cacheKey lesen
  private parseSearchCacheKey(entry: SearchCacheDbEntry): { apiKey: string; cardName: string } | null {
    if (entry.apiKey && entry.cardName) return { apiKey: entry.apiKey, cardName: entry.cardName };
    const match = /^search:([^:]*):(.*)$/.exec(entry.cacheKey);
    return match ? { apiKey: match[1], cardName: match[2] } : null;
  }

  async clear(): Promise<void> {
    await clearAllFromIndexedDB();
    this.selectedImageCache.clear();
  }
}

const searchCacheService = new SearchCacheService();
export default searchCacheService;
