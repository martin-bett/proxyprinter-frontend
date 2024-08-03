import { ApiConfig } from './types';

export default {
  manala: {
    "name": "manala",
    "method": "GET",
    "baseUrl": "https://aetherhub.com/Card/Search",
    "parameterMap": {
      "search[name]": "{cardname}",
      "search[showduplicates]": 'on' 
    },
    "dataFormat": "html",
    "dataListField": "div.list_cards_layout_1 > table.dataTable",
    "imageUrlField": "td.img-col > img  | attr:src",
    "nameField":"td.details-col > div.card-name-en-bordered | innerText",
    "concurrentLimit":5
  } as ApiConfig
};