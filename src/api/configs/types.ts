export interface ApiConfig {
    name: string;
    method: string;
    baseUrl: string;
    parameterMap: Record<string, any>;
    dataListField: string;
    nameField: string;
    imageUrlField: string;
    followLinkField?: string;
    followLinkDataListField?: string;
    setField?: string;
    setNumberField?: string;
    nestedLanguageDataListField?: string;
    nestedLanguageImageUrlField?: string;
    nestedLanguageLanguageField?: string;
    concurrentLimit: number;
  }