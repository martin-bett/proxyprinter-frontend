import { parse } from 'node-html-parser';
import ISO6391 from 'iso-639-1';
import { backendErrorText } from '../i18n/backendError';
import { throttledFetch } from './RequestThrottle';
import { ImageQuality } from "./quality/ImageQuality";

interface BaseConfig {
  id:number;
  type:string;
  //Info
  name: string;
  // Server-controlled, free-form (observed values include both "MTG" and "mtg" casing).
  category: string;
  officialWebsite?: string;
  customArts?: boolean;

  //Publishing / Rating (server-managed)
  published?: boolean;
  ratingCount?: number;
  averageRating?: number;
  ratingValue?: number;

  //Request
  method: 'GET' | 'POST';
  baseUrl: string;
  requestFormat?: 'urlencoded' | 'multipart' | 'json';
  parameterMap?: { request: Record<string, any>; url: Record<string, any> };
  useBackendProxy?: boolean;
  
  //Datalocator
  dataFormat: 'json' | 'html';
  dataListField: string;
  nameField: string;
  imageUrlField: string;

  paginationLinkField?:string;
  paginationMaxPageField?:string;

  // Sprache (ISO-639-1) für Karten ohne Sprachangabe, z. B. "en"
  defaultLanguage?: string;
}

export interface ApiConfig extends BaseConfig {
  type: 'api';
  concurrentLimit: number;
  
  //Custom Request
  csrfTokenVariableName?: string;
  requiresCsrfToken?: boolean;
  // Bilder über /api/proxy/image laden (Host ohne CORS-Header)
  proxyImages?: boolean;
 

  //Datalocator
  nameSplitCharacter?: string;
 
  languageField?: string;
  setField?: string;
  setNumberField?: string;

  //Extended Datalocator
  followLinkField?: string;
  followLinkDataListField?: string;
  followLinkImageField?:string;
  followLinkLanguageField?:string;

  //Language Support
  nestedLanguageDataListField?: string;
  nestedLanguageImageUrlField?: string;
  nestedLanguageLanguageField?: string;

  //Mehrseitige Karten (z.B. Scryfall card_faces): jede Seite mit Bild wird ein eigener Treffer
  cardFacesDataListField?: string;
  cardFacesImageUrlField?: string;
  cardFacesNameField?: string;

  //Verbundene Karten (z.B. Scryfall all_parts): jeder Eintrag einer Liste wird eine eigene Karte
  connectedCards?: ConnectedCardLocator[];
}

/** Eine Liste verbundener Karten im Treffer, z.B. Scryfall all_parts (Tokens, Emblems, Dungeons). */
export interface ConnectedCardLocator {
  dataListField: string;
  nameField: string;
  // Link auf das exakte Objekt im Format eines Treffers dieser API (Scryfall: uri)
  linkField?: string;
  typeField?: string;
}

/** Eine verbundene Karte, die in einem Treffer gefunden wurde. */
export interface ConnectedCard {
  name: string;
  typeLine?: string;
  link?: string;
}

export function hasConnectedCards(config: Config | undefined): boolean {
  return Boolean(config && isApiConfig(config) && config.connectedCards?.some(locator => locator.dataListField && locator.nameField));
}

export interface GalleryConfig extends BaseConfig{
  type: 'gallery';

  // Serverseitiger Abruf (/api/gallery/{id}/fetch), wenn link_pattern oder credential gesetzt ist:
  // link_pattern zerlegt den Link des Nutzers in {id} usw. für die base_url
  linkPattern?: string;
  // Passt der Link nicht, zuerst seinen Weiterleitungen folgen (Kurz-/Teilen-Links)
  followInputRedirects?: boolean;
  // Name eines serverseitig hinterlegten Zugangs, nie ein Geheimnis in der Config selbst
  credential?: string;

  // Nachbearbeitung gelesener Werte per Regex (Ersetzung mit $1). Passt imageUrlPattern nicht, fällt der Treffer weg.
  imageUrlPattern?: string;
  imageUrlReplacement?: string;
  namePattern?: string;
  nameReplacement?: string;
}

/** Läuft die Config über das Backend, weil sie Link-Pattern oder Zugang braucht? */
export function usesBackendFetch(config: Config): config is GalleryConfig {
  const gallery = config as GalleryConfig;
  return !isApiConfig(config) && Boolean(gallery.linkPattern || gallery.credential);
}

