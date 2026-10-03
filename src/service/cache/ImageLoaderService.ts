import { ImageQuality } from "../quality/ImageQuality";
import { throttledFetch } from "../RequestThrottle";

const DB_NAME = "mtg_cache_db";
const DB_VERSION = 2;
const STORE_NAME = "images";

/** Loosely-typed card reference used only to build cache keys and for display/filtering. */
export interface CacheCardInput {
  apiName?: string;
  name?: string;
  imageUrl?: string;
  languageCode?: string;
}

interface ImageCacheDbEntry {
  cacheKey: string;
  sizeBytes: number;
  cardInput?: CacheCardInput;
  timestamp: number;
  imageUrl: string;
  blob: Blob | null;
  // Druckschärfe je Crop-Ausschnitt, Schlüssel aus qualityCacheKey()
  quality?: Record<string, ImageQuality>;
}

export interface AddToQueueParams {
  url: string;
  priority: number;
  onLoad: (img: HTMLImageElement, sizeBytes?: number) => void;
  onError?: (error: unknown) => void;
  onProcessListChange?: (status: string) => void;
  category?: string;
  cardInput?: CacheCardInput;
}

interface QueueEntry {
  url: string;
  priority: number;
  onLoad: (img: HTMLImageElement, sizeBytes?: number) => void;
  onError?: (error: unknown) => void;
  onProcessListChange?: (status: string) => void;
  category?: string;
  cardInput: CacheCardInput;
}

export interface QueueSnapshotEntry {
  cacheKey: string;
  cardInput: CacheCardInput;
  url: string;
  priority: number;
  category?: string;
}

// Höchstens so viele Bilder gleichzeitig über das Backend laden
const MAX_CONCURRENT_PROXY_LOADS = 4;

/** Lädt ein Bild über /api/proxy/image (gleiche Origin, also CORS-sauber), gedrosselt pro Ziel-Host. */
export async function fetchImageViaProxy(url: string): Promise<Blob> {
  const response = await throttledFetch(
    "/api/proxy/image",
    { method: "GET", cache: "no-store", headers: { "X-Target-URL": url } },
    url
  );
  if (!response.ok) throw new Error(`Proxy-Fehler ${response.status} für ${url}`);
  return response.blob();
}

export interface QueueNumbers {
  queued: number;
  active: number;
  cacheLoading: number;
}

