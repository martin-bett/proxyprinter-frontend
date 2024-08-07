export interface ApiConfig {
  //Request
  name: string;
  method: string;
  requestFormat?: 'urlencoded' | 'multipart' | 'json';
  baseUrl: string;
  parameterMap: Record<string, any>;
  concurrentLimit: number;
  dataFormat: 'json' | 'html';
  
  //Custom Request
  csrfTokenVariableName?: string;
  requiresCsrfToken?: boolean;
  useBackendProxy?: boolean;

  //Datalocator
  dataListField: string;
  nameField: string;
  imageUrlField: string;
  setField?: string;
  setNumberField?: string;

  //Extended Datalocator
  followLinkField?: string;
  followLinkDataListField?: string;
  followLinkImageField?:string;

  //Language Support
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