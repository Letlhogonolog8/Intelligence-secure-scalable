import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const escalationWebhookUrl = Deno.env.get("ESCALATION_WEBHOOK_URL") ?? "";
const escalationWebhookSecret = Deno.env.get("ESCALATION_WEBHOOK_SECRET") ?? "";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

type RequestBody = {
  review_id?: string;
  updates?: Record<string, unknown>;
};

const authenticateRequest = async (supabase: any, req: Request) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

const sendWebhook = async (payload: Record<string, unknown>) => {
  if (!escalationWebhookUrl) {
    return;
  }
  await fetch(escalationWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(escalationWebhookSecret ? { Authorization: `Bearer ${escalationWebhookSecret}` } : {}),
    },
    body: JSON.stringify(payload),
  });
};

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authResult = await authenticateRequest(supabase, req);
    if (!authResult.ok) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.review_id) {
      return new Response(JSON.stringify({ error: "review_id is required" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authResult.user.id)
      .maybeSingle();
    if (!profile || (profile.role !== "admin" && profile.role !== "counselor")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const { data: review, error: reviewError } = await supabase
      .from("escalation_reviews")
      .select("id, session_id, risk_level, emotion_detected, status, assigned_to, updated_at, resolved_at")
      .eq("id", body.review_id)
      .maybeSingle();
    if (reviewError || !review) {
      return new Response(JSON.stringify({ error: "Escalation review not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    await supabase.from("audit_logs").insert({
      user_id: authResult.user.id,
      action: "escalation_review_updated",
      module: "governance",
      description: `Escalation review ${review.id} updated`,
      severity: "info",
    });

    await sendWebhook({
      event: "escalation_review_updated",
      review,
      updates: body.updates ?? null,
      updated_by: authResult.user.id,
    });

    return new Response(JSON.stringify({ success: true, ok: true }), {
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
}

Deno.serve(handleRequest);
