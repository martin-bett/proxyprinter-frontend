import path from 'path';

interface ApiConfig {
  name: string;
  method: string;
  baseUrl: string;
  parameterMap: Record<string, any>;
  concurrentLimit: number;
  dataFormat: 'json' | 'html';
  
  dataListField: string;
  nameField: string;
  setField?: string;
  setNumberField?: string;
  imageUrlField: string;

  followLinkField?: string;
  followLinkDataListField?: string;
  followLinkImageField?:string;

  nestedLanguageDataListField?: string;
  nestedLanguageImageUrlField?: string;
  nestedLanguageLanguageField?: string;
}

interface ApiParams {
  cardname: string;
  language?: string;
}

interface ApiResult {
  name: string;
  apiName: string;
  set: string;
  setNumber: string;
  imageUrl: string;
  languageCode: string;
}

export default class ApiFactory {
  private configs!: Record<string, ApiConfig>;

  constructor(configs: Record<string, ApiConfig>) {
    this.configs = configs;
  }

  private getNestedValue(obj: any, path: string): any {
    return path ? path.split('.').reduce((o, key) => o && o[key], obj) : null;
  }

  createApi(configKey: string): (params: ApiParams) => Promise<{ results: ApiResult[], rawResponse: string }> {
    const config = this.configs[configKey];
    if (!config) {
      throw new Error(`Config not found for key: ${configKey}`);
    }
  
    return async (params: ApiParams): Promise<{ results: ApiResult[], rawResponse: string }> => {
      const url = new URL(config.baseUrl);
      let body: URLSearchParams | null = null;
  
      if (config.method.toUpperCase() === 'POST') {
        body = new URLSearchParams();
        Object.entries(config.parameterMap).forEach(([key, value]) => {
          const paramValue = value.replace(/\{(\w+)\}/g, (_: string, p: string) => params[p as keyof ApiParams] || '');
          body!.append(key, paramValue);
        });
      } else {
        Object.entries(config.parameterMap).forEach(([key, value]) => {
          const paramValue = value.replace(/\{(\w+)\}/g, (_: string, p: string) => params[p as keyof ApiParams] || '');
          url.searchParams.append(key, paramValue);
        });
      }
  
      const fetchOptions: RequestInit = {
        method: config.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
  
      if (body) {
        fetchOptions.body = body;
      }
  
      try {
        const response = await fetch(url.toString(), fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("Error parsing JSON:", e);
          return { results: [], rawResponse: text };
        }
  
        const dataList = this.getNestedValue(data, config.dataListField) || [];
        
        const results = await Promise.all(dataList.flatMap(async (item: any) => {
          const baseResult = {
            apiName: config.name,
            name: this.getNestedValue(item, config.nameField),
            set: config.setField ? this.getNestedValue(item, config.setField) : undefined,
            setNumber: config.setNumberField ? this.getNestedValue(item, config.setNumberField) : undefined,
            imageUrl: this.getNestedValue(item, config.imageUrlField),
            languageCode: config.nestedLanguageLanguageField ? this.getNestedValue(item, config.nestedLanguageLanguageField) : undefined
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
            this.getNestedValue(item, config.nestedLanguageDataListField) : [];
  
          if (nestedLanguages && Array.isArray(nestedLanguages)) {
            return [
              baseResult,
              ...nestedLanguages.map((lang: any) => ({
                ...baseResult,
                imageUrl: config.nestedLanguageImageUrlField ? 
                  this.getNestedValue(lang, config.nestedLanguageImageUrlField) || baseResult.imageUrl : baseResult.imageUrl,
                languageCode: config.nestedLanguageLanguageField ? 
                  this.getNestedValue(lang, config.nestedLanguageLanguageField) || baseResult.languageCode : baseResult.languageCode
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
}