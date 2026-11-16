import { resolveSiteConfig } from "@repo/site-config";
import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = () => {
  const site = resolveSiteConfig(import.meta.env.PUBLIC_SITE_URL);
  const body = `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap-index.xml\n`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
