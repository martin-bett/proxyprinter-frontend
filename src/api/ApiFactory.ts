import { parse } from 'node-html-parser';
import { ApiConfig, ApiParams, ApiResult } from './types/types';

export default class ApiFactory {
  private configs!: Record<string, ApiConfig>;

  constructor(configs: Record<string, ApiConfig>) {
    this.configs = configs;
  }

  private getNestedValue(obj: any, path: string|undefined): any {
    return path ? path.split('.').reduce((o, key) => o && o[key], obj) : null;
  }

  updateConfigs(newConfigs: ApiConfig[]) {
    newConfigs.forEach(config => {
      this.configs[config.name] = config;
    });
  }

  createApi(configKey: string): (params: ApiParams) => Promise<{ results: ApiResult[], rawResponse: string }> {
    const config = this.configs[configKey];
    if (!config) {
      throw new Error(`Config not found for key: ${configKey}`);
    }

    return async (params: ApiParams): Promise<{ results: ApiResult[], rawResponse: string }> => {
      let allResults: ApiResult[] = [];
      let allRawResponses: string[] = [];
      let currentUrl: string = config.baseUrl;

      do {
        let requestUrl: URL;
        let body: URLSearchParams | FormData | string | null = null;
        let headers: Record<string, string> = {};

        const processedParams = Object.entries(config.parameterMap).reduce((acc, [key, value]) => {
          acc[key] = value.replace(/\{(\w+)\}/g, (_: string, p: string) => {
            const paramValue = params[p as keyof ApiParams];
            return paramValue !== undefined ? String(paramValue) : '';
          });
          return acc;
        }, {} as Record<string, string>);

        if (config.requiresCsrfToken && config.csrfTokenVariableName) {
          const csrfToken = await this.fetchCsrfToken(config.baseUrl, config.csrfTokenVariableName);
          processedParams[config.csrfTokenVariableName] = csrfToken;
        }

        if (config.method.toUpperCase() === 'POST') {
          if (config.requestFormat === 'multipart') {
            body = new FormData();
            Object.entries(processedParams).forEach(([key, value]) => {
              (body as FormData).append(key, value);
            });
          } else if (config.requestFormat === 'json') {
            body = JSON.stringify(processedParams);
            headers['Content-Type'] = 'application/json';
          } else {
            body = new URLSearchParams(processedParams);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
          }
          requestUrl = new URL(currentUrl);
        } else {
          requestUrl = new URL(currentUrl);
          Object.entries(processedParams).forEach(([key, value]) => {
            requestUrl.searchParams.append(key, value);
          });
        }

        const fetchOptions: RequestInit = {
          method: config.method,
          headers: headers,
        };

        if (body) {
          fetchOptions.body = body;
        }

        if (config.useBackendProxy) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'X-Target-URL': requestUrl.toString(),
            'X-Request-Format': config.requestFormat || 'urlencoded',
            'X-Request-Method': config.method,
          };
          requestUrl = new URL('/api/proxy', window.location.origin);
          fetchOptions.method = 'POST';
        }

        try {
          const response = await fetch(requestUrl.toString(), fetchOptions);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const text = await response.text();
          allRawResponses.push(text);
          let dataList: any[];

          if (config.dataFormat === 'json') {
            const data = JSON.parse(text);
            dataList = this.getNestedValue(data, config.dataListField) || [];
            if (config.paginationField) {
              currentUrl = this.getNestedValue(data, config.paginationField) || '';
            }
          } else if (config.dataFormat === 'html') {
            const root = parse(text);
            const elements = root.querySelectorAll(config.dataListField);
            dataList = Array.from(elements);
            if (config.paginationField) {
              const paginationElement = root.querySelector(config.paginationField);
              currentUrl = paginationElement ? (paginationElement.getAttribute('href') || '') : '';
            }
          } else {
            throw new Error(`Unsupported data format: ${config.dataFormat}`);
          }

          const pageResults = await Promise.all(dataList.flatMap(async (item: any) => {
            const baseResult: ApiResult = {
              apiName: config.name,
              name: this.getValue(item, config, config.nameField),
              set: config.setField ? this.getValue(item, config, config.setField) : undefined,
              setNumber: config.setNumberField ? this.getValue(item, config, config.setNumberField) : undefined,
              imageUrl: this.getValue(item, config, config.imageUrlField),
              languageCode: config.languageField ? this.getValue(item, config, config.languageField) : undefined
            };

            let followLinkResults: ApiResult[] = [];
            if (config.followLinkField && config.followLinkDataListField && config.followLinkImageField) {
              const followLinkUrl = this.getValue(item, config, config.followLinkField);
              if (followLinkUrl) {
                const followLinkResponse = await fetch(followLinkUrl);
                if (followLinkResponse.ok) {
                  const followLinkData = await followLinkResponse.json();
                  const followLinkDataList = this.getValue(followLinkData, config, config.followLinkDataListField) || [];
                  followLinkResults = followLinkDataList.map((followLinkItem: any) => ({
                    ...baseResult,
                    imageUrl: this.getValue(followLinkItem, config, config.followLinkImageField!),
                    languageCode: config.followLinkLanguageField ? this.getValue(followLinkItem, config, config.followLinkLanguageField) : baseResult.languageCode
                  }));
                }
              }
            }

            const nestedLanguages = config.nestedLanguageDataListField ?
              (config.dataFormat === 'json' ? this.getNestedValue(item, config.nestedLanguageDataListField) : item.querySelectorAll(config.nestedLanguageDataListField)) : [];

            if (nestedLanguages && Array.isArray(nestedLanguages)) {
              return [
                baseResult,
                ...nestedLanguages.filter((lang: any) => this.getValue(lang, config, config.nestedLanguageImageUrlField)).map((lang: any) => ({
                  ...baseResult,
                  imageUrl: config.nestedLanguageImageUrlField ? this.getValue(lang, config, config.nestedLanguageImageUrlField) || baseResult.imageUrl : baseResult.imageUrl,
                  languageCode: config.nestedLanguageLanguageField ? this.getValue(lang, config, config.nestedLanguageLanguageField) || baseResult.languageCode : baseResult.languageCode
                })),
                ...followLinkResults
              ];
            }

            return [baseResult, ...followLinkResults];
          }));

          allResults = allResults.concat(pageResults.flat());

        } catch (error: unknown) {
          console.error(`Error fetching from ${configKey}:`, error);
          break;
        }
      } while (currentUrl && currentUrl !== config.baseUrl);

