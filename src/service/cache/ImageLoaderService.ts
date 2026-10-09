import { ImageQuality } from "../quality/ImageQuality";
import { openCacheDb } from "./openCacheDb";
import i18n from "../../i18n";
import { throttledFetch } from "../RequestThrottle";

const DB_NAME = "mtg_cache_db";
const STORE_NAME = "images";
const CACHE_LIMIT_KEY = "cacheLimitBytes";

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
  // Verkleinerte Kopie für Kachelansichten (ganzes Bild, THUMB_MAX_WIDTH breit) und Originalmaße
  thumb?: Blob;
  width?: number;
  height?: number;
  // Mit dem Schloss im Bild-Cache-Dialog geschützt: bleibt beim Leeren stehen und wird beim Platzschaffen zuletzt gelöscht
  locked?: boolean;
}

/** Filter auf Cache-Einträge: ohne Angabe passt jeder Wert. */
export interface CacheEntryFilter {
  apiName?: string;
  cardName?: string;
}

function matchesFilter(entry: ImageCacheDbEntry, { apiName, cardName }: CacheEntryFilter): boolean {
  return (apiName === undefined || entry.cardInput?.apiName === apiName)
    && (cardName === undefined || entry.cardInput?.name === cardName);
}

/** Löschreihenfolge beim Platzschaffen: erst ungeschützte, dann geschützte Einträge, jeweils die ältesten zuerst. */
export function evictionOrder<T extends { locked?: boolean; timestamp?: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => Number(!!a.locked) - Number(!!b.locked) || (a.timestamp || 0) - (b.timestamp || 0));
}

/** Breite der verkleinerten Kopie, die Kacheln statt des Originals dekodieren. */
export const THUMB_MAX_WIDTH = 512;

/** Maße des Originals, wenn onLoad nur die verkleinerte Kopie liefert. */
export interface ImageLoadMeta {
  fullWidth: number;
  fullHeight: number;
  thumbnail: boolean;
}

/** Verkleinert ein Bild auf höchstens THUMB_MAX_WIDTH Pixel Breite. null, wenn nichts zu verkleinern ist oder Canvas fehlt. */
export async function createThumbnail(img: HTMLImageElement): Promise<Blob | null> {
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h || w <= THUMB_MAX_WIDTH) return null;
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_MAX_WIDTH;
    canvas.height = Math.max(1, Math.round((h * THUMB_MAX_WIDTH) / w));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  } catch (e) {
    return null;
  }
}

export interface AddToQueueParams {
  url: string;
  priority: number;
  onLoad: (img: HTMLImageElement, sizeBytes?: number, meta?: ImageLoadMeta) => void;
  onError?: (error: unknown) => void;
  onProcessListChange?: (status: string) => void;
  category?: string;
  cardInput?: CacheCardInput;
  /** Liegt im Cache eine verkleinerte Kopie, liefert onLoad diese (meta.thumbnail) statt des Originals. */
  preferThumbnail?: boolean;
  /** Abbruch durch den Aufrufer: wartender Eintrag fliegt raus, laufender Download wird fertig, Callbacks werden nicht mehr gerufen. */
  signal?: AbortSignal;
}

// Ein Interessent an einem Bild; mehrere Karten mit gleichem Bild teilen sich einen Queue-Eintrag
interface QueueListener {
  onLoad: (img: HTMLImageElement, sizeBytes?: number, meta?: ImageLoadMeta) => void;
  onError?: (error: unknown) => void;
  onProcessListChange?: (status: string) => void;
  signal?: AbortSignal;
}

