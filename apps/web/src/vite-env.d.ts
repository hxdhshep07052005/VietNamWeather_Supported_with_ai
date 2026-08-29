/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css" {
  const css: string;
  export default css;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MAP_TILES_URL: string;
  readonly VITE_GEOAPIFY_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
