import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = (process.env.PUBLIC_SITE_URL ?? "http://localhost:4321").replace(/\/$/, "");

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  adapter: cloudflare(),
  integrations: [sitemap()],
  server: { port: 4321 },
  vite: {
    plugins: [tailwindcss()],
  },
});
