// import { ApiConfig } from "../../service/ApiFactory";

// export default {
//   pkmcards: {
//     "category": "poke",
//     "name": "pkmcards",
//     "method": "GET",
//     "baseUrl": "https://pkmncards.com/",
//     "useBackendProxy": true,
//     "parameterMap": {"request" :{
//       "s": "{cardname}"
//     }, "url":{}},
//     "dataFormat": "html",
//     "dataListField": "main#genesis-content>article",
//     "imageUrlField": "img | attr:src",
//     "nameField":"a | attr:title",
//     "nameSplitCharacter":"·",
//     "concurrentLimit":2
//   } as ApiConfig
// };