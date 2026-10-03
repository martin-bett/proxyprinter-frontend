/**
 * Opens an IndexedDB database used purely as a cache.
 *
 * Because the content is only a cache, it is safe to throw it away when the
 * stored database cannot be opened with the requested version, e.g. when an
 * older or newer build of the app created it with a higher version number
 * ("VersionError"). In that case the database is deleted and recreated, so
 * returning visitors never end up with a broken cache.
 *
 * The connection is shared per database and closed automatically when another
 * tab needs to upgrade or delete the database, so tabs never block each other.
 */
type UpgradeFn = (db: IDBDatabase, oldVersion: number, tx: IDBTransaction) => void;

const connections = new Map<string, Promise<IDBDatabase>>();

function openOnce(name: string, version: number, upgrade: UpgradeFn): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (event) => {
      upgrade(req.result, event.oldVersion, req.transaction as IDBTransaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn(`Deleting cache database "${name}" is blocked by another open tab.`);
  });
}

async function openWithRecovery(name: string, version: number, upgrade: UpgradeFn): Promise<IDBDatabase> {
  try {
    return await openOnce(name, version, upgrade);
  } catch (err) {
    if ((err as DOMException | null)?.name !== "VersionError") throw err;
    console.warn(`Cache database "${name}" has an incompatible version, recreating it.`);
    await deleteDb(name);
    return openOnce(name, version, upgrade);
  }
}

export function openCacheDb(name: string, version: number, upgrade: UpgradeFn): Promise<IDBDatabase> {
  let conn = connections.get(name);
  if (!conn) {
    conn = openWithRecovery(name, version, upgrade).then((db) => {
      const forget = () => {
        if (connections.get(name) === conn) connections.delete(name);
      };
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      return db;
    });
    conn.catch(() => {
      if (connections.get(name) === conn) connections.delete(name);
    });
    connections.set(name, conn);
  }
  return conn;
}