export type Config = GalleryConfig | ApiConfig;


export function isApiConfig(config: Config): config is ApiConfig {
  return (
    'concurrentLimit' in config && 
    typeof config.concurrentLimit === 'number' &&
    true
    // config.type === 'api' // optional, falls `method` nur in `ApiConfig` vorhanden ist
  );
}

export function isGalleryConfig(config: Config): config is GalleryConfig {
  return (
    'id' in config &&
    typeof config.id === 'number' &&
    true
    // config.type === 'gallery' // oder eine andere Galerie-spezifische Eigenschaft 
  );
}

export interface ApiParams {
  // Optional: gallery configs are executed without a search term.
  cardname?: string;
  language?: string;
  set?:string;
  // Optional: executeApiRequest tracks/overwrites the page counter internally.
  pageCount?:number;
}

/** Zwischenstand einer laufenden Suche, nach jeder fertigen Seite */
export interface PageProgress {
  /** Treffer bisher, gefiltert wie das Endergebnis */
  count: number;
  requestCount: number;
}

export interface GalleryParams{
  [key: string]: string | undefined;
}

export interface SearchResult{
  name: string;
  apiName: string;
  imageUrl: string;
  set?: string;
  setNumber?: string;
  languageCode?: string;
  // Name der Kartenseite, wenn der Treffer aus einer mehrseitigen Karte stammt
  faceName?: string;
  // Verbundene Karten (Tokens usw.); undefined = Config hat keine Listen oder Treffer stammt aus altem Cache
  connectedCards?: ConnectedCard[];
}

export interface CropSettings {
  offSetX?:number;
  offSetY?:number;
  width?:number;
  height?:number;
  isStretch:boolean;
}

export interface ImageInfo {
  width?:number;
  height?:number;
  fileType?:string;
  quality?: ImageQuality; // Druckschärfe des Textfeldes, kommt asynchron nach dem Laden
}

export interface CardEntrySelection {
  name: string; // Kartenname oder generierter Name
  selectionCategory: string; // z.B. "api", "custom", "upload"
  count: number; // Wie viele Karten werden benötigt
  results: SearchResult[]; // Alle auswählbaren Bilder (z.B. alle Prints)
  selectedIndexes: number[]; // Für jeden Slot: Index in results[]
  imageInfoByIndex: { [idx: number]: ImageInfo };
  cropSettingsByIndex: { [idx: number]: CropSettings };
}

export interface CardEntry {
  results: SearchResult[];
  cropSettings: CropSettings;
  imageInfo: ImageInfo;
  name: string;
  count?:number;
}

export default class ApiFactory {
  private configs!: Record<string, Config>;

  constructor(configs: Record<string, Config>) {
    this.configs = configs;
  }

  private getNestedValue(obj: any, path: string|undefined): any {
    return path ? path.split('.').reduce((o, key) => o && o[key], obj) : null;
  }

  updateConfigs(newConfigs: Config[]) {
    newConfigs.forEach(config => {
      this.configs[config.name] = config;
    });
  }

  createApi(configKey: string): (params: ApiParams, onPage?: (progress: PageProgress) => void) => Promise<{ results: SearchResult[], rawResponse: string, requestCount: number }> {
    const config = this.configs[configKey];
    if (!config) {
      throw new Error(`Config not found for key: ${configKey}`);
    }

    return (params: ApiParams, onPage?: (progress: PageProgress) => void) => this.executeApiRequest(config, params, onPage);
  }

  private processUrl(baseUrl: string, urlParams: Record<string, string> | undefined): string {
    let processedUrl = baseUrl;
    if(!urlParams) return baseUrl;
    
    Object.entries(urlParams).forEach(([paramName, paramValue]) => {
      // Escape special characters in the paramName for the RegExp
      const escapedParam = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\$' + escapedParam + '\\$', 'g');
      processedUrl = processedUrl.replace(regex, paramValue);
    });
    
    return processedUrl;
  }


