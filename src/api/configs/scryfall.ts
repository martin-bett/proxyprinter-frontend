import { ApiConfig } from '../types/types';

export default {
  scryfall: {
    "name": "scryfall",
    "method": "GET",
    "baseUrl": "https://api.scryfall.com/cards/search",
    "parameterMap": {
      "q": "{cardname}",
      "include_multilingual": "true",
      "include_variations": "true",
      "lang":"en",
      "unique":"true"
    },
    "dataFormat": "json",
    "dataListField": "data",
    "imageUrlField": "image_uris.normal",
    "nameField":"name",
    "followLinkField": "prints_search_uri",
    "followLinkDataListField": "data",
    "followLinkImageField": "image_uris.normal",
    "concurrentLimit":5
  } as ApiConfig
};