      const flattenedResults = allResults
        .reduce((acc: ApiResult[], current: ApiResult) => {
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
        .filter((c: ApiResult) => this.checkSearchResultValid(c, params, config));

      return { results: flattenedResults, rawResponse: allRawResponses.join('\n') };
    };
  }

  private checkSearchResultValid(res :ApiResult, para: ApiParams, config: ApiConfig) : boolean{
    return Boolean(res.imageUrl) && 
      (config.nameSplitCharacter ? res.name.split(config.nameSplitCharacter).map(name => name.trim()).filter(name => name === para.cardname).length >= 1 : para.cardname === res.name);
  }

  private getValue(item: any, config: ApiConfig, fieldName: string|undefined) {
    return config.dataFormat === 'json' ? this.getNestedValue(item, fieldName) : parseHtmlValue(item, fieldName);
  }

  async searchAllApis(cardName: string, language?: string, enabledApis?: string[]): Promise<{ [key: string]: { results: ApiResult[], rawResponse: string } }> {
    const results: { [key: string]: { results: ApiResult[], rawResponse: string } } = {};
    const apisToSearch = enabledApis || Object.keys(this.configs);
    for (const configKey of apisToSearch) {
      if (this.configs[configKey]) {
        const api = this.createApi(configKey);
        try {
          const apiResults = await api({ cardname: cardName, language });
          results[configKey] = apiResults;
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

function parseHtmlValue(element: HTMLElement, selector: string|undefined): string {
  const [cssSelector, valueType] = selector? selector.split('|').map(s => s.trim()) : '';
  const selectedElement = element.querySelector(cssSelector);

  if (!selectedElement) return '';

  if (valueType === 'innerText') {
    return selectedElement.textContent || '';
  } else if (valueType.startsWith('attr:')) {
    const attrName = valueType.split(':')[1];
    return selectedElement.getAttribute(attrName) || '';
  }

  return '';
}