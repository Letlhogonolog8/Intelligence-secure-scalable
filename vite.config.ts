import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts-vendor";
          }

          if (
            id.includes("react-router") ||
            id.includes("@tanstack/react-query") ||
            id.includes("/react/") ||
            id.includes("react-dom") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("lucide-react") ||
            id.includes("framer-motion") ||
            id.includes("sonner") ||
            id.includes("next-themes")
          ) {
            return "ui-vendor";
          }

          if (id.includes("@supabase") || id.includes("socket.io-client")) {
            return "data-vendor";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["placeholder.svg", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "AEGIS-AI National Response Grid",
        short_name: "AEGIS-AI",
        description: "Secure coordination platform for GBV emergency response",
        theme_color: "#04060c",
        background_color: "#04060c",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/placeholder.svg", sizes: "any", type: "image/svg+xml" },
          { src: "/placeholder.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
        categories: ["government", "health", "social"],
        lang: "en",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkOnly",
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: mode === "development" },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
