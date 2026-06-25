/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  // Suffix appended to the save key for the isolated /preview/ deployment.
  readonly VITE_SAVE_SUFFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