  private async executeApiRequest(
    config: Config, 
    params: ApiParams,
    onPage?: (progress: PageProgress) => void
): Promise<{ results: SearchResult[], rawResponse: string, requestCount: number }> {
    let allResults: SearchResult[] = [];
    let allRawResponses: string[] = [];
    let currentUrl = this.processUrl(config.baseUrl, config?.parameterMap?.url);
    let pageCount = 1;
    let maxPage: number | undefined = undefined; // maxPage außerhalb der Schleife definieren

    do {
        try {
            // Setze die aktuelle Seite als Parameter
            params = { ...params, pageCount: pageCount };

            const { response } = await this.makeRequest(config, params, currentUrl);
            const text = await response.text();
            allRawResponses.push(text);

            // Wir übergeben die aktuelle URL an parseResponse
            const { dataList, nextUrl, maxPage: newMaxPage } = await this.parseResponse(config, text, currentUrl, pageCount);
            currentUrl = nextUrl;

            // Wenn maxPage in der Antwort definiert ist, aktualisiere maxPage
            if (newMaxPage !== undefined) {
                maxPage = newMaxPage;
            }

            const pageResults = await this.processDataList(dataList, config);
            allResults = allResults.concat(pageResults);
            if (onPage) onPage({ count: this.filterAndDeduplicateResults(allResults, params, config).length, requestCount: allRawResponses.length });

            // Erhöhe den PageCount, wenn mehr Seiten verfügbar sind
            if (maxPage && pageCount < maxPage) {
                pageCount++;
            } else {
                break;
            }

        } catch (error: unknown) {
            // Weiterwerfen statt abbrechen: sonst landet ein leeres oder
            // unvollständiges Ergebnis (z.B. nach 429) dauerhaft im Such-Cache.
            console.error(`Error fetching from ${config.name}:`, error);
            throw error;
        }
    } while (currentUrl.length > 0 || (maxPage && pageCount < maxPage)); // maxPage wird hier genutzt

    return {
        results: this.filterAndDeduplicateResults(allResults, params, config),
        rawResponse: allRawResponses.join('\n'),
        requestCount: allRawResponses.length
    };
}


  

  /**
   * Wertet eine schon geladene Antwort aus, ohne Netzwerk (API-Wizard-Vorschau).
   * all = alle gelesenen Treffer, matching = die, die eine Suche nach cardname behalten würde.
   */
  async previewResponse(config: Config, text: string, cardname: string): Promise<{ all: SearchResult[]; matching: SearchResult[] }> {
    const { dataList } = await this.parseResponse(config, text, config.baseUrl, 1);
    const all = await this.processDataList(dataList, config);
    return { all, matching: this.filterAndDeduplicateResults(all, { cardname }, config) };
  }

  private async makeRequest(
    config: Config, 
    params: ApiParams, 
    currentUrl: string
  ): Promise<{ response: Response, requestUrl: URL }> {
    const processedParams = await this.processRequestParameters(config, params);
    const { requestUrl, fetchOptions } = usesBackendFetch(config)
      ? this.buildBackendFetch(config, processedParams)
      : this.buildRequest(config, processedParams, currentUrl);

    const targetUrl = (fetchOptions.headers as Record<string, string> | undefined)?.['X-Target-URL'];
    const response = await throttledFetch(requestUrl.toString(), fetchOptions, targetUrl);
    if (!response.ok) {
      // Galerie-Endpunkte des Backends schicken {error: "..."} mit, das hilft mehr als nur der Status
      const detail = await response.text()
        .then(text => { try { return backendErrorText(JSON.parse(text)); } catch { return ''; } })
        .catch(() => '');
      throw new Error(detail ? `HTTP error! status: ${response.status}: ${detail}` : `HTTP error! status: ${response.status}`);
    }

    return { response, requestUrl };
  }

