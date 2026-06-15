import * as React from "react";
import { createRoot } from "react-dom/client";
import * as ReactDOM from "react-dom";
import App from "./App.tsx";
import "./index.css";
import { initLogger } from "@/lib/logger";
import { initDatadog } from "@/lib/datadog";
import { initializeI18n } from "@/i18n";

if (import.meta.env.DEV) {
  void import("@axe-core/react").then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}

const cleanupStaleServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    const stale = cacheKeys.filter((key) => /workbox-precache/i.test(key));
    await Promise.all(stale.map((key) => caches.delete(key)));
  }
};

initLogger();
void initDatadog();
void cleanupStaleServiceWorkers();

// Self-heal failed lazy-chunk loads. A dynamic import can fail when a fresh
// deploy invalidates the old chunk hashes mid-session, or on a transient
// network blip (e.g. ERR_NETWORK_CHANGED). Reload once to fetch the current
// index + chunks; the sessionStorage guard prevents a reload loop if the
// chunk is genuinely unreachable.
const RELOAD_GUARD_KEY = "aegis-chunk-reload";
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  window.location.reload();
});
// Clear the guard once the app has loaded cleanly so a future stale-chunk
// event can still trigger a one-time recovery.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_GUARD_KEY), 5000);
});

const bootstrap = async () => {
  try {
    await initializeI18n();
  } catch {
    // i18n failure is non-fatal — render without translations
  }
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(<App />);
};

bootstrap().catch(() => {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#0a0f1e;color:#fff;padding:2rem;text-align:center"><div><h1 style="font-size:1.5rem;margin-bottom:1rem">AEGIS-AI Platform</h1><p style="color:#94a3b8">Loading failed. Please refresh the page.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;background:#7c3aed;color:#fff;border:none;border-radius:.375rem;cursor:pointer">Retry</button></div></div>';
  }
});
