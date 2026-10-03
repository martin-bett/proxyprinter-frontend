import { parse } from 'node-html-parser';
import ISO6391 from 'iso-639-1';
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
}

export interface GalleryConfig extends BaseConfig{
  type: 'gallery';
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

  createApi(configKey: string): (params: ApiParams) => Promise<{ results: SearchResult[], rawResponse: string }> {
    const config = this.configs[configKey];
    if (!config) {
      throw new Error(`Config not found for key: ${configKey}`);
    }

    return (params: ApiParams) => this.executeApiRequest(config, params);
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
    params: ApiParams
): Promise<{ results: SearchResult[], rawResponse: string }> {
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
        rawResponse: allRawResponses.join('\n')
    };
}


  

  private async makeRequest(
    config: Config, 
    params: ApiParams, 
    currentUrl: string
  ): Promise<{ response: Response, requestUrl: URL }> {
    const processedParams = await this.processRequestParameters(config, params);
    const { requestUrl, fetchOptions } = this.buildRequest(config, processedParams, currentUrl);

    const targetUrl = (fetchOptions.headers as Record<string, string> | undefined)?.['X-Target-URL'];
    const response = await throttledFetch(requestUrl.toString(), fetchOptions, targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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

    return { body, headers, requestUrl: new URL(currentUrl) };
  }

  private buildGetRequest(params: Record<string, string>, currentUrl: string): URL {
    const requestUrl = new URL(currentUrl);
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
        dataList = this.getValue(root, config, config.dataListField) || [];
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

      return [baseResult, ...followLinkResults, ...nestedLanguageResults];
    }));

    return results.flat();
  }

  private createBaseResult(item: any, config: Config): SearchResult {
      return {
        apiName: config.name,
        name: this.getValue(item, config, config.nameField),
        set: isApiConfig(config) && config.setField ? this.getValue(item, config, config.setField) : undefined,
        setNumber: isApiConfig(config) &&  config.setNumberField ? this.getValue(item, config, config.setNumberField) : undefined,
        imageUrl: this.extractLastLink(this.getValue(item, config, config.imageUrlField)),
        languageCode: isApiConfig(config) && config.languageField ? 
          this.normalizeLanguageName(this.getValue(item, config, config.languageField)) : 
          undefined
      } as SearchResult;
  }

  private extractLastLink(srcset: string): string {
    if(!srcset) return '';
    // Match the last URL in the string (starting with http(s):// until the first whitespace)
    const match = srcset.match(/https?:\/\/[^\s]+/g);
    
    // Return the last match if found
    return match ? match[match.length - 1] : '';
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
    console.warn(`Konnte keinen gültigen Sprachcode für "${input}" finden.`);
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