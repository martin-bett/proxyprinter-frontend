import { parse } from 'node-html-parser';
import { ApiConfig, ApiParams, ApiResult } from './types/types';

export default class ApiFactory {
  private configs!: Record<string, ApiConfig>;

  constructor(configs: Record<string, ApiConfig>) {
    this.configs = configs;
  }

  private getNestedValue(obj: any, path: string): any {
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

      let url = new URL(config.baseUrl);
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
      } else {
        Object.entries(processedParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
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
          'X-Target-URL': url.toString(),
          'X-Request-Format': config.requestFormat || 'urlencoded',
          'X-Request-Method': config.method,
        };
        url = new URL('http://localhost:8080/api/proxy');
        fetchOptions.method = 'post';
      }

      try {
        const response = await fetch(url.toString(), fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        let dataList: any[];
  
        if (config.dataFormat === 'json') {
          const data = JSON.parse(text);
          dataList = this.getNestedValue(data, config.dataListField) || [];
        } else if (config.dataFormat === 'html') {
          const root = parse(text);
          const elements = root.querySelectorAll(config.dataListField);
          dataList = Array.from(elements);
        } else {
          throw new Error(`Unsupported data format: ${config.dataFormat}`);
        }
        const results = await Promise.all(dataList.flatMap(async (item: any) => {
          const baseResult = {
            apiName: config.name,
            name: config.dataFormat === 'json' ? this.getNestedValue(item, config.nameField) : parseHtmlValue(item, config.nameField),
            set: config.setField ? (config.dataFormat === 'json' ? this.getNestedValue(item, config.setField) : parseHtmlValue(item, config.setField)) : undefined,
            setNumber: config.setNumberField ? (config.dataFormat === 'json' ? this.getNestedValue(item, config.setNumberField) : parseHtmlValue(item, config.setNumberField)) : undefined,
            imageUrl: config.dataFormat === 'json' ? this.getNestedValue(item, config.imageUrlField) : parseHtmlValue(item, config.imageUrlField),
            languageCode: config.nestedLanguageLanguageField ? (config.dataFormat === 'json' ? this.getNestedValue(item, config.nestedLanguageLanguageField) : parseHtmlValue(item, config.nestedLanguageLanguageField)) : undefined
          };
  
          let followLinkResults: ApiResult[] = [];
          if (config.followLinkField && config.followLinkDataListField && config.followLinkImageField) {
            const followLinkUrl = this.getNestedValue(item, config.followLinkField);
            if (followLinkUrl) {
              const followLinkResponse = await fetch(followLinkUrl);
              if (followLinkResponse.ok) {
                const followLinkData = await followLinkResponse.json();
                const followLinkDataList = this.getNestedValue(followLinkData, config.followLinkDataListField) || [];
                followLinkResults = followLinkDataList.map((followLinkItem: any) => ({
                  ...baseResult,
                  imageUrl: this.getNestedValue(followLinkItem, config.followLinkImageField!)
                }));
              }
            }
          }
  
          const nestedLanguages = config.nestedLanguageDataListField ? 
          (config.dataFormat === 'json' ? this.getNestedValue(item, config.nestedLanguageDataListField) : item.querySelectorAll(config.nestedLanguageDataListField)) : [];

        if (nestedLanguages && Array.isArray(nestedLanguages)) {
          return [
            baseResult,
            ...nestedLanguages.map((lang: any) => ({
              ...baseResult,
              imageUrl: config.nestedLanguageImageUrlField ? 
                (config.dataFormat === 'json' ? this.getNestedValue(lang, config.nestedLanguageImageUrlField) : parseHtmlValue(lang, config.nestedLanguageImageUrlField)) || baseResult.imageUrl : baseResult.imageUrl,
              languageCode: config.nestedLanguageLanguageField ? 
                (config.dataFormat === 'json' ? this.getNestedValue(lang, config.nestedLanguageLanguageField) : parseHtmlValue(lang, config.nestedLanguageLanguageField)) || baseResult.languageCode : baseResult.languageCode
            })),
            ...followLinkResults
          ];
        }

        return [baseResult, ...followLinkResults];
      }));
  
        const flattenedResults = results.flat()
          .filter((c: ApiResult) => c.imageUrl != null && c.imageUrl)
          .filter((c: ApiResult) => c.name ? c.name === params.cardname || (c.name.indexOf('//') > -1 && c.name.indexOf(params.cardname) > -1) : true);
  
          return { results: flattenedResults, rawResponse: text };
        } catch (error: unknown) {
          console.error(`Error fetching from ${configKey}:`, error);
          return { results: [], rawResponse: error instanceof Error ? error.toString() : String(error) };
        }
      };
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
    const response = await fetch('/api/proxy/csrf-token?csrfName='+csrfTokenVariableName , {
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

function parseHtmlValue(element: HTMLElement, selector: string): string {
  const [cssSelector, valueType] = selector.split('|').map(s => s.trim());
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