import { ApiConfig } from '../types/types';

export default {
  scryfall: {
    "officialWebsite": "https://scryfall.com/",
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
    "imageUrlField": "image_uris.png",
    "nameField":"name",
    "nameSplitCharacter": "//",
    "concurrentLimit":5,
    "paginationField": "next_page",
  } as ApiConfig
};

