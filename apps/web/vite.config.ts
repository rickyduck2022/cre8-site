import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  plugins: [react()],
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
    },
  },
}));