  private async processRequestParameters(
    config: Config,
    params: ApiParams
  ): Promise<Record<string, string>> {
    const replacements = {
      cardname: params.cardname,
      lang: params.language,
      set: params.set,
      pageCount: params.pageCount // Neu hinzugefügt
    };
  
    const processedParams = config.parameterMap
      ? Object.entries(config.parameterMap.request).reduce((acc, [key, value]) => {
          acc[key] = value
            // Verarbeite optionale Blöcke: {optional:? ...}
            .replace(/\{optional:\?\s*(.*?)\}/g, (_: string, optionalContent: string) => {
              const replacedContent = optionalContent.replace(/\{(\w+)\}/g, (_: string, placeholder: string) => {
                return String(replacements[placeholder as keyof typeof replacements] ?? ''); // Platzhalter ersetzen
              });
              return replacedContent.trim() ? replacedContent : ''; // Entferne optionalen Block, wenn leer
            })
            // Verarbeite Standard-Platzhalter: {...}
            .replace(/\{(\w+)\}/g, (_: string, placeholder: string) => {
              return String(replacements[placeholder as keyof typeof replacements] ?? ''); // Standard-Platzhalterersetzung
            });
          return acc;
        }, {} as Record<string, string>)
      : {};
  
    if (isApiConfig(config)) {
      if (config.requiresCsrfToken && config.csrfTokenVariableName) {
        const csrfToken = await this.fetchCsrfToken(config.baseUrl, config.csrfTokenVariableName);
        processedParams[config.csrfTokenVariableName] = csrfToken;
      }
    }
  
    console.log(config, params, processedParams); // Debug-Ausgabe
    return processedParams;
  }
  
  
  
  
  

  private buildRequest(
    config: Config, 
    processedParams: Record<string, string>, 
    currentUrl: string
  ): { requestUrl: URL, fetchOptions: RequestInit } {
    let requestUrl: URL;
    let body: URLSearchParams | FormData | string | null = null;
    let headers: Record<string, string> = {};

    if (config.method.toUpperCase() === 'POST') {
      ({ body, headers, requestUrl } = this.buildPostRequest(config, processedParams, currentUrl));
    } else {
      requestUrl = this.buildGetRequest(processedParams, currentUrl);
    }

    const fetchOptions: RequestInit = {
      method: config.method,
      headers: headers,
    };

    if (body) {
      fetchOptions.body = body;
    }

    if (config.useBackendProxy) {
      return this.applyProxyConfig(requestUrl, fetchOptions, config);
    }

    return { requestUrl, fetchOptions };
  }

  // Das Backend löst den Link per Link-Pattern auf, ruft die Quelle (ggf. mit Zugang) ab und gibt die Rohantwort zurück
  private buildBackendFetch(config: GalleryConfig, processedParams: Record<string, string>): { requestUrl: URL, fetchOptions: RequestInit } {
    const input = [...Object.values(processedParams), ...Object.values(config.parameterMap?.url ?? {})]
      .map(value => String(value ?? '').trim())
      .find(value => value && value !== '$GALLERY_INPUT$') ?? '';
    const requestUrl = new URL(`/api/gallery/${config.id}/fetch`, window.location.origin);
    if (input) {
      requestUrl.searchParams.set('input', input);
    }
    return { requestUrl, fetchOptions: { method: 'GET' } };
  }

  private buildPostRequest(
    config: Config, 
    params: Record<string, string>, 
    currentUrl: string
  ): { body: URLSearchParams | FormData | string, headers: Record<string, string>, requestUrl: URL } {
    let body: URLSearchParams | FormData | string;
    const headers: Record<string, string> = {};
    
    if (config.requestFormat === 'multipart') {
      body = new FormData();
      Object.entries(params).forEach(([key, value]) => {
        (body as FormData).append(key, value);
      });
    } else if (config.requestFormat === 'json') {
      body = JSON.stringify(params);
      headers['Content-Type'] = 'application/json';
    } else {
      body = new URLSearchParams(params);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return { body, headers, requestUrl: toRequestUrl(currentUrl) };
  }

  private buildGetRequest(params: Record<string, string>, currentUrl: string): URL {
    const requestUrl = toRequestUrl(currentUrl);
    Object.entries(params).forEach(([key, value]) => {
      // Pagination-Links (z.B. Scryfall next_page) enthalten die Parameter
      // bereits; erneut anhängen würde sie doppelt in die URL schreiben.
      if (!requestUrl.searchParams.has(key)) {
        requestUrl.searchParams.append(key, value);
      }
    });
    return requestUrl;
  }

  private applyProxyConfig(
    requestUrl: URL, 
    fetchOptions: RequestInit, 
    config: Config
  ): { requestUrl: URL, fetchOptions: RequestInit } {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'X-Target-URL': requestUrl.toString(),
      'X-Request-Format': config.requestFormat || 'urlencoded',
      'X-Request-Method': config.method,
    };
    
    return {
      requestUrl: new URL('/api/proxy', window.location.origin),
      fetchOptions: { ...fetchOptions, method: 'POST' }
    };
  }

