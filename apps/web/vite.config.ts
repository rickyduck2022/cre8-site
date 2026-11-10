import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        id: "/",
        name: "cre8",
        short_name: "cre8",
        description: "The Dub Vault, friends, and conversations in one place.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#171a20",
        theme_color: "#171a20",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        importScripts: ["/push-worker.js"],
        globPatterns: ["**/*.{js,css,html,png,ico,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/admin(?:\/|$)/, /^\/guides(?:\/|$)/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: command === "serve" ? {
    alias: [
      { find: /^@craft\/ui\/styles\.css$/, replacement: fileURLToPath(new URL("../../packages/ui/src/foundations/Global.css", import.meta.url)) },
      { find: /^@craft\/ui$/, replacement: fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)) },
    ],
  } : undefined,
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        ws: true,
      },
      "/guides": {
        target: "http://127.0.0.1:3001",
      },
    },
  },
}));