interface QueueEntry {
  url: string;
  priority: number;
  listeners: QueueListener[];
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

// Hosts, die Bilder nicht an fremde Seiten ausliefern (Google Drive antwortet proxyprinter.eu mit 403).
// Bilder von dort laden immer über das Backend, egal aus welcher API oder Galerie sie kommen.
const PROXY_ONLY_HOSTS = ["drive.google.com", "drive.usercontent.google.com", "docs.google.com"];

/** true, wenn die URL auf einen Host zeigt, der nur über /api/proxy/image erreichbar ist. */
export function isProxyOnlyUrl(url?: string): boolean {
  if (!url) return false;
  try {
    return PROXY_ONLY_HOSTS.includes(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

/** Lädt ein Bild als HTMLImageElement: Proxy-only-Hosts direkt über das Backend, sonst erst direkt und bei Fehler über den Proxy. */
export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const viaProxy = async () => {
    const objectUrl = URL.createObjectURL(await fetchImageViaProxy(url));
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(i18n.t("cacheService.proxyDecodeFailed")));
      img.src = objectUrl;
    });
  };
  if (isProxyOnlyUrl(url)) return viaProxy();
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(i18n.t("cacheService.imageLoadFailed")));
      img.src = url;
    });
  } catch (e) {
    // Nur fremde http(s)-Adressen kann der Proxy holen
    if (!/^https?:\/\//i.test(url)) throw e;
    return viaProxy();
  }
}

// Über den Proxy gescheiterte Bilder (URL -> Grund). Werden in dieser Sitzung nicht erneut angefragt.
const proxyFailures = new Map<string, string>();

export function proxyFailure(url: string): string | undefined {
  return proxyFailures.get(url);
}

export function clearProxyFailures(): void {
  proxyFailures.clear();
}

/** Lädt ein Bild über /api/proxy/image (gleiche Origin, also CORS-sauber), gedrosselt pro Ziel-Host. */
export async function fetchImageViaProxy(url: string): Promise<Blob> {
  const known = proxyFailures.get(url);
  if (known) throw new Error(known);
  const response = await throttledFetch(
    "/api/proxy/image",
    { method: "GET", cache: "no-store", headers: { "X-Target-URL": url } },
    url
  );
  if (!response.ok) {
    const reason = i18n.t("cacheService.imageLoadFailedReason", { reason: response.headers.get("X-Proxy-Error") || i18n.t("cacheService.proxyError", { status: response.status }) });
    proxyFailures.set(url, reason);
    throw new Error(reason);
  }
  return response.blob();
}

/** Fenster, über das die Download-Rate gemittelt wird (Millisekunden) */
const DOWNLOAD_RATE_WINDOW_MS = 5000;

export interface QueueNumbers {
  queued: number;
  active: number;
  cacheLoading: number;
}