  private async parseResponse(
    config: Config,
    text: string,
    currentUrl: string,
    pageCount: number
): Promise<{ dataList: any[]; nextUrl: string; maxPage?: number }> {
    let root: any;
    let dataList: any[] = [];
    let nextUrl: string = currentUrl;
    let maxPage: number | undefined;
    

    // Unterscheidung nur bei der Initialisierung
    if (config.dataFormat === 'json') {
        root = JSON.parse(text);
        // Ohne dataListField: Antwort ist selbst die Liste (z.B. [{...}, {...}])
        const found = config.dataListField
            ? this.getValue(root, config, config.dataListField) || []
            : (Array.isArray(root) ? root : []);
        // Objekt statt Liste (z.B. Reddit media_metadata, Schlüssel = Bild-ID): die Einträge sind die Liste
        dataList = Array.isArray(found) ? found : (found && typeof found === 'object' ? Object.values(found) : []);
    } else if (config.dataFormat === 'html') {
        root = parse(text);
        dataList = Array.from(root.querySelectorAll(config.dataListField));
    } else {
        throw new Error(`Unsupported data format: ${config.dataFormat}`);
    }


    // Nächste URL bestimmen
    if (config.paginationLinkField) {
        nextUrl = this.getValue(root, config, config.paginationLinkField) || currentUrl;
        maxPage = nextUrl !== currentUrl ? pageCount + 1 : pageCount;
    }

    // Maximale Seite bestimmen
    if (config.paginationMaxPageField) {
        maxPage = this.getValue(root, config, config.paginationMaxPageField) || pageCount;
    }

    return {
        nextUrl: nextUrl || currentUrl,
        maxPage: maxPage || pageCount,
        dataList: dataList || []
    };
}



  

  private async processDataList(dataList: any[], config: Config): Promise<SearchResult[]> {
    const results = await Promise.all(dataList.flatMap(async (item: any) => {
      const baseResult = this.createBaseResult(item, config);
      const followLinkResults = await this.processFollowLinks(baseResult as SearchResult, item, config);
      const nestedLanguageResults = await this.processNestedLanguages(baseResult as SearchResult, item, config);
      const faceResults = this.processCardFaces(baseResult as SearchResult, item, config);

      return [baseResult, ...followLinkResults, ...nestedLanguageResults, ...faceResults];
    }));

    return results.flat();
  }

  private createBaseResult(item: any, config: Config): SearchResult {
      return {
        apiName: config.name,
        name: this.postProcess(this.getValue(item, config, config.nameField), config, 'name'),
        set: isApiConfig(config) && config.setField ? this.getValue(item, config, config.setField) : undefined,
        setNumber: isApiConfig(config) &&  config.setNumberField ? this.getValue(item, config, config.setNumberField) : undefined,
        imageUrl: this.extractLastLink(this.postProcess(this.getValue(item, config, config.imageUrlField), config, 'imageUrl'), config.baseUrl),
        languageCode: this.baseLanguage(item, config),
        connectedCards: this.extractConnectedCards(item, config)
      } as SearchResult;
  }

  // Gallery-Configs: Regex-Nachbearbeitung von Name und Bild-URL. Beim Bild entscheidet ein nicht passendes Muster über "kein Treffer".
  private postProcess(value: any, config: Config, kind: 'name' | 'imageUrl'): any {
    if (isApiConfig(config)) return value;
    const gallery = config as GalleryConfig;
    const pattern = kind === 'name' ? gallery.namePattern : gallery.imageUrlPattern;
    if (!pattern) return value;
    const replacement = (kind === 'name' ? gallery.nameReplacement : gallery.imageUrlReplacement) ?? '';
    const text = value == null ? '' : String(value);
    try {
      const regex = new RegExp(pattern);
      if (kind === 'imageUrl' && !regex.test(text)) return '';
      return text.replace(regex, replacement);
    } catch {
      console.warn(`Invalid regex pattern in config ${config.name}: ${pattern}`);
      return value;
    }
  }

