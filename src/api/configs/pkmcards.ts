import { ApiConfig } from '../types/types';

export default {
  pkmcards: {
    "category": "poke",
    "name": "pkmcards",
    "method": "GET",
    "baseUrl": "https://pkmncards.com/",
    "useBackendProxy": true,
    "parameterMap": {
      "s": "{cardname}"
    },
    "dataFormat": "html",
    "dataListField": "main#genesis-content>article",
    "imageUrlField": "img | attr:src",
    "nameField":"a | attr:title",
    "nameSplitCharacter":"·",
    "concurrentLimit":2
  } as ApiConfig
};