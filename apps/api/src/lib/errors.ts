import type { Context } from "hono";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "TURNSTILE_FAILED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL";

export function errorJson(
  c: Context,
  status: 400 | 401 | 404 | 429 | 500,
  code: ErrorCode,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}
