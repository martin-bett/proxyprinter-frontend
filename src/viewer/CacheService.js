class CacheService {
  constructor() {
    this.searchCache = new Map();
    this.selectedImageCache = new Map();
  }

  getSearchCacheKey(apiKey, cardName) {
    return `search:${apiKey}:${cardName}`;
  }

  getImageCacheKey(cardName, position) {
    return `image:${cardName}:${position}`;
  }

  // Methoden für den Such-Cache
  getSearchResult(apiKey, cardName) {
    return this.searchCache.get(this.getSearchCacheKey(apiKey, cardName));
  }

  setSearchResult(apiKey, cardName, result) {
    this.searchCache.set(this.getSearchCacheKey(apiKey, cardName), result);
  }

  hasSearchResult(apiKey, cardName) {
    return this.searchCache.has(this.getSearchCacheKey(apiKey, cardName));
  }

  // Methoden für den Bild-Cache
  getSelectedImage(cardName, position) {
    return this.selectedImageCache.get(this.getImageCacheKey(cardName, position));
  }

  setSelectedImage(cardName, position, imageUrl) {
    this.selectedImageCache.set(this.getImageCacheKey(cardName, position), imageUrl);
  }

  hasSelectedImage(cardName, position) {
    return this.selectedImageCache.has(this.getImageCacheKey(cardName, position));
  }

  clear() {
    this.searchCache.clear();
    this.selectedImageCache.clear();
  }
}

export default new CacheService();