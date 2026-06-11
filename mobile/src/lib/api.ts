import { env, hasApi } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Thin fetch wrapper for the AEGIS Express backend. Attaches the current
 * Supabase access token when available and applies a sane timeout so the
 * survivor UI never hangs on a slow/unreachable network.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number; auth?: boolean } = {},
): Promise<T> {
  if (!hasApi) throw new Error("Backend API URL is not configured");

  const { method = "GET", body, timeoutMs = 15000, auth = false } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
