import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

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
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
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
        manualChunks: (id): string | undefined => {
          if (id.includes('node_modules')) {
            // React core split off from router/query so the critical first
            // paint can be cached independently of routing logic.
            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'vendor-react-core';
            }
            if (id.includes('react-router')) {
              return 'vendor-react-router';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform/')) {
              return 'vendor-forms';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-animation';
            }
            if (id.includes('recharts') || id.includes('victory') || id.includes('/d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('@supabase') || id.includes('supabase-js')) {
              return 'vendor-supabase';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            if (id.includes('socket.io') || id.includes('engine.io')) {
              return 'vendor-socket';
            }
            if (id.includes('@xenova/transformers')) {
              return 'vendor-ai-transformers';
            }
            if (id.includes('@datadog/')) {
              return 'vendor-datadog';
            }
            if (id.includes('@sentry/')) {
              return 'vendor-sentry';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            if (id.includes('zod') || id.includes('joi')) {
              return 'vendor-validation';
            }
            return 'vendor-misc';
          }
          // App-level chunks. Survivor / dashboard / analytics are kept as
          // siblings (no cross-chunk import cycles) so Vite + Rollup can
          // tree-shake aggressively without hoisting shared code.
          if (id.includes('src/components/admin')) {
            return 'chunk-admin';
          }
          if (id.includes('src/components/dashboard')) {
            return 'chunk-dashboard';
          }
          if (
            id.includes('src/components/governance') ||
            id.includes('src/components/analytics')
          ) {
            return 'chunk-analytics';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 400,
    reportCompressedSize: false,
    cssCodeSplit: true,
    sourcemap: false,
  },
  plugins: [
    react(),
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
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
