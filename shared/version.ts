import pkg from "../package.json";

/** Única fonte da versão da app: o `version` do package.json. */
export const APP_VERSION: string = pkg.version;
