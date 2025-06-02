const DB_NAME = "mtg_search_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "searchResults";
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 Tage

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(entry) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(entry);
  return tx.complete;
}

async function getFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(cacheKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(cacheKey);
  return tx.complete;
}

async function clearAllFromIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return tx.complete;
}

class SearchCacheService {
  constructor() {}

  getSearchCacheKey(apiKey, cardName) {
    return `search:${apiKey}:${cardName}`;
  }

  // Async Methoden für den Such-Cache
  async getSearchResult(apiKey, cardName) {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    const entry = await getFromIndexedDB(cacheKey);
    if (entry && entry.timestamp && (Date.now() - entry.timestamp < MAX_AGE_MS)) {
      return entry.result;
    }
    // Optional: alten Eintrag entfernen, wenn zu alt
    if (entry) await deleteFromIndexedDB(cacheKey);
    return undefined;
  }

  async setSearchResult(apiKey, cardName, result) {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    await saveToIndexedDB({
      cacheKey,
      result,
      timestamp: Date.now(),
    });
  }

  async hasSearchResult(apiKey, cardName) {
    const cacheKey = this.getSearchCacheKey(apiKey, cardName);
    const entry = await getFromIndexedDB(cacheKey);
    return !!(entry && entry.timestamp && (Date.now() - entry.timestamp < MAX_AGE_MS));
  }

  // Bild-Cache bleibt im Speicher (optional: auch persistent machen)
  getImageCacheKey(cardName, position) {
    return `image:${cardName}:${position}`;
  }

  selectedImageCache = new Map();

  getSelectedImage(cardName, position) {
    return this.selectedImageCache.get(this.getImageCacheKey(cardName, position));
  }

  setSelectedImage(cardName, position, imageUrl) {
    this.selectedImageCache.set(this.getImageCacheKey(cardName, position), imageUrl);
  }

  hasSelectedImage(cardName, position) {
    return this.selectedImageCache.has(this.getImageCacheKey(cardName, position));
  }

  async clear() {
    await clearAllFromIndexedDB();
    this.selectedImageCache.clear();
  }
}

export default new SearchCacheService();