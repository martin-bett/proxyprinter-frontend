import { ApiConfig } from '../types/types';

export default {
  aetherhub: {
    "category": "mtg",
    "name": "aetherhub",
    "method": "GET",
    "baseUrl": "https://aetherhub.com/Card/Search",
    "useBackendProxy": true,
    "parameterMap": {
      "name": "{cardname}",
      "uniq": "false" 
    },
    "dataFormat": "html",
    "dataListField": "div#cards>div",
    "imageUrlField": "img | attr:data-src",
    "nameField":"div.item-hidden-text | innerText",
    "concurrentLimit":2
  } as ApiConfig
};