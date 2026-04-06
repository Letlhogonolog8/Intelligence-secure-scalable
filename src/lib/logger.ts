import { env } from "@/lib/env"

type LogPayload = {
  level: "error" | "info"
  message: string
  name?: string
  stack?: string
  context?: Record<string, unknown>
  timestamp: string
}

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error
  }
  
  if (typeof error === "string") {
    return new Error(error)
  }
  
  if (error && typeof error === "object") {
    // Handle Supabase/Postgrest error objects
    const err = error as Record<string, unknown>
    
    // Check common error fields
    const message = err.message || 
                   err.msg || 
                   err.error || 
                   err.error_description || 
                   err.statusText || 
                   (err.code ? `Error code: ${err.code}` : null)
    
    if (message && typeof message === 'string') {
      return new Error(message)
    }

    // Handle case where message might be another object
    if (message && typeof message === 'object') {
      try {
        return new Error(JSON.stringify(message))
      } catch {
        // ignore
      }
    }
  }
  
  // Last resort for objects
  try {
    const stringified = JSON.stringify(error)
    if (stringified === '{}' && error !== null) {
      // If stringify returns empty object for a non-null object, it might have non-enumerable props
      return new Error(String(error))
    }
    return new Error(stringified)
  } catch {
    return new Error("Unknown error")
  }
}

const sampleRate = env.VITE_LOG_SAMPLE_RATE ?? 1
const shouldSend = () => Math.random() <= sampleRate
const isDatadogEnabled = import.meta.env.VITE_DATADOG_ENABLED === "true"

const getEndpointUrl = (endpoint: string) => {
  try {
    return new URL(endpoint, typeof window !== "undefined" ? window.location.origin : undefined)
  } catch {
    return null
  }
}

const shouldSkipEndpointInDev = (endpoint: string) => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false
  }

  const url = getEndpointUrl(endpoint)
  if (!url) {
    return false
  }

  const isLocalCollector = ["localhost", "127.0.0.1"].includes(url.hostname)
  return isLocalCollector && url.origin !== window.location.origin
}

const postPayload = (endpoint: string, body: string) => {
  if (shouldSkipEndpointInDev(endpoint)) {
    return
  }

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon(endpoint, body)
    return
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

const sendPayload = (payload: LogPayload) => {
  if (!env.VITE_LOG_ENDPOINT || !shouldSend()) {
    return
  }

  postPayload(env.VITE_LOG_ENDPOINT, JSON.stringify(payload))
}

const sendDatadogPayload = (payload: LogPayload) => {
  if (!isDatadogEnabled || !env.VITE_DATADOG_LOGS_ENDPOINT || !shouldSend()) {
    return
  }

  const body = JSON.stringify([
    {
      message: payload.message,
      status: payload.level,
      service: env.VITE_DATADOG_SERVICE ?? "aegis-web",
      ddtags: `env:${env.VITE_DATADOG_ENV ?? "production"},version:${env.VITE_DATADOG_VERSION ?? "unknown"}`,
      ddsource: "aegis-web",
      error: payload.level === "error" ? { name: payload.name, stack: payload.stack } : undefined,
      context: payload.context,
      timestamp: payload.timestamp,
    },
  ])

  postPayload(env.VITE_DATADOG_LOGS_ENDPOINT, body)
}

export const getErrorMessage = (error: unknown): string => {
  const normalized = normalizeError(error)
  const message = normalized.message
  if (typeof message === 'string' && message.length > 0) {
    return message
  }
  return "An unexpected error occurred"
}

export const logError = (error: unknown, context?: Record<string, unknown>) => {
  const normalized = normalizeError(error)
  console.error(normalized)
  const payload: LogPayload = {
    level: "error",
    message: normalized.message,
    name: normalized.name,
    stack: normalized.stack,
    context,
    timestamp: new Date().toISOString(),
  }
  sendPayload(payload)
  sendDatadogPayload(payload)
}

export const logInfo = (message: string, context?: Record<string, unknown>) => {
  console.info(message)
  const payload: LogPayload = {
    level: "info",
    message,
    context,
    timestamp: new Date().toISOString(),
  }
  sendPayload(payload)
  sendDatadogPayload(payload)
}

export const initLogger = () => {
  if (typeof window === "undefined") {
    return
  }
  window.addEventListener("error", (event) => {
    logError(event.error ?? event.message, { source: "window" })
  })
  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason, { source: "unhandledrejection" })
  })
}
