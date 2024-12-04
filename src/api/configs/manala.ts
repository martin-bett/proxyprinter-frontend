// import { ApiConfig } from "../../service/ApiFactory";

// export default {
//   manala: {
//     "officialWebsite": "https://www.mtgdatabase.com/de/search/",
//     "category": "mtg",
//     "name": "manala",
//     "method": "POST",
//     "baseUrl": "https://www.mtgdatabase.com/en/search/",
//     "requestFormat" : "multipart",
//     "useBackendProxy": true,
//     "requiresCsrfToken":false,
//     "csrfTokenVariableName": "search[csrf_token]",
//     "parameterMap": {"request" :{
//       "search[name]": "{cardname}",
//       "search[showduplicates]": 'on',
//       "search[name_begins]": 'on'
//     }, "url":{}},
//     "dataFormat": "html",
//     "dataListField": "div#list_cards_layout_2 table.dataTable tbody tr",
//     "imageUrlField": "td.img-col img | attr:src",
//     "nameField":"td.details-col div:nth-child(1) a | innerText",
//     "setField": "td.details-col div:nth-child(2) a | innerText",
//     "concurrentLimit":5
//   } as ApiConfig
// };