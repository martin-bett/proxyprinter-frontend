import { ApiConfig } from './types';

export default {
  aetherhub: {
    "name": "aetherhub",
    "method": "GET",
    "baseUrl": "https://aetherhub.com/Card/Search",
    "parameterMap": {
      "name": "{cardname}",
      "uniq": false 
    },
    "dataListField": "cards",
    "imageUrlField": "img",
    "setField": "set",
    "nameField":"name",
    "setNumberField": "number",
    "concurrentLimit":5
  } as ApiConfig
};