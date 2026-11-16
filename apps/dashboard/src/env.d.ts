/// <reference types="astro/client" />

interface Env {
  API_BASE_URL?: string;
  PUBLIC_SITE_URL?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    userEmail?: string;
    accessSkipped?: boolean;
  }
}

interface ImportMetaEnv {
  readonly API_BASE_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly CF_ACCESS_CLIENT_ID?: string;
  readonly CF_ACCESS_CLIENT_SECRET?: string;
  readonly ACCESS_TEAM_DOMAIN?: string;
  readonly ACCESS_AUD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "cloudflare:workers" {
  export const env: Env;
}
