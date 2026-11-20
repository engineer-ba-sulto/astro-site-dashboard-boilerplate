import { contactInputSchema, firstIssueMessage } from "@repo/contact-form";
import { createInsertSchema } from "drizzle-zod";
import type { Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiBindings } from "../bindings";
import { countRecentAttempts, insertAttempt } from "../db/attempts";
import { createDb } from "../db/client";
import { countRecentByIp, insertContact } from "../db/contacts";
import { contacts } from "../db/schema";
import { errorJson } from "../lib/errors";
import { clientIp, hashIp, rateLimitSubject } from "../lib/ip";
import { bindingAllows, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "../lib/ratelimit";
import { verifyTurnstile } from "../lib/turnstile";
import { notifyNewContact } from "../mail/notify";

/** 上限いっぱいの本文（UTF-8）と Turnstile トークンが収まる大きさ。 */
const MAX_CONTACT_BODY_BYTES = 64 * 1024;
/** ハニーポット。超えた値は保存せず入力エラーにする。 */
const MAX_WEBSITE_LENGTH = 200;
/** `application/json` と `application/something+json`。パラメータは含めない。 */
const JSON_MEDIA_TYPE = /^application\/([\w.-]+\+)?json$/i;

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

  app.post("/api/contact", async (c) => {
    if (!c.env.IP_HASH_SECRET) {
      return errorJson(c, 500, "INTERNAL", "内部エラーが発生しました");
    }
    const ip = clientIp(c.req.raw);
    const ipHash = await hashIp(rateLimitSubject(ip), c.env.IP_HASH_SECRET);
    const allowed = await bindingAllows(c.env.RATE_LIMITER, ipHash);
    if (!allowed) return rateLimited(c);

    const db = createDb(c.env.DB);
    const now = Math.floor(Date.now() / 1000);
    const since = now - RATE_LIMIT_WINDOW_SECONDS;
    const saved = await countRecentByIp(db, ipHash, since);
    const demoAttempts = await countRecentAttempts(db, ipHash, since);
    if (saved + demoAttempts >= RATE_LIMIT_MAX) return rateLimited(c);

    if (!isJsonMediaType(c.req.header("content-type"))) {
      return errorJson(c, 400, "VALIDATION_ERROR", "入力内容を確認してください");
    }

    const body = await readBodyLimited(c.req.raw, MAX_CONTACT_BODY_BYTES);
    if (!body.ok) {
      return errorJson(c, 413, "VALIDATION_ERROR", "送信データが大きすぎます。");
    }

    let payload: unknown = null;
    try {
      payload = JSON.parse(new TextDecoder().decode(body.bytes));
    } catch {
      payload = null;
    }

    const website = websiteOf(payload);
    if (website !== undefined && website.length > MAX_WEBSITE_LENGTH) {
      return errorJson(
        c,
        400,
        "VALIDATION_ERROR",
        `ウェブサイトは${MAX_WEBSITE_LENGTH}文字以内で入力してください`,
      );
    }
    if (website !== undefined && website.trim() !== "") {
      return c.json({ id: null }, 201);
    }

    const verdict = await verifyTurnstile({
      secret: c.env.TURNSTILE_SECRET_KEY,
      token: turnstileTokenOf(payload),
      remoteIp: ip,
    });
    if (verdict === "failed") {
      return errorJson(
        c,
        400,
        "TURNSTILE_FAILED",
        "ボット確認に失敗しました。もう一度お試しください。",
      );
    }

    const parsed = contactInputSchema.safeParse(payload);
    if (!parsed.success) {
      return errorJson(c, 400, "VALIDATION_ERROR", firstIssueMessage(parsed.error));
    }
    if (c.env.DEMO_MODE === "true") {
      await insertAttempt(db, ipHash, now);
      return c.json({ id: null }, 201);
    }

    const input = parsed.data;
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
  });
}

function isJsonMediaType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]?.trim() ?? "";
  return JSON_MEDIA_TYPE.test(mediaType);
}

function rateLimited(c: Context) {
  return errorJson(
    c,
    429,
    "RATE_LIMITED",
    "送信回数の上限に達しました。しばらくしてから再度お試しください。",
  );
}

function websiteOf(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("website" in payload)) return undefined;
  const website = payload.website;
  return typeof website === "string" ? website : undefined;
}

function turnstileTokenOf(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("turnstile_token" in payload)) return undefined;
  const token = payload.turnstile_token;
  return typeof token === "string" ? token : undefined;
}

async function readBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false }> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false };
  }
  const stream = request.body;
  if (!stream) return { ok: true, bytes: new Uint8Array() };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return { ok: false };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}
