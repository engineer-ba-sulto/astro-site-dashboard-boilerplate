import { defineMiddleware } from "astro:middleware";
import { readAccessEmail, verifyAccessJwt } from "@repo/auth";
import { readServerEnv } from "./server/api";

function forbidden() {
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><title>403</title><body style="font-family:sans-serif;padding:48px"><h1>403</h1><p>この管理画面を開く権限がありません。</p></body></html>`,
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const env = readServerEnv();
  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!team || !aud) {
    if (import.meta.env.PROD) return forbidden();
    context.locals.accessSkipped = true;
    return next();
  }
  const token = context.request.headers.get("cf-access-jwt-assertion");
  if (!token) return forbidden();
  try {
    const payload = await verifyAccessJwt(token, { teamDomain: team, audience: aud });
    context.locals.userEmail = readAccessEmail(payload);
    return next();
  } catch {
    return forbidden();
  }
});
