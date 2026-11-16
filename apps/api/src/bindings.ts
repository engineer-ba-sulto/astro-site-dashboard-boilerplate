import type { RateLimiterBinding } from "./lib/ratelimit";

export type ApiBindings = {
  DB: D1Database;
  RATE_LIMITER: RateLimiterBinding;
  IP_HASH_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_NOTIFY_TO?: string;
  CONTACT_FROM?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  DEMO_MODE?: string;
  WEB_ORIGIN?: string;
  DASHBOARD_BASE_URL?: string;
};
