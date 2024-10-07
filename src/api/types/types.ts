export interface ApiConfig {
  //Info
  category: 'mtg' | 'poke' | 'yugi';
  officialWebsite?: string;

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
  nameSplitCharacter?: string;
  imageUrlField: string;
  languageField?: string;
  setField?: string;
  setNumberField?: string;
  paginationField?:string;

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