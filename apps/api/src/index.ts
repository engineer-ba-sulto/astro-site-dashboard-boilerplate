import { Hono } from "hono";
import type { ApiBindings } from "./bindings";
import { errorJson } from "./lib/errors";
import { registerAdminRoutes } from "./routes/admin";
import { registerContactRoutes } from "./routes/contact";
import { registerHealthRoutes } from "./routes/health";

export function createApp() {
  const app = new Hono<{ Bindings: ApiBindings }>();
  registerHealthRoutes(app);
  registerContactRoutes(app);
  registerAdminRoutes(app);
  app.notFound((c) => errorJson(c, 404, "NOT_FOUND", "見つかりません"));
  app.onError((error, c) => {
    console.error(JSON.stringify({ event: "api_error", message: error.message }));
    return errorJson(c, 500, "INTERNAL", "内部エラーが発生しました");
  });
  return app;
}

export default createApp();
