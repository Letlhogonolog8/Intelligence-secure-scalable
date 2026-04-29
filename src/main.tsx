
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { initLogger } from "@/lib/logger"
import { initDatadog } from "@/lib/datadog"
import { initializeI18n } from "@/i18n"

const cleanupLocalServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  if (!isLocalHost) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ("caches" in window) {
    const cacheKeys = await caches.keys()
    const staleCacheKeys = cacheKeys.filter((key) => /workbox|supabase|pwa/i.test(key))
    await Promise.all(staleCacheKeys.map((key) => caches.delete(key)))
  }
}

initLogger()
void initDatadog()
void cleanupLocalServiceWorkers()

const bootstrap = async () => {
  try {
    await initializeI18n()
  } catch {
    // i18n failure is non-fatal — render without translations
  }
  const rootEl = document.getElementById("root")
  if (!rootEl) return
  createRoot(rootEl).render(<App />)
}

bootstrap().catch(() => {
  const rootEl = document.getElementById("root")
  if (rootEl) {
    rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#0a0f1e;color:#fff;padding:2rem;text-align:center"><div><h1 style="font-size:1.5rem;margin-bottom:1rem">AEGIS-AI Platform</h1><p style="color:#94a3b8">Loading failed. Please refresh the page.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;background:#7c3aed;color:#fff;border:none;border-radius:.375rem;cursor:pointer">Retry</button></div></div>'
  }
})
