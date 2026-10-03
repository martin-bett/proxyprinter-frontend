const DB_NAME = "mtg_cache_db";
const DB_VERSION = 3; // Version erhöht wegen neuer Struktur
const META_STORE = "meta";
const IMAGE_STORE = "images";

// Öffnet die DB und legt beide Stores an
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "cacheKey" });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Meta Store Hilfsfunktionen ---
async function saveMetaToIndexedDB(metaEntry) {
  const db = await openDB();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put(metaEntry);
  return tx.complete;
}
async function deleteMetaFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).delete(cacheKey);
  return tx.complete;
}
async function clearMetaIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).clear();
  return tx.complete;
}
async function getAllMetaFromIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(META_STORE, "readonly");
  const store = tx.objectStore(META_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getMetaFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(META_STORE, "readonly");
  const store = tx.objectStore(META_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(cacheKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Image Store Hilfsfunktionen ---
async function saveImageToIndexedDB(cacheKey, blob) {
  const db = await openDB();
  const tx = db.transaction(IMAGE_STORE, "readwrite");
  tx.objectStore(IMAGE_STORE).put({ cacheKey, blob });
  return tx.complete;
}
async function deleteImageFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(IMAGE_STORE, "readwrite");
  tx.objectStore(IMAGE_STORE).delete(cacheKey);
  return tx.complete;
}
async function clearImageIndexedDB() {
  const db = await openDB();
  const tx = db.transaction(IMAGE_STORE, "readwrite");
  tx.objectStore(IMAGE_STORE).clear();
  return tx.complete;
}
async function getImageFromIndexedDB(cacheKey) {
  const db = await openDB();
  const tx = db.transaction(IMAGE_STORE, "readonly");
  const store = tx.objectStore(IMAGE_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(cacheKey);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

class ImageLoaderService {

  constructor(maxConcurrent = 10, maxConcurrentCacheLoads = 50) {
    this.queue = [];
    this.activeLoads = 0;
    this.maxConcurrent = maxConcurrent;
    this.maxConcurrentCacheLoads = maxConcurrentCacheLoads;
    this.cacheLoadQueue = [];
    this.activeCacheLoads = 0;
    this.subscribers = new Set();
    this._lastSnapshot = null;
    this.cacheLimit = 1024 * 1024 * 1024 * 2; 
    this._initPersistentCache();
    this._lastQueueSnapshot = null;
    this.activeLoadEntries = [];
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
    const entries = await getAllMetaFromIndexedDB();
    let total = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
    if (total <= this.cacheLimit) return;
    // Sortiere nach ältestem timestamp
    entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    for (const entry of entries) {
      await this._deleteFromBothStores(entry.cacheKey);
      total -= entry.sizeBytes || 0;
      if (total <= this.cacheLimit) break;
    }
  }

  _makeCacheKey(cardInput) {
    return `${cardInput.apiName || "NOAPI"}::${cardInput.name || "NONAME"}::${cardInput.imageUrl || ""}`;
  }

  async addToQueue({ url, priority, onLoad, onError, onProcessListChange, category, cardInput }) {
    const cacheKey = this._makeCacheKey(cardInput || {});
    const cachedMeta = await getMetaFromIndexedDB(cacheKey);
    if (cachedMeta) {
      this.activeLoadEntries = this.activeLoadEntries || [];
      this.activeLoadEntries.push({
        cacheKey,
        cardInput,
        url,
        priority,
        category,
        status: "CACHELOAD"
      });

      // CacheLoad in eigene Queue packen
      this.cacheLoadQueue.push({
        cacheKey,
        cardInput,
        url,
        priority,
        category,
        cachedMeta,
        onLoad,
        onError,
        onProcessListChange
      });
      this.notifyAllStatuses();
      this.processCacheLoadQueue();
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
      const { url, onLoad, onError, onProcessListChange, cardInput, priority, category } = this.queue.shift();
      const cacheKey = this._makeCacheKey(cardInput || {});
      this.activeLoads++;
      this.notifyAllStatuses();

      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = url;

      this.activeLoadEntries = this.activeLoadEntries || [];
      this.activeLoadEntries.push({
        cacheKey,
        cardInput,
        url,
        priority,
        category,
        status: "DOWNLOAD"
      });

      img.onload = async () => {
        let sizeBytes = 0;
        let blob = null;
        try {
          const response = await fetch(url, { mode: "cors" });
          blob = await response.blob();
          sizeBytes = blob.size;
        } catch (e) { }
        const cacheKey = this._makeCacheKey(cardInput || {});
        const metaEntry = { sizeBytes, cardInput, timestamp: Date.now(), cacheKey, imageUrl: url };
        await saveMetaToIndexedDB(metaEntry);
        if (blob) await saveImageToIndexedDB(cacheKey, blob);
        await this._enforceCacheLimit();
        onLoad(img, sizeBytes);
        this.activeLoads--;
        this.activeLoadEntries = this.activeLoadEntries.filter(e => e.cacheKey !== cacheKey);
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

      onProcessListChange?.({
        message: "DOWNLOAD",
        hint: "Bild wird heruntergeladen",
        current: 1,
        total: 1
      });
    }
  }

  processCacheLoadQueue() {
    while (
      this.activeCacheLoads < this.maxConcurrentCacheLoads &&
      this.cacheLoadQueue.length > 0
    ) {
      const {
        cacheKey,
        cardInput,
        url,
        priority,
        category,
        cachedMeta,
        onLoad,
        onError,
        onProcessListChange
      } = this.cacheLoadQueue.shift();

      this.activeCacheLoads++;
      // onProcessListChange für CacheLoad
      onProcessListChange?.({
        message: "CACHELOAD",
        hint: "Bild wird aus Cache geladen",
        current: this.activeCacheLoads,
        total: this.activeCacheLoads + this.cacheLoadQueue.length
      });

      getImageFromIndexedDB(cacheKey).then(blob => {
        if (blob) {
          this._createImageFromBlob(blob).then(img => {
            if (img) {
              onLoad(img, cachedMeta.sizeBytes);
            } else {
              onError?.(new Error("Image could not be created from blob"));
            }
            this._finishCacheLoad(cacheKey);
          });
        } else {
          // Fallback: Bild-URL laden
          this._createImageFromUrl(cachedMeta.imageUrl).then(img => {
            if (img) {
              onLoad(img, cachedMeta.sizeBytes);
            } else {
              onError?.(new Error("Image could not be loaded from url"));
            }
            this._finishCacheLoad(cacheKey);
          });
        }
      });
    }
  }

  _finishCacheLoad(cacheKey) {
    this.activeCacheLoads--;
    this.activeLoadEntries = this.activeLoadEntries.filter(e => e.cacheKey !== cacheKey);
    this.notifyAllStatuses();
    this.notifySubscribers();
    this.processCacheLoadQueue();
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
    const entries = await getAllMetaFromIndexedDB();
    const grouped = {};
    for (const value of entries) {
      const api = value.cardInput?.apiName || "NOAPI";
      if (!grouped[api]) grouped[api] = [];
      grouped[api].push(value);
    }
    return grouped;
  }

  async getCacheGroupedByCardName() {
    const entries = await getAllMetaFromIndexedDB();
    const grouped = {};
    for (const value of entries) {
      const name = value.cardInput?.name || "NONAME";
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(value);
    }
    return grouped;
  }

  async getTotalCacheSize() {
    const entries = await getAllMetaFromIndexedDB();
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
    await clearMetaIndexedDB();
    await clearImageIndexedDB();
    this.queue = [];
    this.activeLoads = 0;
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  async clearCacheForCardName(cardName) {
    const entries = await getAllMetaFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.name === cardName) {
        await this._deleteFromBothStores(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiName(apiName) {
    const entries = await getAllMetaFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.apiName === apiName) {
        await this._deleteFromBothStores(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiAndCard(apiName, cardName) {
    const entries = await getAllMetaFromIndexedDB();
    for (const value of entries) {
      if (
        value.cardInput?.apiName === apiName &&
        value.cardInput?.name === cardName
      ) {
        await this._deleteFromBothStores(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  // Hilfsfunktion: Löscht aus beiden Stores
  async _deleteFromBothStores(cacheKey) {
    await deleteMetaFromIndexedDB(cacheKey);
    await deleteImageFromIndexedDB(cacheKey);
  }

  notifyAllStatuses() {
    const total = this.queue.length + this.activeLoads;
    this.queue.forEach((entry, index) => {
      const position = index + 1;
      entry.onProcessListChange?.({
        message: "QUEUED",
        hint: "Wartet in der Download-Warteschlange",
        current: position,
        total
      });
    });
    // CacheLoad-Status separat
    this.cacheLoadQueue.forEach((entry, index) => {
      entry.onProcessListChange?.({
        message: "CACHELOAD",
        hint: "Wartet in der CacheLoad-Warteschlange",
        current: index + 1,
        total: this.cacheLoadQueue.length + this.activeCacheLoads
      });
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
    const meta = await getMetaFromIndexedDB(cacheKey);
    if (!meta) return null;
    const blob = await getImageFromIndexedDB(cacheKey);
    if (blob) {
      return await this._createImageFromBlob(blob);
    }
    // Fallback: Bild-URL laden
    return await this._createImageFromUrl(meta.imageUrl);
  }

  // Entfernt einen Eintrag aus der Queue anhand des cacheKeys
  removeFromQueueByCacheKey(cacheKey) {
    const before = this.queue.length;
    this.queue = this.queue.filter(entry => this._makeCacheKey(entry.cardInput) !== cacheKey);
    // Auch aus beiden Stores löschen
    this._deleteFromBothStores(cacheKey);
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
    // Queue: Noch nicht gestartete (queued)
    const queued = this.queue.map(entry => ({
      cacheKey: this._makeCacheKey(entry.cardInput),
      cardInput: entry.cardInput,
      url: entry.url,
      priority: entry.priority,
      category: entry.category,
      status: "QUEUED"
    }));

    // Aktive Loads (Download oder CacheLoad) getrennt aufteilen
    let active = [];
    let cacheLoading = [];
    if (Array.isArray(this.activeLoadEntries)) {
      for (const entry of this.activeLoadEntries) {
        const base = {
          cacheKey: this._makeCacheKey(entry.cardInput),
          cardInput: entry.cardInput,
          url: entry.url,
          priority: entry.priority,
          category: entry.category,
          status: entry.status
        };
        if (entry.status === "DOWNLOAD") {
          active.push(base);
        } else if (entry.status === "CACHELOAD") {
          cacheLoading.push(base);
        }
      }
    }
    // Auch die in cacheLoadQueue wartenden als QUEUED für CacheLoad anzeigen
    cacheLoading = cacheLoading.concat(
      this.cacheLoadQueue.map(entry => ({
        cacheKey: this._makeCacheKey(entry.cardInput),
        cardInput: entry.cardInput,
        url: entry.url,
        priority: entry.priority,
        category: entry.category,
        status: "CACHELOAD_QUEUED"
      }))
    );

    const snapshot = {
      queued,
      active,
      cacheLoading
    };
    // Nur wenn sich die Länge geändert hat, neues Objekt zurückgeben
    if (
      !this._lastQueueSnapshot ||
      this._lastQueueSnapshot.queued.length !== queued.length ||
      this._lastQueueSnapshot.active.length !== active.length ||
      this._lastQueueSnapshot.cacheLoading.length !== cacheLoading.length
    ) {
      this._lastQueueSnapshot = snapshot;
      return snapshot;
    }
    return this._lastQueueSnapshot;
  }

  getSnapshotNumbers() {
    let active = 0;
    let cacheLoading = 0;
    if (Array.isArray(this.activeLoadEntries)) {
      for (const entry of this.activeLoadEntries) {
        if (entry.status === "DOWNLOAD") active++;
        else if (entry.status === "CACHELOAD") cacheLoading++;
      }
    }
    // Add queued cache loads
    cacheLoading += this.cacheLoadQueue.length;
    return {
      queued: this.queue.length,
      active,
      cacheLoading
    };
  }
}

export const imageLoaderService = new ImageLoaderService();

