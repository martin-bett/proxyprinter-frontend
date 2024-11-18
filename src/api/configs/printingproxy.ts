import { ApiConfig } from '../types/types';

export default {
  printingproxies: {
    "officialWebsite": "https://www.printingproxies.com/mtg-proxy-custom-card/?index=1",
    "category": "mtg",
    "name": "printingproxies",
    "method": "POST",
    "baseUrl": "https://www.printingproxies.com/wp-content/plugins/card-demo/ajax/gallery.php",
    "parameterMap": {
      "search": "{cardname}",
      "type": "search",
      "include_variations": "true",
      "ajax_action": "searchGalleryCards",
      "ajax_mod": "card",
      "other": "0",
      "nsfw": "0",
      "order": "top"
    },
    "dataFormat": "json",
    "setField": "card_edition",
    "setNumberField": "id",
    "nameField":"search_card_name",
    "dataListField": "data",
    "imageUrlField": "image_url",
    "concurrentLimit":5
  } as ApiConfig
};