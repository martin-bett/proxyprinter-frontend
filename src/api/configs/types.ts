export interface ApiConfig {
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