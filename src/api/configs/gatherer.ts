import { ApiConfig } from './types';

export default {
  mtggatherer: {
  "name": "mtggatherer",
  "method": "GET",
  "baseUrl": "https://api.magicthegathering.io/v1/cards",
  "parameterMap": {
    "name": "{cardname}"
  },
  "dataFormat": "json",
  "dataListField": "cards",
  "imageUrlField": "imageUrl",
  "nameField":"name",
  "nestedLanguageDataListField":"foreignNames",
  "nestedLanguageImageUrlField":"imageUrl",
  "nestedLanguageLanguageField":"language",
  "concurrentLimit":5
  } as ApiConfig
};