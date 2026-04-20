import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
      target: 'es2020',
    },
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
  build: {
    target: 'es2020',
    emptyOutDir: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          // Core React libraries
          if (
            id.includes("/react/") ||
            id.includes("react-dom") ||
            id.includes("scheduler")
          ) {
            return "react-core";
          }

          // React Router
          if (id.includes("react-router")) {
            return "react-router";
          }

          // React Query
          if (id.includes("@tanstack/react-query")) {
            return "react-query";
          }

          // UI Components - Split into smaller chunks
          if (id.includes("@radix-ui")) {
            return "radix-ui";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          if (
            id.includes("framer-motion") ||
            id.includes("sonner") ||
            id.includes("next-themes")
          ) {
            return "ui-animations";
          }

          // Data & API
          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("socket.io-client")) {
            return "websocket";
          }

          // Charts & Visualization
          if (id.includes("recharts")) {
            return "charts";
          }

          // Forms & Validation
          if (
            id.includes("react-hook-form") ||
            id.includes("zod") ||
            id.includes("@hookform")
          ) {
            return "forms";
          }

          // Date utilities
          if (id.includes("date-fns")) {
            return "date-utils";
          }

          // i18n
          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "i18n";
          }

          // Everything else
          return "vendor";
        },
        chunkFileNames: (_chunkInfo) => {
          return `assets/js/[name]-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|ttf|eot/i.test(ext || '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash][extname]`;
        },
      },
    },
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
        ],
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "AEGIS-AI National Response Grid",
        short_name: "AEGIS-AI",
        description: "Secure coordination platform for GBV emergency response",
        theme_color: "#04060c",
        background_color: "#04060c",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/favicon.ico", sizes: "48x48 32x32 16x16", type: "image/x-icon" },
        ],
        categories: ["government", "health", "social"],
        lang: "en",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 2592000 },
            },
          },
          {
            urlPattern: /\.(woff2?|ttf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
            },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
