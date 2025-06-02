const DB_NAME = "mtg_cache_db";
const DB_VERSION = 2;
const STORE_NAME = "images";

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

async function deleteFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(cacheKey);
  return tx.complete;
}

async function clearIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return tx.complete;
}

async function getAllFromIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

class ImageLoaderService {

  constructor(maxConcurrent = 10) {
    this.queue = [];
    this.activeLoads = 0;
    this.maxConcurrent = maxConcurrent;
    this.subscribers = new Set();
    this._lastSnapshot = null;
    this.cacheLimit = 1024 * 1024 * 1024; // 1 GB
    // kein this.cache mehr!
    this._initPersistentCache();
  }

  async _initPersistentCache() {
    await this._enforceCacheLimit();
    this.notifySubscribers();
  }

  setCacheLimit(newLimit) {
    this.cacheLimit = newLimit;
    this._enforceCacheLimit();
    this.notifySubscribers();
  }

  async _enforceCacheLimit() {
    const entries = await getAllFromIndexedDB();
    let total = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
    if (total <= this.cacheLimit) return;
    // Sortiere nach ältestem timestamp
    entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    for (const entry of entries) {
      await deleteFromIndexedDB(entry.cacheKey);
      total -= entry.sizeBytes || 0;
      if (total <= this.cacheLimit) break;
    }
  }

  _makeCacheKey(cardInput) {
    return `${cardInput.apiName || "NOAPI"}::${cardInput.name || "NONAME"}::${cardInput.imageUrl || ""}`;
  }

  async addToQueue({ url, priority, onLoad, onError, onProcessListChange, category, cardInput }) {
    const cacheKey = this._makeCacheKey(cardInput || {});
    const cached = await getFromIndexedDB(cacheKey);
    if (cached) {
      // Wenn img noch nicht geladen, aus Blob erzeugen
      if (cached.blob) {
        this._createImageFromBlob(cached.blob).then(img => {
          if (img) {
            onLoad(img, cached.sizeBytes);
          } else {
            onError?.(new Error("Image could not be created from blob"));
          }
        });
      } else {
        // Fallback: Bild-URL laden
        this._createImageFromUrl(cached.imageUrl).then(img => {
          if (img) {
            onLoad(img, cached.sizeBytes);
          } else {
            onError?.(new Error("Image could not be loaded from url"));
          }
        });
      }
      onProcessListChange?.("LOADING");
      return;
    }

    const existingEntry = this.queue.find((entry) => this._makeCacheKey(entry.cardInput) === cacheKey);
    if (existingEntry) {
      existingEntry.priority = Math.max(existingEntry.priority, priority);
      existingEntry.onLoad = this.mergeCallbacks(existingEntry.onLoad, onLoad);
      existingEntry.onError = this.mergeCallbacks(existingEntry.onError, onError);
      if (category) existingEntry.category = category;
      this.queue.sort((a, b) => b.priority - a.priority);
      this.notifyAllStatuses();
      return;
    }

    this.queue.push({ url, priority, onLoad, onError, onProcessListChange, category, cardInput });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.notifyAllStatuses();
    this.processQueue();
  }

  stopForFilters(visibleLanguages, visibleApis) {
    this.queue = this.queue.filter(entry => {
      const { cardInput } = entry;
      const language = cardInput.languageCode || 'No Language';
      return visibleLanguages.has(language) && visibleApis.has(cardInput.apiName);
    });
    this.notifyAllStatuses();
    console.log('stoped filters :', this.queue.length);
  }

