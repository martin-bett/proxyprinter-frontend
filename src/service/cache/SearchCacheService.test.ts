import { IDBFactory } from "fake-indexeddb";

// jsdom (Jest 27) kennt structuredClone nicht; die Einträge sind reine JSON-Daten.
if (typeof (global as any).structuredClone !== "function") {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

type Service = typeof import("./SearchCacheService").default;

// Jeder Test bekommt eine frische IndexedDB und frische Module (Verbindungs-Cache).
function loadService(): Service {
  let service!: Service;
  jest.isolateModules(() => {
    service = require("./SearchCacheService").default;
  });
  return service;
}

function openRaw(name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDb(name: string): Promise<"deleted" | "blocked"> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve("deleted");
    req.onblocked = () => resolve("blocked");
    req.onerror = () => reject(req.error);
  });
}

const result = { results: [], rawResponse: "{}" };

beforeEach(() => {
  (global as any).indexedDB = new IDBFactory();
});

test("legt den Store in einer frischen Datenbank an", async () => {
  const service = loadService();
  expect(await service.getSearchCount()).toBe(0);
  await service.setSearchResult("scryfall", "Island", result);
  expect(await service.getSearchCount()).toBe(1);
});

test("repariert eine Datenbank, in der der Store fehlt (Webspeicher geleert)", async () => {
  const empty = await openRaw("mtg_search_cache_db", 1);
  expect(empty.objectStoreNames.contains("searchResults")).toBe(false);
  empty.close();

  const service = loadService();
  expect(await service.getSearchCount()).toBe(0);
  await service.setSearchResult("scryfall", "Island", result);
  expect(await service.hasSearchResult("scryfall", "Island")).toBe(true);
});

test("gibt die Datenbank frei, wenn sie gelöscht wird, und legt sie danach neu an", async () => {
  const service = loadService();
  await service.setSearchResult("scryfall", "Island", result);

  expect(await deleteDb("mtg_search_cache_db")).toBe("deleted");

  expect(await service.getSearchCount()).toBe(0);
  await service.setSearchResult("scryfall", "Forest", result);
  expect(await service.getSearchCount()).toBe(1);
});

test("Bild-Cache funktioniert auch mit fehlendem Store", async () => {
  const empty = await openRaw("mtg_cache_db", 2);
  empty.close();
  let openCacheDb!: typeof import("./openCacheDb").openCacheDb;
  jest.isolateModules(() => {
    openCacheDb = require("./openCacheDb").openCacheDb;
  });
  const db = await openCacheDb("mtg_cache_db", "images");
  expect(db.objectStoreNames.contains("images")).toBe(true);
  expect(db.version).toBe(3);
});
