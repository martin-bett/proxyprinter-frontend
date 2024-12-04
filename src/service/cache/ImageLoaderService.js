class ImageLoaderService {
  constructor(maxConcurrent = 10) {
    this.queue = [];
    this.activeLoads = 0;
    this.maxConcurrent = maxConcurrent;
    this.cache = new Map();
  }

  addToQueue({ url, priority, onLoad, onError, onProcessListChange, category, cardInput }) {
    if (this.cache.has(url)) {
      const cachedImage = this.cache.get(url);
      onLoad(cachedImage);
      onProcessListChange?.("LOADING");
      return;
    }

    const existingEntry = this.queue.find((entry) => entry.url === url);
    if (existingEntry) {
      // Update priority and merge callbacks
      existingEntry.priority = Math.max(existingEntry.priority, priority);
      existingEntry.onLoad = this.mergeCallbacks(existingEntry.onLoad, onLoad);
      existingEntry.onError = this.mergeCallbacks(existingEntry.onError, onError);
      if (category) existingEntry.category = category;
      this.queue.sort((a, b) => b.priority - a.priority);
      this.notifyAllStatuses();
      return;
    }

    // Add new entry to the queue
    this.queue.push({ url, priority, onLoad, onError, onProcessListChange, category, cardInput });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.notifyAllStatuses();
    this.processQueue();
  }

  stopForFilters(visibleLanguages, visibleApis) {
    // Entferne alle Einträge, die nicht den Filterkriterien entsprechen
    this.queue = this.queue.filter(entry => {
      const { cardInput } = entry;
      const language = cardInput.languageCode || 'No Language';
      return visibleLanguages.has(language) && visibleApis.has(cardInput.apiName);
    });
  
    // Aktualisiere die Statusanzeigen
    this.notifyAllStatuses();
  
    console.log('Queue nach Filterung:', this.queue);
  }

  stopByCategory(category) {
    // Filter out all entries with the specified category

    this.queue = this.queue.filter((entry) => entry.category !== category);
    this.notifyAllStatuses(); // Aktualisiere die Statusanzeigen
    console.log('stoped category :'+category, this.queue.length);
  }

  processQueue() {
    while (this.activeLoads < this.maxConcurrent && this.queue.length > 0) {
      const { url, onLoad, onError, onProcessListChange } = this.queue.shift();
      this.activeLoads++;
      this.notifyAllStatuses();

      const img = new Image();
      img.src = url;

      img.onload = () => {
        this.cache.set(url, img);
        onLoad(img);
        this.activeLoads--;
        this.notifyAllStatuses();
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
}
export const imageLoaderService = new ImageLoaderService();
