import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  output: "server",
  trailingSlash: "always",
  adapter: cloudflare(),
  integrations: [react()],
  server: { port: 4322 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "@": src },
    },
  },
});
