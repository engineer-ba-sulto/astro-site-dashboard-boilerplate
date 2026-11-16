import { env as workerEnv } from "cloudflare:workers";

export type ContactJson = {
  id: number;
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  status: string;
  admin_note: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: number;
  updated_at: number;
};

export type ContactList = {
  items: ContactJson[];
  total: number;
  page: number;
  perPage: number;
};

function nonempty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function readServerEnv(): Required<Pick<Env, "API_BASE_URL">> & Env {
  const pick = (key: keyof Env) => {
    try {
      return nonempty(workerEnv[key]) ?? nonempty(import.meta.env[key]);
    } catch {
      return nonempty(import.meta.env[key]);
    }
  };
  return {
    API_BASE_URL: pick("API_BASE_URL") ?? "http://localhost:8787",
    PUBLIC_SITE_URL: pick("PUBLIC_SITE_URL"),
    CF_ACCESS_CLIENT_ID: pick("CF_ACCESS_CLIENT_ID"),
    CF_ACCESS_CLIENT_SECRET: pick("CF_ACCESS_CLIENT_SECRET"),
    ACCESS_TEAM_DOMAIN: pick("ACCESS_TEAM_DOMAIN"),
    ACCESS_AUD: pick("ACCESS_AUD"),
  };
}

function headers(env: Env): Headers {
  const result = new Headers();
  if (env.CF_ACCESS_CLIENT_ID) result.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
  if (env.CF_ACCESS_CLIENT_SECRET) {
    result.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
  }
  return result;
}

export async function apiRequest(env: Env, path: string, init: RequestInit = {}) {
  const url = new URL(path, env.API_BASE_URL ?? "http://localhost:8787");
  const requestHeaders = headers(env);
  for (const [key, value] of new Headers(init.headers)) {
    requestHeaders.set(key, value);
  }
  return fetch(url, { ...init, headers: requestHeaders });
}
