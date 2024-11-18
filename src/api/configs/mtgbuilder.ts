import { ApiConfig } from '../types/types';

export default {
  mtgbuilder: {
    "officialWebsite": "https://mtgcardbuilder.com/",
    "category": "mtg",
    "name": "mtgbuilder",
    "method": "POST",
    "baseUrl": "https://mtgcardbuilder.com/wp-admin/admin-ajax.php",
    "parameterMap": {
      "search": "{cardname}",
      "method": "search_gallery_cards",
      "action": "builder_ajax",
      "other": "0",
      "nsfw": "0",
      "order": "top"
    },
    "dataFormat": "json",
    "dataListField": "data",
    "setField": "card_edition",
    "setNumberField": "id",
    "nameField": "search_card_name",
    "imageUrlField": "image_url",
    "concurrentLimit": 5
  } as ApiConfig
};