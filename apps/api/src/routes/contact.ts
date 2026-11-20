import { zValidator } from "@hono/zod-validator";
import { contactInputSchema, firstIssueMessage } from "@repo/contact-form";
import { createInsertSchema } from "drizzle-zod";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiBindings } from "../bindings";
import { createDb } from "../db/client";
import { countRecentByIp, insertContact } from "../db/contacts";
import { contacts } from "../db/schema";
import { errorJson } from "../lib/errors";
import { clientIp, hashIp } from "../lib/ip";
import { bindingAllows, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "../lib/ratelimit";
import { verifyTurnstile } from "../lib/turnstile";
import { notifyNewContact } from "../mail/notify";

const contactInsertSchema = createInsertSchema(contacts);

function allowedOrigin(origin: string, configured: string | undefined): string | null {
  const defaults = ["http://localhost:4321", "http://127.0.0.1:4321"];
  const extra = (configured ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return defaults.includes(origin) || extra.includes(origin) ? origin : null;
}

export function registerContactRoutes(app: Hono<{ Bindings: ApiBindings }>) {
  app.use("/api/contact", async (c, next) => {
    const corsMiddleware = cors({
      origin: (origin) => allowedOrigin(origin, c.env.WEB_ORIGIN),
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["content-type"],
    });
    return corsMiddleware(c, next);
  });

  app.post(
    "/api/contact",
    async (c, next) => {
      const cloned = await c.req.raw
        .clone()
        .json()
        .catch(() => null);
      if (
        cloned &&
        typeof cloned === "object" &&
        "website" in cloned &&
        typeof cloned.website === "string" &&
        cloned.website.trim() !== ""
      ) {
        return c.json({ id: null }, 201);
      }
      const token =
        cloned &&
        typeof cloned === "object" &&
        "turnstile_token" in cloned &&
        typeof cloned.turnstile_token === "string"
          ? cloned.turnstile_token
          : undefined;
      const verdict = await verifyTurnstile({
        secret: c.env.TURNSTILE_SECRET_KEY,
        token,
        remoteIp: clientIp(c.req.raw),
      });
      if (verdict === "failed") {
        return errorJson(
          c,
          400,
          "TURNSTILE_FAILED",
          "ボット確認に失敗しました。もう一度お試しください。",
        );
      }
      await next();
    },
    zValidator("json", contactInputSchema, (result, c) => {
      if (!result.success) {
        return errorJson(c, 400, "VALIDATION_ERROR", firstIssueMessage(result.error));
      }
    }),
    async (c) => {
      const input = c.req.valid("json");
      if (!c.env.IP_HASH_SECRET) {
        return errorJson(c, 500, "INTERNAL", "内部エラーが発生しました");
      }
      const ipHash = await hashIp(clientIp(c.req.raw), c.env.IP_HASH_SECRET);
      const allowed = await bindingAllows(c.env.RATE_LIMITER, ipHash);
      if (!allowed) {
        return errorJson(
          c,
          429,
          "RATE_LIMITED",
          "送信回数の上限に達しました。しばらくしてから再度お試しください。",
        );
      }
      if (c.env.DEMO_MODE === "true") return c.json({ id: null }, 201);

      const db = createDb(c.env.DB);
      const now = Math.floor(Date.now() / 1000);
      const recent = await countRecentByIp(db, ipHash, now - RATE_LIMIT_WINDOW_SECONDS);
      if (recent >= RATE_LIMIT_MAX) {
        return errorJson(
          c,
          429,
          "RATE_LIMITED",
          "送信回数の上限に達しました。しばらくしてから再度お試しください。",
        );
      }
      const userAgent = c.req.header("user-agent")?.slice(0, 500) ?? null;
      const row = contactInsertSchema.parse({
        name: input.name ?? null,
        email: input.email,
        category: input.category ?? null,
        message: input.message,
        status: "new",
        adminNote: null,
        ipHash,
        userAgent,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const id = await insertContact(db, {
        name: row.name ?? null,
        email: row.email,
        category: row.category ?? null,
        message: row.message,
        ipHash: row.ipHash ?? ipHash,
        userAgent: row.userAgent ?? null,
        createdAt: now,
      });
      await notifyNewContact(c.env, {
        id,
        name: input.name ?? null,
        email: input.email,
        category: input.category ?? null,
        message: input.message,
        dashboardBaseUrl: c.env.DASHBOARD_BASE_URL ?? "http://localhost:4322",
      });
      return c.json({ id }, 201);
    },
  );
}
