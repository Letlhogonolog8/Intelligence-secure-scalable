
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { initLogger } from "@/lib/logger"
import { initDatadog } from "@/lib/datadog"
import "./i18n"

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
createRoot(document.getElementById("root")!).render(<App />)
