import { ApiConfig } from '../types/types';

export default {
  pokemontcg: {
    "category": "poke",
    "name": "pokemontcg",
    "method": "GET",
    "baseUrl": "https://api.pokemontcg.io/v2/cards",
    "useBackendProxy": false,
    "parameterMap": {
      "q": "!name:{cardname}"
    },
    "dataFormat": "json",
    "dataListField": "data",
    "imageUrlField": "images.large",
    "nameField":"name",
    "concurrentLimit":2
  } as ApiConfig
};