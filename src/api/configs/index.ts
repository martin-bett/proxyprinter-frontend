// apiConfigs/index.ts
import { ApiConfig } from "../../service/ApiFactory";

const context = require.context('./', false, /\.ts$/);
const apiConfigs: Record<string, ApiConfig> = {};

context.keys().forEach((key) => {
  if (key !== './index.ts') {
    const imported = context(key);
    Object.assign(apiConfigs, imported.default);
  }
});

export { apiConfigs };