  stopByCategory(category) {
    this.queue = this.queue.filter((entry) => entry.category !== category);
    this.notifyAllStatuses();
    console.log('stoped category :' + category, this.queue.length);
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notifySubscribers() {
    console.log("notifySubscribers", this.subscribers.size);
    this.subscribers.forEach(fn => fn());
  }

  processQueue() {
    while (this.activeLoads < this.maxConcurrent && this.queue.length > 0) {
      const { url, onLoad, onError, onProcessListChange, cardInput } = this.queue.shift();
      this.activeLoads++;
      this.notifyAllStatuses();

      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = url;

      img.onload = async () => {
        let sizeBytes = 0;
        let blob = null;
        try {
          const response = await fetch(url, { mode: "cors" });
          blob = await response.blob();
          sizeBytes = blob.size;
        } catch (e) { }
        const cacheKey = this._makeCacheKey(cardInput || {});
        const cacheEntry = { sizeBytes, cardInput, timestamp: Date.now(), cacheKey, imageUrl: url, blob };
        await saveToIndexedDB(cacheEntry);
        await this._enforceCacheLimit();
        onLoad(img, sizeBytes);
        this.activeLoads--;
        this.notifyAllStatuses();
        this.notifySubscribers();
        this.processQueue();
      };

      img.onerror = (err) => {
        onError(err);
        this.activeLoads--;
        this.notifyAllStatuses();
        this.processQueue();
      };

      onProcessListChange?.("LOADING");
    }
  }

  _createImageFromBlob(blob) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = URL.createObjectURL(blob);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

_createImageFromUrl(url) {
  return fetch(url, { mode: "cors" })
    .then(response => {
      if (!response.ok) throw new Error("Image fetch failed");
      return response.blob();
    })
    .then(blob => {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = URL.createObjectURL(blob);
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    })
    .catch(() => null);
}

  async getCacheGroupedByApiName() {
    const entries = await getAllFromIndexedDB();
    const grouped = {};
    for (const value of entries) {
      const api = value.cardInput?.apiName || "NOAPI";
      if (!grouped[api]) grouped[api] = [];
      grouped[api].push(value);
    }
    return grouped;
  }

  async getCacheGroupedByCardName() {
    const entries = await getAllFromIndexedDB();
    const grouped = {};
    for (const value of entries) {
      const name = value.cardInput?.name || "NONAME";
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(value);
    }
    return grouped;
  }

  async getTotalCacheSize() {
    const entries = await getAllFromIndexedDB();
    let total = 0;
    for (const value of entries) {
      total += value.sizeBytes || 0;
    }
    return total;
  }

  stopQueueForCard(cardName, apiName) {
    this.queue = this.queue.filter(entry => {
      const matchName = cardName ? entry.cardInput?.name !== cardName : true;
      const matchApi = apiName ? entry.cardInput?.apiName !== apiName : true;
      return matchName && matchApi;
    });
    this.notifyAllStatuses();
  }

  async clearCache() {
    await clearIndexedDB();
    this.queue = [];
    this.activeLoads = 0;
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  async clearCacheForCardName(cardName) {
    const entries = await getAllFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.name === cardName) {
        await deleteFromIndexedDB(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiName(apiName) {
    const entries = await getAllFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.apiName === apiName) {
        await deleteFromIndexedDB(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiAndCard(apiName, cardName) {
    const entries = await getAllFromIndexedDB();
    for (const value of entries) {
      if (
        value.cardInput?.apiName === apiName &&
        value.cardInput?.name === cardName
      ) {
        await deleteFromIndexedDB(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  notifyAllStatuses() {
    const total = this.queue.length + this.activeLoads;
    this.queue.forEach((entry, index) => {
      const position = index + 1;
      entry.onProcessListChange?.(`QUEUED(${position}/${total})`);
    });
  }

  mergeCallbacks(original, additional) {
    return (arg) => {
      if (original) original(arg);
      if (additional) additional(arg);
    };
  }

  async getSnapshot() {
    const byApi = await this.getCacheGroupedByApiName();
    const byCard = await this.getCacheGroupedByCardName();
    const totalSize = await this.getTotalCacheSize();
    const snapshot = { byApi, byCard, totalSize };
    if (
      this._lastSnapshot &&
      this._lastSnapshot.totalSize === snapshot.totalSize &&
      Object.keys(this._lastSnapshot.byApi).length === Object.keys(snapshot.byApi).length &&
      Object.keys(this._lastSnapshot.byCard).length === Object.keys(snapshot.byCard).length
    ) {
      return this._lastSnapshot;
    }
    this._lastSnapshot = snapshot;
    return snapshot;
  }

  async loadImageFromPersistentCache(cacheKey) {
    const entry = await getFromIndexedDB(cacheKey);
    if (!entry) return null;
    if (entry.blob) {
      return await this._createImageFromBlob(entry.blob);
    }
    // Fallback: Bild-URL laden
    return await this._createImageFromUrl(entry.imageUrl);
  }

   // Entfernt einen Eintrag aus der Queue anhand des cacheKeys
  removeFromQueueByCacheKey(cacheKey) {
    const before = this.queue.length;
    this.queue = this.queue.filter(entry => this._makeCacheKey(entry.cardInput) !== cacheKey);
    if (this.queue.length !== before) {
      this.notifyAllStatuses();
      this.notifySubscribers();
    }
  }

  // Entfernt alle Queue-Einträge einer API
  stopQueueForApi(apiName) {
    this.queue = this.queue.filter(entry => entry.cardInput?.apiName !== apiName);
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  // Entfernt alle Queue-Einträge einer Sprache
  stopQueueForLanguage(languageCode) {
    this.queue = this.queue.filter(entry => entry.cardInput?.languageCode !== languageCode);
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  // Liefert eine Kopie der aktuellen Queue (für das UI)
  getQueueSnapshot() {
    return this.queue.map(entry => ({
      cacheKey: this._makeCacheKey(entry.cardInput),
      cardInput: entry.cardInput,
      url: entry.url,
      priority: entry.priority,
      category: entry.category,
    }));
  }
}

export const imageLoaderService = new ImageLoaderService();