  // Liest alle Listen verbundener Karten aus. Die Karte selbst (Scryfall listet sie als combo_piece mit) fällt weg.
  private extractConnectedCards(item: any, config: Config): ConnectedCard[] | undefined {
    if (!isApiConfig(config) || !hasConnectedCards(config)) {
      return undefined;
    }
    const ownName = String(this.getValue(item, config, config.nameField) || '');
    const ownNames = [ownName, ...(config.nameSplitCharacter ? ownName.split(config.nameSplitCharacter) : [])]
      .map(name => name.trim().toLowerCase())
      .filter(Boolean);

    const found: ConnectedCard[] = [];
    config.connectedCards!.forEach(locator => {
      if (!locator.dataListField || !locator.nameField) return;
      const list = config.dataFormat === 'json' ?
        this.getNestedValue(item, locator.dataListField) :
        Array.from(item.querySelectorAll(locator.dataListField));
      if (!Array.isArray(list)) return;

      list.forEach((entry: any) => {
        const name = String(this.getValue(entry, config, locator.nameField) || '').trim();
        if (!name || ownNames.includes(name.toLowerCase())) return;
        if (found.some(card => card.name.toLowerCase() === name.toLowerCase())) return;
        found.push({
          name,
          typeLine: locator.typeField ? String(this.getValue(entry, config, locator.typeField) || '') || undefined : undefined,
          link: locator.linkField ? String(this.getValue(entry, config, locator.linkField) || '') || undefined : undefined,
        });
      });
    });
    return found;
  }

