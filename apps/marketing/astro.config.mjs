import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Static marketing site for linkview.com.br. Short links live on lnkv.com.br
// (Cloudflare Worker), the app on app.linkview.com.br (Next). This is the brand
// surface only — no server runtime needed, ships as static HTML.
export default defineConfig({
  site: "https://linkview.com.br",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
