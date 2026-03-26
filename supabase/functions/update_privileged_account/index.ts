import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-admin-access-token",
  Vary: "Origin",
});

const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
const editableRoles = new Set(["counselor", "ngo", "police", "analyst"]);
const approvalStatuses = new Set(["pending", "approved", "rejected", "suspended"]);

type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

type RequestPayload = {
  target_user_id?: string;
  username?: string;
  password?: string;
  profile?: {
    full_name?: string | null;
    role?: string;
    organization_id?: string | null;
    is_active?: boolean;
    approval_status?: ApprovalStatus;
  };
};

const respond = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
  });

const authenticateRequester = async (
  supabase: ReturnType<typeof createClient>,
  req: Request,
) => {
  const tokenFromCustomHeader = req.headers.get("x-admin-access-token")?.trim() ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const tokenFromAuthorization = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const token = tokenFromCustomHeader || tokenFromAuthorization;

  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
};

const loadProfile = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,role,full_name,organization_id,is_active,approval_status,mfa_enabled,approved_at,approved_by,role_assigned_by")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return respond(200, { success: false, error: "Edge function configuration error: Missing environment variables" }, origin);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (req.method !== "POST") {
      return respond(200, { success: false, error: "Method not allowed" }, origin);
    }

    let payload: RequestPayload = {};
    try {
      payload = await req.json();
    } catch {
      return respond(200, { success: false, error: "Invalid JSON payload" }, origin);
    }

    const requester = await authenticateRequester(supabase, req);
    if (!requester?.id) {
      return respond(200, { success: false, error: "Only approved administrators can update privileged accounts" }, origin);
    }

    const requesterProfile = await loadProfile(supabase, requester.id);
    if (
      !requesterProfile
      || requesterProfile.role !== "admin"
      || requesterProfile.is_active === false
      || requesterProfile.approval_status !== "approved"
    ) {
      return respond(200, { success: false, error: "Only approved administrators can update privileged accounts" }, origin);
    }

    const targetUserId = payload.target_user_id?.trim();
    if (!targetUserId) {
      return respond(200, { success: false, error: "Target user id is required" }, origin);
    }

    const targetProfile = await loadProfile(supabase, targetUserId);
    if (!targetProfile) {
      return respond(200, { success: false, error: "Target profile was not found" }, origin);
    }

    if (!editableRoles.has(targetProfile.role)) {
      return respond(200, { success: false, error: "Only Police, NGO, Analyst, and Counselor accounts can be edited here" }, origin);
    }

    const nextRole = payload.profile?.role?.trim() ?? targetProfile.role;
    if (!editableRoles.has(nextRole)) {
      return respond(200, { success: false, error: "Invalid managed role selection" }, origin);
    }

    const fullName = payload.profile?.full_name?.trim() || targetProfile.full_name || "";
    if (!fullName) {
      return respond(200, { success: false, error: "Full name is required" }, origin);
    }

    const nextApprovalStatus = payload.profile?.approval_status ?? targetProfile.approval_status ?? "approved";
    if (!approvalStatuses.has(nextApprovalStatus)) {
      return respond(200, { success: false, error: "Invalid approval status" }, origin);
    }

    const organizationIdProvided = Boolean(payload.profile && Object.prototype.hasOwnProperty.call(payload.profile, "organization_id"));
    const nextOrganizationId = organizationIdProvided
      ? payload.profile?.organization_id ?? null
      : targetProfile.organization_id ?? null;

    if ((nextRole === "ngo" || nextRole === "police") && !nextOrganizationId) {
      return respond(200, { success: false, error: "Organization assignment is required for NGO and Police accounts" }, origin);
    }

    const nextIsActive = nextApprovalStatus === "approved"
      ? payload.profile?.is_active ?? targetProfile.is_active ?? true
      : false;

    const username = payload.username?.trim();
    if (username && !usernamePattern.test(username)) {
      return respond(200, { success: false, error: "Invalid username format" }, origin);
    }

    const password = payload.password ?? "";
    if (password && password.length < 8) {
      return respond(200, { success: false, error: "Password must be at least 8 characters" }, origin);
    }

    const authUpdate: Record<string, unknown> = {
      email_confirm: true,
      user_metadata: { full_name: fullName },
    };

    if (username) {
      const nextEmail = `${username.toLowerCase()}@aegis.example`;
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return respond(200, { success: false, error: `Auth admin error: ${listError.message}` }, origin);
      }

      const conflictingUser = (listData?.users ?? []).find((item) => item.email?.toLowerCase() === nextEmail && item.id !== targetUserId);
      if (conflictingUser) {
        return respond(200, { success: false, error: "That username is already assigned to another account" }, origin);
      }

      authUpdate.email = nextEmail;
    }

    if (password) {
      authUpdate.password = password;
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetUserId, authUpdate);
    if (authUpdateError) {
      return respond(200, { success: false, error: `Update user error: ${authUpdateError.message}` }, origin);
    }

    const approvedAt = nextApprovalStatus === "approved"
      ? targetProfile.approved_at ?? new Date().toISOString()
      : null;
    const approvedBy = nextApprovalStatus === "approved"
      ? requester.id
      : null;

    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({
        role: nextRole,
        full_name: fullName,
        organization_id: nextOrganizationId,
        is_active: nextIsActive,
        approval_status: nextApprovalStatus,
        approved_at: approvedAt,
        approved_by: approvedBy,
        role_assigned_by: requester.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (profileError) {
      return respond(200, { success: false, error: `Profile update error: ${profileError.message}` }, origin);
    }

    return respond(200, { success: true, user_id: targetUserId }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return respond(200, { success: false, error: message }, origin);
  }
}

Deno.serve(handleRequest);
