/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Direct WebSocket endpoint. Required in production; Vercel cannot proxy WS upgrades. */
  readonly VITE_WS_URL?: string;
  /** REST base path. Defaults to the same-origin '/api' rewrite. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
