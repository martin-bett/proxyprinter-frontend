// Minimaler IndexedDB-Ersatz für jsdom: nur was ImageLoaderService benutzt.
const stores = new Map<string, any>();
const request = (result?: any) => {
  const req: any = { result };
  setTimeout(() => req.onsuccess?.({ target: req }), 0);
  return req;
};
(global as any).indexedDB = {
  open: () => {
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({
        objectStore: () => ({
          put: (entry: any) => { stores.set(entry.cacheKey, entry); },
          delete: (key: string) => { stores.delete(key); },
          clear: () => stores.clear(),
          get: (key: string) => request(stores.get(key)),
          getAll: () => request([...stores.values()]),
        }),
      }),
    };
    return request(db);
  },
};
(global as any).URL.createObjectURL = () => "blob:test";
(global as any).URL.revokeObjectURL = () => {};
class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  crossOrigin = "";
  set src(_: string) { setTimeout(() => this.onload?.(), 0); }
}
(window as any).Image = FakeImage;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { imageLoaderService, isProxyOnlyUrl, loadImageElement } = require("./ImageLoaderService");

describe("ImageLoaderService mit Proxy Images", () => {
  let pending: (() => void)[] = [];
  let maxParallel = 0;
  let calls: { input: string; target?: string }[] = [];

  beforeEach(() => {
    pending = [];
    maxParallel = 0;
    calls = [];
    (global as any).fetch = jest.fn((input: string, init?: RequestInit) => {
      const target = (init?.headers as Record<string, string> | undefined)?.["X-Target-URL"];
      calls.push({ input, target });
      return new Promise(resolve => {
        pending.push(() => resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          blob: () => Promise.resolve({ size: 10 }),
          clone() { return this; },
        }));
        maxParallel = Math.max(maxParallel, pending.length);
      });
    });
  });

  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  it("lädt Bilder einer Proxy-API über /api/proxy/image, höchstens 4 gleichzeitig", async () => {
    imageLoaderService.setProxyImageApis(["LowRes"]);
    const loaded: string[] = [];
    for (let i = 0; i < 6; i++) {
      const url = `https://img.example.com/${i}.jpg`;
      await imageLoaderService.addToQueue({
        url,
        priority: 1,
        cardInput: { apiName: "LowRes", name: `Karte ${i}`, imageUrl: url },
        onLoad: () => loaded.push(url),
      });
    }
    // Drosselung pro Host (100ms) abwarten, bis alle freien Plätze angefragt haben
    for (let i = 0; i < 10 && pending.length < 4; i++) await new Promise(r => setTimeout(r, 120));

    expect(calls.every(c => c.input === "/api/proxy/image")).toBe(true);
    expect(calls[0].target).toBe("https://img.example.com/0.jpg");
    expect(pending.length).toBe(4);

    while (loaded.length < 6) {
      pending.splice(0).forEach(resolve => resolve());
      await new Promise(r => setTimeout(r, 150));
    }
    expect(maxParallel).toBe(4);
    expect(imageLoaderService.getQueueNumbers()).toEqual({ queued: 0, active: 0, cacheLoading: 0 });
  });

  it("andere APIs laden weiter direkt", async () => {
    imageLoaderService.setProxyImageApis(["LowRes"]);
    const url = "https://cards.example.com/a.jpg";
    let done = false;
    await imageLoaderService.addToQueue({
      url,
      priority: 1,
      cardInput: { apiName: "Scryfall", name: "Direkt", imageUrl: url },
      onLoad: () => { done = true; },
    });
    await flush();
    await flush();
    expect(calls[0]).toEqual({ input: url, target: undefined });
    pending.splice(0).forEach(resolve => resolve());
    for (let i = 0; i < 5 && !done; i++) await flush();
    expect(done).toBe(true);
  });

  it("lädt Google-Drive-Bilder immer über den Proxy, auch ohne Proxy-API", async () => {
    imageLoaderService.setProxyImageApis([]);
    const url = "https://drive.google.com/uc?export=download&id=1dNP9Ye90DdXlWrvR18us7YTaXjmp7m-o";
    let done = false;
    await imageLoaderService.addToQueue({
      url,
      priority: 1,
      cardInput: { apiName: "custom", name: "Drive", imageUrl: url },
      onLoad: () => { done = true; },
    });
    for (let i = 0; i < 10 && pending.length < 1; i++) await new Promise(r => setTimeout(r, 50));
    expect(calls[0]).toEqual({ input: "/api/proxy/image", target: url });
    pending.splice(0).forEach(resolve => resolve());
    for (let i = 0; i < 5 && !done; i++) await flush();
    expect(done).toBe(true);
  });

  it("erkennt Proxy-only-Hosts", () => {
    expect(isProxyOnlyUrl("https://drive.google.com/uc?export=download&id=abc")).toBe(true);
    expect(isProxyOnlyUrl("https://drive.usercontent.google.com/download?id=abc")).toBe(true);
    expect(isProxyOnlyUrl("https://cards.scryfall.io/large/front/a.jpg")).toBe(false);
    expect(isProxyOnlyUrl("/api/files/download/x")).toBe(false);
    expect(isProxyOnlyUrl(undefined)).toBe(false);
  });

  it("loadImageElement holt Drive-Bilder über den Proxy", async () => {
    const url = "https://drive.google.com/uc?export=download&id=xyz";
    const result = loadImageElement(url);
    for (let i = 0; i < 10 && pending.length < 1; i++) await new Promise(r => setTimeout(r, 50));
    expect(calls[0]).toEqual({ input: "/api/proxy/image", target: url });
    pending.splice(0).forEach(resolve => resolve());
    await expect(result).resolves.toBeTruthy();
  });

  it("meldet Proxy-Fehler und fragt dieselbe URL nicht erneut an", async () => {
    imageLoaderService.setProxyImageApis(["LowRes"]);
    (global as any).fetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 502,
      headers: { get: (name: string) => (name === "X-Proxy-Error" ? "HTTP 308" : null) },
      clone() { return this; },
    }));
    const url = "https://broken.example.com/x.jpg";
    const errors: string[] = [];
    const add = () => imageLoaderService.addToQueue({
      url,
      priority: 1,
      cardInput: { apiName: "LowRes", name: "Kaputt", imageUrl: url },
      onLoad: () => {},
      onError: (e: Error) => errors.push(e.message),
    });
    await add();
    for (let i = 0; i < 10 && errors.length < 1; i++) await new Promise(r => setTimeout(r, 50));
    await add();
    await flush();
    expect(errors).toEqual(["Bild nicht ladbar: HTTP 308", "Bild nicht ladbar: HTTP 308"]);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it("abgebrochene wartende Einträge verlassen die Queue, laufende Downloads werden fertig", async () => {
    imageLoaderService.setProxyImageApis(["Queue"]);
    const loaded: string[] = [];
    const controllers: AbortController[] = [];
    for (let i = 0; i < 6; i++) {
      const url = `https://queue.example.com/${i}.jpg`;
      const controller = new AbortController();
      controllers.push(controller);
      await imageLoaderService.addToQueue({
        url,
        priority: 1,
        signal: controller.signal,
        cardInput: { apiName: "Queue", name: `Abbruch ${i}`, imageUrl: url },
        onLoad: () => loaded.push(url),
      });
    }
    // 4 laufen (Proxy-Limit), 2 warten
    expect(imageLoaderService.getQueueNumbers()).toMatchObject({ queued: 2, active: 4 });

    // Karte 0 läuft schon, Karte 5 wartet: beide weggefiltert
    controllers[0].abort();
    controllers[5].abort();
    expect(imageLoaderService.getQueueNumbers()).toMatchObject({ queued: 1, active: 4 });

    // Nach dem Abbruch gar nicht erst einreihen
    await imageLoaderService.addToQueue({
      url: "https://queue.example.com/late.jpg",
      priority: 1,
      signal: controllers[0].signal,
      cardInput: { apiName: "Queue", name: "Spät", imageUrl: "https://queue.example.com/late.jpg" },
      onLoad: () => loaded.push("late"),
    });
    expect(imageLoaderService.getQueueNumbers()).toMatchObject({ queued: 1 });

    for (let i = 0; i < 20 && imageLoaderService.getQueueNumbers().active + imageLoaderService.getQueueNumbers().queued > 0; i++) {
      pending.splice(0).forEach(resolve => resolve());
      await new Promise(r => setTimeout(r, 150));
    }
    // 5 Downloads insgesamt (0 lief schon), aber Karte 0 bekommt kein onLoad mehr
    expect(calls.length).toBe(5);
    expect(loaded.sort()).toEqual([1, 2, 3, 4].map(i => `https://queue.example.com/${i}.jpg`));
  });
});
export {};

