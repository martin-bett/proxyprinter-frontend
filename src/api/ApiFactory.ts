import path from 'path';

interface ApiConfig {
  name: string;
  method: string;
  baseUrl: string;
  parameterMap: Record<string, string>;
  dataListField: string;
  imageUrlField: string;
  nameField: string;
  languageCodeField: string;
  setField: string;
  setNumberField: string;
  nestedLanguageDataListField:string;
  nestedLanguageImageUrlField:string;
  nestedLanguageLanguageField:string;
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
          const paramValue = value.replace(/\{(\w+)\}/g, (_, p) => params[p as keyof ApiParams] || '');
          body!.append(key, paramValue);
        });
      } else {
        Object.entries(config.parameterMap).forEach(([key, value]) => {
          const paramValue = value.replace(/\{(\w+)\}/g, (_, p) => params[p as keyof ApiParams] || '');
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
        
        const results = dataList.flatMap((item: any) => {
          const baseResult = {
            apiName: config.name,
            name: this.getNestedValue(item, config.nameField),
            set: this.getNestedValue(item, config.setField),
            setNumber: this.getNestedValue(item, config.setNumberField),
            imageUrl: this.getNestedValue(item, config.imageUrlField),
            languageCode: this.getNestedValue(item, config.languageCodeField)
          };
        
          const nestedLanguages = this.getNestedValue(item, config.nestedLanguageDataListField);
        
          if (nestedLanguages && Array.isArray(nestedLanguages)) {
            return [
              baseResult,
              ...nestedLanguages.map((lang: any) => ({
                ...baseResult,
                imageUrl: this.getNestedValue(lang, config.nestedLanguageImageUrlField) || baseResult.imageUrl,
                languageCode: this.getNestedValue(lang, config.nestedLanguageLanguageField) || baseResult.languageCode
              }))
            ];
          }
        
          return [baseResult];
        }).filter((c: ApiResult) => c.name ? c.name === params.cardname || (c.name.indexOf('//') > -1 && c.name.indexOf(params.cardname) > -1) : true);
        return { results, rawResponse: text };
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