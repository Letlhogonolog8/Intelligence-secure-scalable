import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;

const respond = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
  });

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return respond(200, { success: false, error: "Edge function configuration error: Missing environment variables" }, origin);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (req.method !== "POST") {
      return respond(200, { success: false, error: "Method not allowed" }, origin);
    }

    let payload: { username?: string; password?: string; full_name?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return respond(200, { success: false, error: "Invalid JSON payload" }, origin);
    }

    const username = payload.username?.trim();
    const password = payload.password ?? "";
    const fullName = payload.full_name ?? null;

    if (!username || !usernamePattern.test(username)) {
      return respond(200, { success: false, error: "Invalid username format" }, origin);
    }

    if (!password || password.length < 8) {
      return respond(200, { success: false, error: "Password must be at least 8 characters" }, origin);
    }

    const email = `${username.toLowerCase()}@aegis.example`;

    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return respond(200, { success: false, error: `Auth admin error: ${listError.message}` }, origin);
    }

    const users = listData?.users || [];
    const matched = users.find((user) => user.email?.toLowerCase() === email);
    let userId = matched?.id;

    if (userId) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updateError) {
        console.error("Error updating user:", updateError);
        return respond(200, { success: false, error: `Update user error: ${updateError.message}` }, origin);
      }
    } else {
      const { data, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !data?.user) {
        console.error("Error creating user:", createError);
        return respond(200, { success: false, error: `Create user error: ${createError?.message ?? "Unable to create user"}` }, origin);
      }
      userId = data.user.id;
    }

    return respond(200, { success: true, user_id: userId, email }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in create_username_user function:", message);
    return respond(200, { success: false, error: `Unexpected internal server error: ${message}` }, origin);
  }
}

Deno.serve(handleRequest);
