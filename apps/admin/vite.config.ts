import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // Local development has a dedicated origin/port; production is mounted at /admin/.
  base: command === "serve" ? "/" : "/admin/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
}));