  /**
   * Lädt das exakt verlinkte Objekt einer verbundenen Karte (z.B. das Treasure-Token, auf das Scryfall zeigt).
   * Die Antwort hat das Format eines einzelnen Treffers dieser API.
   */
  async fetchConnectedCard(configKey: string, link: string, cardName: string): Promise<{ results: SearchResult[], rawResponse: string, requestCount: number }> {
    const config = this.configs[configKey];
    if (!config) {
      throw new Error(`Config not found for key: ${configKey}`);
    }
    let requestUrl = toRequestUrl(link);
    let fetchOptions: RequestInit = { method: 'GET' };
    if (config.useBackendProxy) {
      ({ requestUrl, fetchOptions } = this.applyProxyConfig(requestUrl, fetchOptions, { ...config, method: 'GET' }));
    }
    const targetUrl = (fetchOptions.headers as Record<string, string> | undefined)?.['X-Target-URL'];
    const response = await throttledFetch(requestUrl.toString(), fetchOptions, targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const item = config.dataFormat === 'json' ? JSON.parse(text) : parse(text);
    const all = await this.processDataList([item], config);
    return {
      results: this.filterAndDeduplicateResults(all, { cardname: cardName }, config),
      rawResponse: text,
      requestCount: 1
    };
  }

  private baseLanguage(item: any, config: Config): string | undefined {
    const raw = isApiConfig(config) && config.languageField ? this.getValue(item, config, config.languageField) : undefined;
    if (raw) return this.normalizeLanguageName(String(raw));
    return config.defaultLanguage ? this.normalizeLanguageName(config.defaultLanguage) : undefined;
  }

  private extractLastLink(srcset: string, baseUrl?: string): string {
    if(!srcset) return '';
    // Match the last URL in the string (starting with http(s):// until the first whitespace)
    const match = srcset.match(/https?:\/\/[^\s]+/g);
    
    // Return the last match if found
    if (match) return match[match.length - 1];
    // Relative Bildpfade (z.B. src="/img/card.png" in HTML-Seiten) gegen die API-URL auflösen
    if (/^[a-z][a-z0-9+.-]*:/i.test(String(srcset).trim())) return '';
    const last = String(srcset).trim().split(/\s*,\s*/).pop()?.split(/\s+/)[0];
    if (!last || !baseUrl || !/^https?:/i.test(baseUrl) || /^[a-z][a-z0-9+.-]*:/i.test(last)) return '';
    try {
      return new URL(last, baseUrl).toString();
    } catch {
      return '';
    }
  }

  private async processFollowLinks(
    baseResult: SearchResult, 
    item: any, 
    config: Config
  ): Promise<SearchResult[]> {
    if(!isApiConfig(config)) return [];
    if (!config.followLinkField || !config.followLinkDataListField || !config.followLinkImageField) {
      return [];
    }

    const followLinkUrl = this.getValue(item, config, config.followLinkField);
    if (!followLinkUrl) {
      return [];
    }

    try {
      const followLinkResponse = await throttledFetch(followLinkUrl);
      if (!followLinkResponse.ok) {
        return [];
      }

      const followLinkData = await followLinkResponse.json();
      const followLinkDataList = this.getValue(followLinkData, config, config.followLinkDataListField) || [];

      return followLinkDataList.map((followLinkItem: any) => ({
        ...baseResult,
        imageUrl: this.getValue(followLinkItem, config, config.followLinkImageField!),
        languageCode: this.normalizeLanguageName(
          config.followLinkLanguageField ? 
            this.getValue(followLinkItem, config, config.followLinkLanguageField) : 
            baseResult.languageCode
        )
      } as SearchResult));
    } catch (error) {
      console.error('Error processing follow links:', error);
      return [];
    }
  }

  private processNestedLanguages(
    baseResult: SearchResult, 
    item: any, 
    config: Config
  ): SearchResult[] {
    if(!isApiConfig(config)) return [];
    if (!config.nestedLanguageDataListField) {
      return [];
    }

    const nestedLanguages = config.dataFormat === 'json' ? 
      this.getNestedValue(item, config.nestedLanguageDataListField) : 
      item.querySelectorAll(config.nestedLanguageDataListField);

    if (!nestedLanguages || !Array.isArray(nestedLanguages)) {
      return [];
    }

    return nestedLanguages
      .filter((lang: any) => this.getValue(lang, config, config.nestedLanguageImageUrlField))
      .map((lang: any) => ({
        ...baseResult,
        imageUrl: config.nestedLanguageImageUrlField ? 
          this.getValue(lang, config, config.nestedLanguageImageUrlField) || baseResult.imageUrl : 
          baseResult.imageUrl,
        languageCode: this.normalizeLanguageName(
          config.nestedLanguageLanguageField ? 
            this.getValue(lang, config, config.nestedLanguageLanguageField) || baseResult.languageCode : 
            baseResult.languageCode
        )
      }));
  }

  // Seiten ohne eigenes Bild (z.B. Split- oder Adventure-Karten bei Scryfall) liefern keinen Treffer,
  // dort reicht das Bild der ganzen Karte. Der Name bleibt der volle Kartenname, damit die
  // Namensprüfung über nameSplitCharacter weiter greift; die Seite steht in faceName.
  private processCardFaces(
    baseResult: SearchResult,
    item: any,
    config: Config
  ): SearchResult[] {
    if (!isApiConfig(config) || !config.cardFacesDataListField || !config.cardFacesImageUrlField) {
      return [];
    }

    const faces = config.dataFormat === 'json' ?
      this.getNestedValue(item, config.cardFacesDataListField) :
      Array.from(item.querySelectorAll(config.cardFacesDataListField));

    if (!faces || !Array.isArray(faces)) {
      return [];
    }

    return faces
      .map((face: any) => ({
        ...baseResult,
        imageUrl: this.extractLastLink(this.getValue(face, config, config.cardFacesImageUrlField)),
        faceName: config.cardFacesNameField ?
          (this.getValue(face, config, config.cardFacesNameField) || '').trim() || undefined :
          undefined
      }))
      .filter((face: SearchResult) => Boolean(face.imageUrl));
  }

  private filterAndDeduplicateResults(
    results: SearchResult[], 
    params: ApiParams, 
    config: Config
  ): SearchResult[] {
    return results
      .reduce((acc: SearchResult[], current: SearchResult) => {
        const isDuplicate = acc.some(item => 
          item.imageUrl === current.imageUrl &&
          item.apiName === current.apiName &&
          item.name === current.name
        );
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, [])
      .filter((result: SearchResult) => this.checkSearchResultValid(result, params, config));
  }

  private checkSearchResultValid(res :SearchResult, para: ApiParams, config: Config) : boolean{
    if(isApiConfig(config)){
      return Boolean(res.imageUrl) && 
        (config.nameSplitCharacter ? 
          (res.name.split(config.nameSplitCharacter).map(name => name.trim()).filter(name => name === para.cardname).length >= 1)
          : 
          (res.name != null && res.name === para.cardname));
    }
    if(isGalleryConfig(config)){
      return Boolean(res.imageUrl);
    }
    else return false;
  }


  private getValue(item: any, config: Config, fieldName: string|undefined) {
    return config.dataFormat === 'json' ? this.getNestedValue(item, fieldName) : parseHtmlValue(item, fieldName);
  }

  // Funktion zum Normalisieren von Sprachcodes
  private normalizeLanguageName(input:string) :string{
    // Entfernen Sie Klammern und ihren Inhalt
    const cleanInput = input.replace(/\s*\([^)]*\)/g, "").trim();
    
    // Aufteilen des Inputs für mehrteilige Sprachnamen
    const parts = cleanInput.split(/\s+/);
    
    // Versuchen Sie, einen Code für den gesamten Input zu finden
    let code = ISO6391.getCode(cleanInput);
    
    // Wenn kein Code gefunden wurde, versuchen Sie es mit dem ersten Teil
    if (!code && parts.length > 1) {
      // Prüfen Sie zuerst den zweiten Teil (falls vorhanden)
      code = ISO6391.getCode(parts[1]);
      
      // Wenn immer noch kein Code gefunden wurde, versuchen Sie es mit dem ersten Teil
      if (!code) {
        code = ISO6391.getCode(parts[0]);
      }
    }
    
    // Wenn immer noch kein Code gefunden wurde, durchsuchen Sie bekannte Sonderfälle
    if (!code) {
      const specialCases:any = {
        'chinese traditional': 'zh',
        'chinese simplified': 'zh',
        'portuguese brazil': 'pt-BR',
        'brazilian portuguese': 'pt-BR',
        'zhs': 'zh',
        'zht': 'zh'
      };
      code = specialCases[cleanInput.toLowerCase()];
    }
    
    // Wenn ein Code gefunden wurde, geben Sie den vollen Namen zurück
    if (code) {
      return ISO6391.getName(code);
    }
    if(ISO6391.validate(input)){
      return ISO6391.getName(input);
    }
    if('ph'=== input || 'Phyrexian' === input){
      return 'Phyrexian';
    }
    // Wenn kein passender Code gefunden wurde
    console.warn(`Could not find a valid language code for "${input}".`);
    return input; // Geben Sie den Originalinput zurück
  }



  async searchAllApis(cardName: string, language?: string, enabledApis?: string[]): Promise<{ [key: string]: { results: SearchResult[], rawResponse: string } }> {
    const results: { [key: string]: { results: SearchResult[], rawResponse: string } } = {};
    const apisToSearch = enabledApis || Object.keys(this.configs);
    for (const configKey of apisToSearch) {
      if (this.configs[configKey]) {
        const api = this.createApi(configKey);
        try {
          const SearchResults = await api({ cardname: cardName, language , pageCount :1});
          results[configKey] = SearchResults;
        } catch (error: unknown) {
          console.error(`Error fetching from ${configKey}:`, error);
          results[configKey] = {
            results: [],
            rawResponse: error instanceof Error ? error.toString() : String(error)
          };
        }
      }
    }
    return results;
  }


  private async fetchCsrfToken(targetUrl: string, csrfTokenVariableName: string): Promise<string> {
    const response = await fetch('/api/proxy/csrf-token?csrfName=' + csrfTokenVariableName, {
      method: 'GET',
      headers: {
        'X-Target-URL': targetUrl
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    return await response.text();
  }

}

// Relative base_url (z.B. /api/gallery/source/reddit) zeigt aufs eigene Backend
function toRequestUrl(url: string): URL {
  return new URL(url, window.location.origin);
}

function parseHtmlValue(element: HTMLElement, selector: string | undefined): string {
  if (!selector) return '';

  // Splitte nach || für Alternativen, z.B. "img.media-lightbox-img | attr:src || img.media-lightbox-img | attr:data-lazy-srcset"
  const alternatives = selector.split('||').map(s => s.trim());

  for (const alt of alternatives) {
    // Splitte wie gehabt in cssSelector und valueType
    const [cssSelector, valueType] = alt.split('|').map(s => s.trim());
    const selectedElement = element.querySelector(cssSelector);

    if (!selectedElement) continue;

    if (valueType === 'innerText') {
      const val = selectedElement.textContent || '';
      if (val) return val;
    } else if (valueType.startsWith('attr:')) {
      const attrName = valueType.split(':')[1];
      const val = selectedElement.getAttribute(attrName) || '';
      if (val) return val;
    }
  }

  return '';
}