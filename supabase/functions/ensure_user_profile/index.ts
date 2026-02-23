import { createClient } from "npm:@supabase/supabase-js";

const deno = (globalThis as {
  Deno?: { env: { get: (key: string) => string | undefined }; serve: (handler: (req: Request) => Response | Promise<Response>) => void };
}).Deno;
const denoEnv = deno?.env;
const supabaseUrl = denoEnv?.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY") ?? denoEnv?.get("SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = (denoEnv?.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resolveCorsOrigin = (origin: string | null) => {
  if (!origin) {
    return "*";
  }
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return origin;
  }
  return origin;
};

const buildCorsHeaders = (origin: string | null) => ({
  ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

const authenticateRequest = async (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "Missing Authorization bearer token" };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }
  return { ok: true, user: data.user };
};

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const corsOrigin = resolveCorsOrigin(origin);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(corsOrigin) });
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(corsOrigin) },
    });
  }

  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(corsOrigin) },
      });
    }

    const { user } = authResult;
    const { data: existing, error: fetchError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (fetchError) {
      throw fetchError;
    }
    if (existing) {
      return new Response(JSON.stringify({ profile: existing }), {
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(corsOrigin) },
      });
    }

    const { count } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    const role = (count ?? 0) === 0 ? "admin" : "analyst";

    const { data: inserted, error: insertError } = await supabase
      .from("user_profiles")
      .insert({ id: user.id, role, full_name: user.user_metadata?.full_name ?? null, avatar_url: user.user_metadata?.avatar_url ?? null })
      .select("id, role")
      .single();
    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ profile: inserted }), {
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(corsOrigin) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(corsOrigin) },
    });
  }
}

deno?.serve(handleRequest);
