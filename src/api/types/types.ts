export interface ApiConfig {
  csrfTokenVariableName?: string;
  requiresCsrfToken?: boolean;
  useBackendProxy?: boolean;
  name: string;
  method: string;
  requestFormat?: 'urlencoded' | 'multipart' | 'json';
  baseUrl: string;
  parameterMap: Record<string, any>;
  concurrentLimit: number;
  dataFormat: 'json' | 'html';
  
  dataListField: string;
  nameField: string;
  imageUrlField: string;
  setField?: string;
  setNumberField?: string;

  followLinkField?: string;
  followLinkDataListField?: string;
  followLinkImageField?:string;

  nestedLanguageDataListField?: string;
  nestedLanguageImageUrlField?: string;
  nestedLanguageLanguageField?: string;
}

export interface ApiParams {
  cardname: string;
  language?: string;
  [key: string]: string | undefined;  // This allows for any string keys
}

export interface ApiResult {
  name: string;
  apiName: string;
  set: string;
  setNumber: string;
  imageUrl: string;
  languageCode: string;
}