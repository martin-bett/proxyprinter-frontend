// import { ApiConfig } from "../../service/ApiFactory";


// export default {
//   aetherhub: {
//     "officialWebsite": "https://aetherhub.com/",
//     "category": "mtg",
//     "name": "aetherhub",
//     "method": "GET",
//     "baseUrl": "https://aetherhub.com/Card/Search",
//     "useBackendProxy": true,
//     "parameterMap": {"request" :{
//       "name": "{cardname}",
//       "uniq": "false" 
//     }, "url":{}},
//     "dataFormat": "html",
//     "dataListField": "div#cards>div",
//     "imageUrlField": "img | attr:data-src",
//     "nameField":"div.item-hidden-text | innerText",
//     "concurrentLimit":2
//   } as ApiConfig
// };