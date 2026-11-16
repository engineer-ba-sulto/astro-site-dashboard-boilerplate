import {
  adminUpdateSchema,
  contactListQuerySchema,
  contactsToCsv,
  firstIssueMessage,
} from "@repo/contact-form";
import type { Hono } from "hono";
import type { ApiBindings } from "../bindings";
import { createDb } from "../db/client";
import {
  getContact,
  listContacts,
  listContactsForExport,
  softDeleteContact,
  updateContact,
} from "../db/contacts";
import { requireServiceToken } from "../lib/auth";
import { errorJson } from "../lib/errors";

const EXPORT_LIMIT = 10_000;

function toJson(row: {
  id: number;
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    category: row.category,
    message: row.message,
    status: row.status,
    admin_note: row.adminNote,
    ip_hash: row.ipHash,
    user_agent: row.userAgent,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function registerAdminRoutes(app: Hono<{ Bindings: ApiBindings }>) {
  app.use("/api/admin/*", async (c, next) => {
    const ok = requireServiceToken({
      providedId: c.req.header("cf-access-client-id"),
      providedSecret: c.req.header("cf-access-client-secret"),
      expectedId: c.env.CF_ACCESS_CLIENT_ID,
      expectedSecret: c.env.CF_ACCESS_CLIENT_SECRET,
    });
    if (!ok) return errorJson(c, 401, "UNAUTHORIZED", "認証に失敗しました。");
    await next();
  });

  app.get("/api/admin/contacts/export.csv", async (c) => {
    const parsed = contactListQuerySchema.safeParse({
      status: c.req.query("status"),
      q: c.req.query("q"),
      page: 1,
      perPage: 20,
    });
    if (!parsed.success) {
      return errorJson(c, 400, "VALIDATION_ERROR", firstIssueMessage(parsed.error));
    }
    const rows = await listContactsForExport(
      createDb(c.env.DB),
      { status: parsed.data.status, q: parsed.data.q },
      EXPORT_LIMIT,
    );
    const csv = contactsToCsv(
      rows.map((row) => ({
        createdAt: row.createdAt,
        name: row.name,
        email: row.email,
        category: row.category,
        message: row.message,
        status: row.status,
        adminNote: row.adminNote,
      })),
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="contacts.csv"',
      },
    });
  });

  app.get("/api/admin/contacts", async (c) => {
    const parsed = contactListQuerySchema.safeParse({
      status: c.req.query("status"),
      q: c.req.query("q"),
      page: c.req.query("page") ?? 1,
      perPage: c.req.query("perPage") ?? 20,
    });
    if (!parsed.success) {
      return errorJson(c, 400, "VALIDATION_ERROR", firstIssueMessage(parsed.error));
    }
    const { items, total } = await listContacts(createDb(c.env.DB), parsed.data);
    return c.json({
      items: items.map(toJson),
      total,
      page: parsed.data.page,
      perPage: parsed.data.perPage,
    });
  });

  app.get("/api/admin/contacts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 1) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    const row = await getContact(createDb(c.env.DB), id);
    if (!row) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    return c.json(toJson(row));
  });

  app.patch("/api/admin/contacts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 1) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    const body = await c.req.json().catch(() => null);
    const parsed = adminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson(c, 400, "VALIDATION_ERROR", firstIssueMessage(parsed.error));
    }
    const row = await updateContact(createDb(c.env.DB), id, {
      status: parsed.data.status,
      adminNote: parsed.data.admin_note,
      updatedAt: Math.floor(Date.now() / 1000),
    });
    if (!row) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    return c.json(toJson(row));
  });

  app.delete("/api/admin/contacts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 1) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    const deleted = await softDeleteContact(createDb(c.env.DB), id, Math.floor(Date.now() / 1000));
    if (!deleted) return errorJson(c, 404, "NOT_FOUND", "見つかりません");
    return c.body(null, 204);
  });
}
