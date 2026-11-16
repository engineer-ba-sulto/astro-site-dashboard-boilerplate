import type { Hono } from "hono";
import type { ApiBindings } from "../bindings";

export function registerHealthRoutes(app: Hono<{ Bindings: ApiBindings }>) {
  app.get("/api/health", (c) => c.json({ ok: true }));
}
