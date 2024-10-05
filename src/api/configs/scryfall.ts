import { ApiConfig } from '../types/types';

export default {
  scryfall: {
    "category": "mtg",
    "name": "scryfall",
    "method": "GET",
    "baseUrl": "https://api.scryfall.com/cards/search",
    "parameterMap": {
      "q": "{cardname}",
      "include_multilingual": "true",
      "include_variations": "true",
      "unique":"prints"
    },
    "dataFormat": "json",
    "dataListField": "data",
    "languageField":"lang",
    "setField": "set",
    "imageUrlField": "image_uris.large",
    "nameField":"name",
    "nameSplitCharacter": "//",
    "followLinkField": "prints_search_uri",
    "followLinkDataListField": "data",
    "followLinkLanguageField": "lang",
    "followLinkImageField": "image_uris.large",
    "concurrentLimit":5
  } as ApiConfig
};