describe("ImageLoaderService Thumbnails", () => {
  const cardInput = { apiName: "A", name: "Bolt", imageUrl: "https://x/bolt.jpg" };
  const key = "A::Bolt::https://x/bolt.jpg";

  it("liefert mit preferThumbnail die kleine Kopie samt Originalmaßen", async () => {
    stores.set(key, { cacheKey: key, sizeBytes: 11, timestamp: 1, imageUrl: cardInput.imageUrl, cardInput,
      blob: { size: 10 }, thumb: { size: 1 }, width: 3000, height: 4000 });
    const meta = await new Promise<any>((resolve, reject) =>
      imageLoaderService.addToQueue({ url: cardInput.imageUrl, priority: 1, cardInput, preferThumbnail: true,
        onLoad: (_img: unknown, _size: number, m: unknown) => resolve(m), onError: reject }));
    expect(meta).toEqual({ fullWidth: 3000, fullHeight: 4000, thumbnail: true });
  });

  it("ohne preferThumbnail kommt das Original ohne meta", async () => {
    const meta = await new Promise<any>((resolve, reject) =>
      imageLoaderService.addToQueue({ url: cardInput.imageUrl, priority: 1, cardInput,
        onLoad: (_img: unknown, _size: number, m: unknown) => resolve(m), onError: reject }));
    expect(meta).toBeUndefined();
  });

  it("getCachedBlobs liefert Original und kleine Kopie", async () => {
    const cached = await imageLoaderService.getCachedBlobs(cardInput);
    expect(cached.thumb).toBeDefined();
    expect(cached.width).toBe(3000);
  });
});