export interface CacheSnapshot {
  byApi: Record<string, ImageCacheDbEntry[]>;
  byCard: Record<string, ImageCacheDbEntry[]>;
  totalSize: number;
  lockedCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return openCacheDb(DB_NAME, STORE_NAME);
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
  private recentDownloads: { at: number; bytes: number }[] = [];
  private activeProxyLoads = 0;
  private proxyImageApis: Set<string> = new Set();
  private activeCacheLoads = 0;
  private maxConcurrent: number;
  private subscribers: Set<() => void> = new Set();
  private _lastSnapshot: CacheSnapshot | null = null;
  cacheLimit = 4 * 1024 * 1024 * 1024; // 4 GB
  /** Erfüllt, sobald der persistente Cache beim Start geprüft wurde (Tests warten darauf). */
  readonly ready: Promise<void>;

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.ready = this._initPersistentCache();
  }

  private async _initPersistentCache(): Promise<void> {
    try {
      const saved = localStorage.getItem(CACHE_LIMIT_KEY);
      if (saved) {
        this.cacheLimit = Number(saved);
      }
    } catch {
      // localStorage not available
    }
    await this._enforceCacheLimit();
    this.notifySubscribers();
  }

  setCacheLimit(newLimit: number): void {
    this.cacheLimit = newLimit;
    try {
      localStorage.setItem(CACHE_LIMIT_KEY, String(newLimit));
    } catch {
      // localStorage not available
    }
    this._enforceCacheLimit();
    this.notifySubscribers();
  }

  private async _enforceCacheLimit(): Promise<void> {
    const entries = await getAllFromIndexedDB();
    let total = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
    if (total <= this.cacheLimit) return;
    // Geschützte Einträge fallen erst, wenn sie allein das Limit überschreiten
    for (const entry of evictionOrder(entries)) {
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
    return (!!cardInput?.apiName && this.proxyImageApis.has(cardInput.apiName)) || isProxyOnlyUrl(cardInput?.imageUrl);
  }

  private _makeCacheKey(cardInput: CacheCardInput): string {
    return `${cardInput.apiName || "NOAPI"}::${cardInput.name || "NONAME"}::${cardInput.imageUrl || ""}`;
  }

  async addToQueue({ url, priority, onLoad, onError, onProcessListChange, category, cardInput, signal, preferThumbnail }: AddToQueueParams): Promise<void> {
    if (signal?.aborted) return;
    const cacheKey = this._makeCacheKey(cardInput || {});
    const cached = await getFromIndexedDB(cacheKey);
    // Während des Cache-Lookups abgebrochen (z.B. Karte weggefiltert): gar nicht erst einreihen
    if (signal?.aborted) return;
    if (cached && preferThumbnail && cached.thumb && cached.width && cached.height) {
      // Kachelansicht: nur die kleine Kopie dekodieren
      const meta: ImageLoadMeta = { fullWidth: cached.width, fullHeight: cached.height, thumbnail: true };
      this.activeCacheLoads++;
      this._createImageFromBlob(cached.thumb, true).then(img => {
        if (signal?.aborted) return;
        if (img) onLoad(img, cached.sizeBytes, meta);
        else onError?.(new Error(i18n.t("cacheService.thumbnailFailed")));
      }).finally(() => {
        this.activeCacheLoads--;
      });
      onProcessListChange?.("LOADING");
      return;
    }
    if (cached) {
      // Wenn img noch nicht geladen, aus Blob erzeugen, sonst Fallback: Bild-URL laden
      this.activeCacheLoads++;
      const load = cached.blob
        ? this._createImageFromBlob(cached.blob)
        : this._createImageFromUrl(cached.imageUrl, this.usesProxy(cardInput));
      load.then(img => {
        if (signal?.aborted) return;
        if (img) {
          onLoad(img, cached.sizeBytes);
          // Eintrag aus älteren Versionen ohne kleine Kopie: nachreichen
          if (cached.blob && !cached.thumb) void this._addThumbnail(cacheKey, img);
        } else {
          onError?.(new Error(cached.blob ? i18n.t("cacheService.blobFailed") : i18n.t("cacheService.urlFailed")));
        }
      }).finally(() => {
        this.activeCacheLoads--;
      });
      onProcessListChange?.("LOADING");
      return;
    }

    // Schon über den Proxy gescheitert: sofort melden statt erneut anzufragen
    const failure = this.usesProxy(cardInput) ? proxyFailure(url) : undefined;
    if (failure) {
      onError?.(new Error(failure));
      return;
    }

    const listener: QueueListener = { onLoad, onError, onProcessListChange, signal };
    signal?.addEventListener("abort", () => this._removeListener(cacheKey, listener), { once: true });

    const existingEntry = this.queue.find((entry) => this._makeCacheKey(entry.cardInput) === cacheKey);
    if (existingEntry) {
      existingEntry.priority = Math.max(existingEntry.priority, priority);
      existingEntry.listeners.push(listener);
      if (category) existingEntry.category = category;
      this.queue.sort((a, b) => b.priority - a.priority);
      this.notifyAllStatuses();
      return;
    }

    this.queue.push({ url, priority, listeners: [listener], category, cardInput: cardInput || {} });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.notifyAllStatuses();
    this.processQueue();
  }

  // Abgebrochener Interessent: aus seinem wartenden Eintrag austragen, leere Einträge verlassen die Queue.
  // Läuft der Download schon, steht der Eintrag nicht mehr in der Queue und wird einfach fertig.
  private _removeListener(cacheKey: string, listener: QueueListener): void {
    const entry = this.queue.find(e => this._makeCacheKey(e.cardInput) === cacheKey);
    if (!entry) return;
    entry.listeners = entry.listeners.filter(l => l !== listener);
    if (entry.listeners.length === 0) this.queue = this.queue.filter(e => e !== entry);
    this.notifyAllStatuses();
  }

  private _liveListeners(entry: QueueEntry): QueueListener[] {
    return entry.listeners.filter(l => !l.signal?.aborted);
  }

  stopByCategory(category: string): void {
    this.queue = this.queue.filter((entry) => entry.category !== category);
    this.notifyAllStatuses();
    console.log('stoped category :' + category, this.queue.length);
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
      const [entry] = this.queue.splice(index, 1);
      const { url, cardInput } = entry;
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
        this._recordDownload(sizeBytes);
        const cacheKey = this._makeCacheKey(cardInput || {});
        const thumb = blob ? await createThumbnail(img) : null;
        const cacheEntry: ImageCacheDbEntry = {
          sizeBytes: sizeBytes + (thumb?.size || 0), cardInput, timestamp: Date.now(), cacheKey, imageUrl: url, blob,
          ...(thumb ? { thumb, width: img.naturalWidth, height: img.naturalHeight } : {}),
        };
        await saveToIndexedDB(cacheEntry);
        await this._enforceCacheLimit();
        this._liveListeners(entry).forEach(l => l.onLoad(img, sizeBytes));
        this.notifySubscribers();
      }, (err) => {
        this._liveListeners(entry).forEach(l => l.onError?.(err));
      }).finally(finish);

      this._liveListeners(entry).forEach(l => l.onProcessListChange?.("LOADING"));
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
    if (!img) throw new Error(i18n.t("cacheService.proxyDecodeFailed"));
    return { img, blob };
  }

  /** Kleine Kopie für einen vorhandenen Cache-Eintrag nachreichen (ohne Quality-Daten zu überschreiben). */
  private async _addThumbnail(cacheKey: string, img: HTMLImageElement): Promise<void> {
    try {
      const thumb = await createThumbnail(img);
      if (!thumb) return;
      const entry = await getFromIndexedDB(cacheKey);
      if (!entry || entry.thumb) return;
      await saveToIndexedDB({
        ...entry, thumb, width: img.naturalWidth, height: img.naturalHeight, sizeBytes: (entry.sizeBytes || 0) + thumb.size,
      });
    } catch (e) { }
  }

  /** Gecachte Blobs eines Bildes (Original und kleine Kopie), ohne Netzwerk. */
  async getCachedBlobs(cardInput: CacheCardInput): Promise<{ blob?: Blob; thumb?: Blob; width?: number; height?: number } | undefined> {
    try {
      const entry = await getFromIndexedDB(this._makeCacheKey(cardInput));
      if (!entry || (!entry.blob && !entry.thumb)) return undefined;
      return { blob: entry.blob || undefined, thumb: entry.thumb, width: entry.width, height: entry.height };
    } catch (e) {
      return undefined;
    }
  }

  /** Original aus dem Cache dekodieren (z.B. für die Schärfemessung, wenn die Kachel nur die kleine Kopie hält). */
  loadFullFromCache(cardInput: CacheCardInput): Promise<HTMLImageElement | null> {
    return this.loadImageFromPersistentCache(this._makeCacheKey(cardInput));
  }

  private _createImageFromBlob(blob: Blob, revokeAfterLoad = false): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      img.onload = () => {
        if (revokeAfterLoad) URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
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

  /** Leert den Cache bis auf die geschützten Einträge und stoppt alle Downloads. */
  async clearCache(): Promise<void> {
    await this._deleteUnlocked({});
    clearProxyFailures();
    this.queue = [];
    this.activeLoads = 0;
    this.notifyAllStatuses();
    this.notifySubscribers();
  }

  async clearCacheForCardName(cardName: string): Promise<void> {
    await this.deleteUnlocked({ cardName });
  }

  /** Anzahl und Größe aller gecachten Bilder einer Karte (über alle APIs) */
  async getCacheStatsForCardName(cardName: string): Promise<{ count: number; bytes: number }> {
    const entries = await getAllFromIndexedDB();
    return entries
      .filter(value => value.cardInput?.name === cardName)
      .reduce((stats, value) => ({ count: stats.count + 1, bytes: stats.bytes + value.sizeBytes }), { count: 0, bytes: 0 });
  }

  async clearCacheForApiName(apiName: string): Promise<void> {
    await this.deleteUnlocked({ apiName });
  }

  async clearCacheForApiAndCard(apiName: string, cardName: string): Promise<void> {
    await this.deleteUnlocked({ apiName, cardName });
  }

  /** Schützt die passenden Einträge vor dem Löschen oder hebt den Schutz auf. */
  async setLocked(filter: CacheEntryFilter, locked: boolean): Promise<void> {
    const entries = await getAllFromIndexedDB();
    for (const entry of entries) {
      if (matchesFilter(entry, filter) && !!entry.locked !== locked) {
        await saveToIndexedDB({ ...entry, locked });
      }
    }
    this.notifySubscribers();
  }

  /** Löscht die passenden Einträge, geschützte bleiben stehen. */
  async deleteUnlocked(filter: CacheEntryFilter): Promise<void> {
    await this._deleteUnlocked(filter);
    this.notifySubscribers();
  }

  private async _deleteUnlocked(filter: CacheEntryFilter): Promise<void> {
    const entries = await getAllFromIndexedDB();
    for (const entry of entries) {
      if (!entry.locked && matchesFilter(entry, filter)) {
        await deleteFromIndexedDB(entry.cacheKey);
      }
    }
  }

  notifyAllStatuses(): void {
    const total = this.queue.length + this.activeLoads;
    this.queue.forEach((entry, index) => {
      const position = index + 1;
      this._liveListeners(entry).forEach(l => l.onProcessListChange?.(`QUEUED(${position}/${total})`));
    });
  }

  async getSnapshot(): Promise<CacheSnapshot> {
    const byApi = await this.getCacheGroupedByApiName();
    const byCard = await this.getCacheGroupedByCardName();
    const totalSize = await this.getTotalCacheSize();
    const lockedCount = Object.values(byApi).flat().filter(e => e.locked).length;
    const snapshot: CacheSnapshot = { byApi, byCard, totalSize, lockedCount };
    if (
      this._lastSnapshot &&
      this._lastSnapshot.totalSize === snapshot.totalSize &&
      this._lastSnapshot.lockedCount === snapshot.lockedCount &&
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

  private _recordDownload(bytes: number): void {
    if (bytes > 0) this.recentDownloads.push({ at: Date.now(), bytes });
    this._pruneDownloads(Date.now());
  }

  private _pruneDownloads(now: number): void {
    const cutoff = now - DOWNLOAD_RATE_WINDOW_MS;
    while (this.recentDownloads.length > 0 && this.recentDownloads[0].at < cutoff) this.recentDownloads.shift();
  }

  /** Gebündelte Download-Rate (Bytes pro Sekunde): fertig geladene Bytes aller Downloads der letzten Sekunden */
  getDownloadRate(): number {
    this._pruneDownloads(Date.now());
    const bytes = this.recentDownloads.reduce((sum, download) => sum + download.bytes, 0);
    return bytes / (DOWNLOAD_RATE_WINDOW_MS / 1000);
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
