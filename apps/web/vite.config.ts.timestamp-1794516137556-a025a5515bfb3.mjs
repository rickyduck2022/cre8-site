// vite.config.ts
import { defineConfig } from "file:///C:/Users/PATCHES/cre8-site/node_modules/.pnpm/vite@5.4.21_terser@5.51.2/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/PATCHES/cre8-site/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_terser@5.51.2_/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/PATCHES/cre8-site/node_modules/.pnpm/vite-plugin-pwa@0.21.2_vite@5.4.21_terser@5.51.2__workbox-build@7.4.1_@types+babel__core@7.20.5__workbox-window@7.4.1/node_modules/vite-plugin-pwa/dist/index.js";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/PATCHES/cre8-site/apps/web/vite.config.ts";
var vite_config_default = defineConfig(({ command }) => ({
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
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        importScripts: ["/push-worker.js"],
        globPatterns: ["**/*.{js,css,html,png,ico,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/admin(?:\/|$)/, /^\/guides(?:\/|$)/],
        cleanupOutdatedCaches: true
      }
    })
  ],
  resolve: command === "serve" ? {
    alias: [
      { find: /^@craft\/ui\/styles\.css$/, replacement: fileURLToPath(new URL("../../packages/ui/src/foundations/Global.css", __vite_injected_original_import_meta_url)) },
      { find: /^@craft\/ui$/, replacement: fileURLToPath(new URL("../../packages/ui/src/index.ts", __vite_injected_original_import_meta_url)) }
    ]
  } : void 0,
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        ws: true
      },
      "/guides": {
        target: "http://127.0.0.1:3001"
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxQQVRDSEVTXFxcXGNyZTgtc2l0ZVxcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUEFUQ0hFU1xcXFxjcmU4LXNpdGVcXFxcYXBwc1xcXFx3ZWJcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1BBVENIRVMvY3JlOC1zaXRlL2FwcHMvd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiO1xyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSBcIm5vZGU6dXJsXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCB9KSA9PiAoe1xyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiBcInByb21wdFwiLFxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogbnVsbCxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBpZDogXCIvXCIsXHJcbiAgICAgICAgbmFtZTogXCJjcmU4XCIsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogXCJjcmU4XCIsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IFwiVGhlIER1YiBWYXVsdCwgZnJpZW5kcywgYW5kIGNvbnZlcnNhdGlvbnMgaW4gb25lIHBsYWNlLlwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvXCIsXHJcbiAgICAgICAgc2NvcGU6IFwiL1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzE3MWEyMFwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMxNzFhMjBcIixcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL3B3YS0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnlcIiB9LFxyXG4gICAgICAgICAgeyBzcmM6IFwiL3B3YS01MTIucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIiB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBpbXBvcnRTY3JpcHRzOiBbXCIvcHVzaC13b3JrZXIuanNcIl0sXHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXCIqKi8qLntqcyxjc3MsaHRtbCxwbmcsaWNvLHN2Zyx3b2ZmLHdvZmYyfVwiXSxcclxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiBcIi9pbmRleC5odG1sXCIsXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGkoPzpcXC98JCkvLCAvXlxcL2FkbWluKD86XFwvfCQpLywgL15cXC9ndWlkZXMoPzpcXC98JCkvXSxcclxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IGNvbW1hbmQgPT09IFwic2VydmVcIiA/IHtcclxuICAgIGFsaWFzOiBbXHJcbiAgICAgIHsgZmluZDogL15AY3JhZnRcXC91aVxcL3N0eWxlc1xcLmNzcyQvLCByZXBsYWNlbWVudDogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi4vLi4vcGFja2FnZXMvdWkvc3JjL2ZvdW5kYXRpb25zL0dsb2JhbC5jc3NcIiwgaW1wb3J0Lm1ldGEudXJsKSkgfSxcclxuICAgICAgeyBmaW5kOiAvXkBjcmFmdFxcL3VpJC8sIHJlcGxhY2VtZW50OiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuLi8uLi9wYWNrYWdlcy91aS9zcmMvaW5kZXgudHNcIiwgaW1wb3J0Lm1ldGEudXJsKSkgfSxcclxuICAgIF0sXHJcbiAgfSA6IHVuZGVmaW5lZCxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHByb3h5OiB7XHJcbiAgICAgIFwiL2FwaVwiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6MzAwMVwiLFxyXG4gICAgICAgIHdzOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9ndWlkZXNcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjMwMDFcIixcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVTLFNBQVMsb0JBQW9CO0FBQ3BVLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxxQkFBcUI7QUFIMkosSUFBTSwyQ0FBMkM7QUFLMU8sSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxRQUFRLE9BQU87QUFBQSxFQUM1QyxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxNQUNoQixVQUFVO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsUUFDVCxrQkFBa0I7QUFBQSxRQUNsQixhQUFhO0FBQUEsUUFDYixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssZ0JBQWdCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxNQUFNO0FBQUEsVUFDM0UsRUFBRSxLQUFLLGdCQUFnQixPQUFPLFdBQVcsTUFBTSxhQUFhLFNBQVMsZUFBZTtBQUFBLFFBQ3RGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsZUFBZSxDQUFDLGlCQUFpQjtBQUFBLFFBQ2pDLGNBQWMsQ0FBQywyQ0FBMkM7QUFBQSxRQUMxRCxrQkFBa0I7QUFBQSxRQUNsQiwwQkFBMEIsQ0FBQyxrQkFBa0Isb0JBQW9CLG1CQUFtQjtBQUFBLFFBQ3BGLHVCQUF1QjtBQUFBLE1BQ3pCO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUyxZQUFZLFVBQVU7QUFBQSxJQUM3QixPQUFPO0FBQUEsTUFDTCxFQUFFLE1BQU0sNkJBQTZCLGFBQWEsY0FBYyxJQUFJLElBQUksZ0RBQWdELHdDQUFlLENBQUMsRUFBRTtBQUFBLE1BQzFJLEVBQUUsTUFBTSxnQkFBZ0IsYUFBYSxjQUFjLElBQUksSUFBSSxrQ0FBa0Msd0NBQWUsQ0FBQyxFQUFFO0FBQUEsSUFDakg7QUFBQSxFQUNGLElBQUk7QUFBQSxFQUNKLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLElBQUk7QUFBQSxNQUNOO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
