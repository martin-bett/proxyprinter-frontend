// Gemeinsames Öffnen der Cache-Datenbanken.
//
// Die Datenbank wird ohne feste Version geöffnet. Fehlt der Object Store
// (z.B. nachdem der Webspeicher im Browser geleert wurde und eine leere
// Datenbank übrig blieb), wird die Version um eins erhöht und der Store
// nachträglich angelegt. Die Verbindung wird pro Datenbank wiederverwendet
// und geschlossen, sobald jemand die Datenbank löschen oder upgraden will.

const connections = new Map<string, Promise<IDBDatabase>>();

function openRaw(dbName: string, storeName: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openWithStore(dbName: string, storeName: string): Promise<IDBDatabase> {
  const db = await openRaw(dbName, storeName);
  if (db.objectStoreNames.contains(storeName)) return db;
  const version = db.version;
  db.close();
  return openRaw(dbName, storeName, version + 1);
}

export function openCacheDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  const cached = connections.get(dbName);
  if (cached) return cached;

  const pending = openWithStore(dbName, storeName);
  connections.set(dbName, pending);
  const forget = () => {
    if (connections.get(dbName) === pending) connections.delete(dbName);
  };
  pending.then(db => {
    db.onversionchange = () => {
      db.close();
      forget();
    };
    db.onclose = forget;
  }, forget);
  return pending;
}