export interface CacheSnapshot {
  byApi: Record<string, ImageCacheDbEntry[]>;
  byCard: Record<string, ImageCacheDbEntry[]>;
  totalSize: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function (event) {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(entry: ImageCacheDbEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(entry);
}

async function deleteFromIndexedDB(cacheKey: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(cacheKey);
}

async function clearIndexedDB(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
}

async function getAllFromIndexedDB(): Promise<ImageCacheDbEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromIndexedDB(cacheKey: string): Promise<ImageCacheDbEntry | undefined> {
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
  private queue: QueueEntry[] = [];
  private activeLoads = 0;
  private activeProxyLoads = 0;
  private proxyImageApis: Set<string> = new Set();
  private activeCacheLoads = 0;
  private maxConcurrent: number;
  private subscribers: Set<() => void> = new Set();
  private _lastSnapshot: CacheSnapshot | null = null;
  cacheLimit = 1024 * 1024 * 1024; // 1 GB

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this._initPersistentCache();
  }

  private async _initPersistentCache(): Promise<void> {
    await this._enforceCacheLimit();
    this.notifySubscribers();
  }

  setCacheLimit(newLimit: number): void {
    this.cacheLimit = newLimit;
    this._enforceCacheLimit();
    this.notifySubscribers();
  }

  private async _enforceCacheLimit(): Promise<void> {
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

  /** Gespeicherte Schärfemessung für Bild + Ausschnitt, falls das Bild im Cache liegt. */
  async getCachedQuality(cardInput: CacheCardInput, qualityKey: string): Promise<ImageQuality | undefined> {
    try {
      const entry = await getFromIndexedDB(this._makeCacheKey(cardInput));
      return entry?.quality?.[qualityKey];
    } catch (e) {
      return undefined;
    }
  }

  /** Schärfemessung am Cache-Eintrag speichern. Ohne Cache-Eintrag (z.B. Proxy-Fallback) passiert nichts. */
  async saveQuality(cardInput: CacheCardInput, qualityKey: string, quality: ImageQuality): Promise<void> {
    try {
      const entry = await getFromIndexedDB(this._makeCacheKey(cardInput));
      if (!entry) return;
      entry.quality = { ...(entry.quality || {}), [qualityKey]: quality };
      await saveToIndexedDB(entry);
    } catch (e) { }
  }

  /** API-Namen, deren Bilder über das Backend geladen werden (Feld "Proxy Images" der API-Config). */
  setProxyImageApis(apiNames: string[]): void {
    this.proxyImageApis = new Set(apiNames);
  }

  usesProxy(cardInput?: CacheCardInput): boolean {
    return !!cardInput?.apiName && this.proxyImageApis.has(cardInput.apiName);
  }

  private _makeCacheKey(cardInput: CacheCardInput): string {
    return `${cardInput.apiName || "NOAPI"}::${cardInput.name || "NONAME"}::${cardInput.imageUrl || ""}`;
  }

  async addToQueue({ url, priority, onLoad, onError, onProcessListChange, category, cardInput }: AddToQueueParams): Promise<void> {
    const cacheKey = this._makeCacheKey(cardInput || {});
    const cached = await getFromIndexedDB(cacheKey);
    if (cached) {
      // Wenn img noch nicht geladen, aus Blob erzeugen, sonst Fallback: Bild-URL laden
      this.activeCacheLoads++;
      const load = cached.blob
        ? this._createImageFromBlob(cached.blob)
        : this._createImageFromUrl(cached.imageUrl, this.usesProxy(cardInput));
      load.then(img => {
        if (img) {
          onLoad(img, cached.sizeBytes);
        } else {
          onError?.(new Error(cached.blob ? "Image could not be created from blob" : "Image could not be loaded from url"));
        }
      }).finally(() => {
        this.activeCacheLoads--;
      });
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

    this.queue.push({ url, priority, onLoad, onError, onProcessListChange, category, cardInput: cardInput || {} });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.notifyAllStatuses();
    this.processQueue();
  }

  stopForFilters(visibleLanguages: Set<string>, visibleApis: Set<string>): void {
    this.queue = this.queue.filter(entry => {
      const { cardInput } = entry;
      const language = cardInput.languageCode || 'No Language';
      return visibleLanguages.has(language) && visibleApis.has(cardInput.apiName || '');
    });
    this.notifyAllStatuses();
    console.log('stoped filters :', this.queue.length);
  }

  stopByCategory(category: string): void {
    this.queue = this.queue.filter((entry) => entry.category !== category);
    this.notifyAllStatuses();
    console.log('stoped category :' + category, this.queue.length);
  }

  // Wartenden Eintrag einer Karte abbrechen, aber nur wenn er zu dieser Kategorie gehört
  cancelQueued(cardInput: CacheCardInput, category: string): void {
    const cacheKey = this._makeCacheKey(cardInput);
    const before = this.queue.length;
    this.queue = this.queue.filter(
      (entry) => entry.category !== category || this._makeCacheKey(entry.cardInput) !== cacheKey
    );
    if (this.queue.length !== before) this.notifyAllStatuses();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notifySubscribers(): void {
    console.log("notifySubscribers", this.subscribers.size);
    this.subscribers.forEach(fn => fn());
  }

  processQueue(): void {
    while (this.activeLoads < this.maxConcurrent) {
      // Proxy-Bilder haben ein eigenes, kleineres Limit; solange es voll ist, kommen direkte Bilder dran.
      const index = this.queue.findIndex(entry =>
        !this.usesProxy(entry.cardInput) || this.activeProxyLoads < MAX_CONCURRENT_PROXY_LOADS
      );
      if (index < 0) break;
      const [{ url, onLoad, onError, onProcessListChange, cardInput }] = this.queue.splice(index, 1);
      const proxied = this.usesProxy(cardInput);
      this.activeLoads++;
      if (proxied) this.activeProxyLoads++;
      this.notifyAllStatuses();

      const finish = () => {
        this.activeLoads--;
        if (proxied) this.activeProxyLoads--;
        this.notifyAllStatuses();
        this.processQueue();
      };

      const load = proxied ? this._loadViaProxy(url) : this._loadDirect(url);
      load.then(async ({ img, blob }) => {
        const sizeBytes = blob?.size || 0;
        const cacheKey = this._makeCacheKey(cardInput || {});
        const cacheEntry: ImageCacheDbEntry = { sizeBytes, cardInput, timestamp: Date.now(), cacheKey, imageUrl: url, blob };
        await saveToIndexedDB(cacheEntry);
        await this._enforceCacheLimit();
        onLoad(img, sizeBytes);
        this.notifySubscribers();
      }, (err) => {
        onError?.(err);
      }).finally(finish);

      onProcessListChange?.("LOADING");
    }
  }

  private _loadDirect(url: string): Promise<{ img: HTMLImageElement; blob: Blob | null }> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.onload = async () => {
        let blob: Blob | null = null;
        try {
          const response = await fetch(url, { mode: "cors" });
          blob = await response.blob();
        } catch (e) { }
        resolve({ img, blob });
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  private async _loadViaProxy(url: string): Promise<{ img: HTMLImageElement; blob: Blob | null }> {
    const blob = await fetchImageViaProxy(url);
    const img = await this._createImageFromBlob(blob);
    if (!img) throw new Error("Proxy-Bild konnte nicht dekodiert werden");
    return { img, blob };
  }

  private _createImageFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = URL.createObjectURL(blob);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

  private _createImageFromUrl(url: string, proxied = false): Promise<HTMLImageElement | null> {
    const blob = proxied
      ? fetchImageViaProxy(url)
      : fetch(url, { mode: "cors" }).then(response => {
        if (!response.ok) throw new Error("Image fetch failed");
        return response.blob();
      });
    return blob
      .then(blob => {
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "Anonymous";
          img.src = URL.createObjectURL(blob);
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
      })
      .catch(() => null);
  }

  async getCacheGroupedByApiName(): Promise<Record<string, ImageCacheDbEntry[]>> {
    const entries = await getAllFromIndexedDB();
    const grouped: Record<string, ImageCacheDbEntry[]> = {};
    for (const value of entries) {
      const api = value.cardInput?.apiName || "NOAPI";
      if (!grouped[api]) grouped[api] = [];
      grouped[api].push(value);
    }
    return grouped;
  }

  async getCacheGroupedByCardName(): Promise<Record<string, ImageCacheDbEntry[]>> {
    const entries = await getAllFromIndexedDB();
    const grouped: Record<string, ImageCacheDbEntry[]> = {};
    for (const value of entries) {
      const name = value.cardInput?.name || "NONAME";
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(value);
    }
    return grouped;
  }

  async getTotalCacheSize(): Promise<number> {
    const entries = await getAllFromIndexedDB();
    let total = 0;
    for (const value of entries) {
      total += value.sizeBytes || 0;
    }
    return total;
  }

  stopQueueForCard(cardName?: string, apiName?: string): void {
    this.queue = this.queue.filter(entry => {
      const matchName = cardName ? entry.cardInput?.name !== cardName : true;
      const matchApi = apiName ? entry.cardInput?.apiName !== apiName : true;
      return matchName && matchApi;
    });
    this.notifyAllStatuses();
  }

  async clearCache(): Promise<void> {
    await clearIndexedDB();
    this.queue = [];
    this.activeLoads = 0;
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  async clearCacheForCardName(cardName: string): Promise<void> {
    const entries = await getAllFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.name === cardName) {
        await deleteFromIndexedDB(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiName(apiName: string): Promise<void> {
    const entries = await getAllFromIndexedDB();
    for (const value of entries) {
      if (value.cardInput?.apiName === apiName) {
        await deleteFromIndexedDB(value.cacheKey);
      }
    }
    this.notifySubscribers();
  }

  async clearCacheForApiAndCard(apiName: string, cardName: string): Promise<void> {
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

  notifyAllStatuses(): void {
    const total = this.queue.length + this.activeLoads;
    this.queue.forEach((entry, index) => {
      const position = index + 1;
      entry.onProcessListChange?.(`QUEUED(${position}/${total})`);
    });
  }

  private mergeCallbacks<T>(
    original: ((arg: T) => void) | undefined,
    additional: ((arg: T) => void) | undefined
  ): (arg: T) => void {
    return (arg: T) => {
      if (original) original(arg);
      if (additional) additional(arg);
    };
  }

  async getSnapshot(): Promise<CacheSnapshot> {
    const byApi = await this.getCacheGroupedByApiName();
    const byCard = await this.getCacheGroupedByCardName();
    const totalSize = await this.getTotalCacheSize();
    const snapshot: CacheSnapshot = { byApi, byCard, totalSize };
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

  async loadImageFromPersistentCache(cacheKey: string): Promise<HTMLImageElement | null> {
    const entry = await getFromIndexedDB(cacheKey);
    if (!entry) return null;
    if (entry.blob) {
      return await this._createImageFromBlob(entry.blob);
    }
    // Fallback: Bild-URL laden
    return await this._createImageFromUrl(entry.imageUrl, this.usesProxy(entry.cardInput));
  }

  // Entfernt einen Eintrag aus der Queue anhand des cacheKeys
  removeFromQueueByCacheKey(cacheKey: string): void {
    const before = this.queue.length;
    this.queue = this.queue.filter(entry => this._makeCacheKey(entry.cardInput) !== cacheKey);
    if (this.queue.length !== before) {
      this.notifyAllStatuses();
      this.notifySubscribers();
    }
  }

  // Entfernt alle Queue-Einträge einer API
  stopQueueForApi(apiName: string): void {
    this.queue = this.queue.filter(entry => entry.cardInput?.apiName !== apiName);
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  // Entfernt alle Queue-Einträge einer Sprache
  stopQueueForLanguage(languageCode: string): void {
    this.queue = this.queue.filter(entry => entry.cardInput?.languageCode !== languageCode);
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  // Zähler für die Download-Bubble (wartend, aktive Downloads, Ladevorgänge aus dem Cache)
  getQueueNumbers(): QueueNumbers {
    return {
      queued: this.queue.length,
      active: this.activeLoads,
      cacheLoading: this.activeCacheLoads,
    };
  }

  // Liefert eine Kopie der aktuellen Queue (für das UI)
  getQueueSnapshot(): QueueSnapshotEntry[] {
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
