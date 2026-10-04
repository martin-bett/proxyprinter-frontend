// Lokale Ablage der Snapshots in IndexedDB. Wird von „Cache leeren“ nicht angefasst.
import { openCacheDb } from '../cache/openCacheDb';
import { Snapshot, migrateSnapshot } from './snapshot';

const DB_NAME = 'mtg_snapshots_db';
const STORE_NAME = 'snapshots';
/** So viele Snapshots von Generate werden behalten, ältere fliegen raus. */
export const MAX_GENERATE_SNAPSHOTS = 10;

interface SnapshotDbEntry {
  cacheKey: string;
  snapshot: Snapshot;
}

function openDB(): Promise<IDBDatabase> {
  return openCacheDb(DB_NAME, STORE_NAME);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readAll(): Promise<Snapshot[]> {
  const db = await openDB();
  const entries = await request<SnapshotDbEntry[]>(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
  const snapshots: Snapshot[] = [];
  entries.forEach(entry => {
    try {
      snapshots.push(migrateSnapshot(entry.snapshot));
    } catch (error) {
      console.warn('Skipping unreadable snapshot', entry.cacheKey, error);
    }
  });
  return snapshots;
}

/** Alle Snapshots, neueste zuerst. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const snapshots = await readAll();
  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSnapshot(id: string): Promise<Snapshot | undefined> {
  const db = await openDB();
  const entry = await request<SnapshotDbEntry | undefined>(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
  return entry ? migrateSnapshot(entry.snapshot) : undefined;
}

export async function putSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ cacheKey: snapshot.id, snapshot } as SnapshotDbEntry);
  await done(tx);
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await done(tx);
}

export async function deleteAllSnapshots(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  await done(tx);
}

/**
 * Speichert den Snapshot eines Generate. Gab es schon einen mit gleichem Inhalt,
 * wird dieser nur mit dem neuen PDF aktualisiert und rückt nach oben.
 * Danach bleiben höchstens MAX_GENERATE_SNAPSHOTS übrig.
 */
export async function putGenerateSnapshot(snapshot: Snapshot): Promise<Snapshot> {
  const all = await readAll();
  const generated = all.filter(s => s.kind === 'generate');
  const same = generated.find(s => s.contentHash === snapshot.contentHash);
  const saved: Snapshot = same
    ? { ...same, createdAt: snapshot.createdAt, pdf: snapshot.pdf }
    : snapshot;
  await putSnapshot(saved);

  const others = generated.filter(s => s.id !== saved.id).sort((a, b) => b.createdAt - a.createdAt);
  const tooMany = others.slice(MAX_GENERATE_SNAPSHOTS - 1);
  for (const old of tooMany) {
    await deleteSnapshot(old.id);
  }
  return saved;
}

/** Ungefährer Speicherbedarf aller Snapshots in Bytes (JSON-Länge). */
export async function snapshotsSize(): Promise<number> {
  const all = await readAll();
  return all.reduce((sum, s) => sum + JSON.stringify(s).length, 0);
}
