import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;

type LocationPayload = {
  province: string;
  city_town: string;
  physical_address?: string | null;
  gps_coordinates?: string | null;
};

type SurvivorPayload = {
  phone_number?: string | null;
  emergency_contact?: string | null;
  consent?: boolean;
  location?: LocationPayload;
};

type RequestPayload = {
  username?: string;
  password?: string;
  full_name?: string;
  profile?: {
    role?: string;
    full_name?: string | null;
    is_active?: boolean;
    organization_id?: string | null;
  };
  survivor?: SurvivorPayload;
};

const respond = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
  });

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const hexToBytes = (value: string) => {
  const normalized = value.length % 2 === 0 ? value : `0${value}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const getEncryptionKey = async (locationKey: string) => {
  let rawKey: Uint8Array | null = null;

  try {
    const decoded = base64ToBytes(locationKey);
    if (decoded.length === 32) {
      rawKey = decoded;
    }
  } catch {
    rawKey = null;
  }

  if (!rawKey && /^[0-9a-fA-F]{64}$/.test(locationKey)) {
    rawKey = hexToBytes(locationKey);
  }

  if (!rawKey) {
    const utf8Bytes = new TextEncoder().encode(locationKey);
    if (utf8Bytes.length === 32) {
      rawKey = utf8Bytes;
    }
  }

  if (!rawKey || rawKey.length !== 32) {
    throw new Error("Invalid survivor encryption key length (must be 32 bytes)");
  }

  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
};

const encryptLocation = async (payload: LocationPayload, locationKey: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(locationKey);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  return { encrypted: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
};

const computeRiskScore = (payload: SurvivorPayload) => {
  let score = 30;
  if (payload.location?.gps_coordinates) {
    score += 15;
  }
  if (payload.location?.physical_address) {
    score += 10;
  }
  if (payload.emergency_contact) {
    score += 10;
  }
  if (payload.location?.city_town?.toLowerCase().includes("rural")) {
    score += 5;
  }
  const riskScore = Math.min(100, score);
  const riskLevel = riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low";
  return { riskScore, riskLevel };
};

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const locationKey = Deno.env.get("SURVIVOR_LOCATION_KEY") ?? Deno.env.get("CHAT_ENCRYPTION_KEY") ?? "";

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

    let payload: RequestPayload = {};
    try {
      payload = await req.json();
    } catch {
      return respond(200, { success: false, error: "Invalid JSON payload" }, origin);
    }

    const username = payload.username?.trim();
    const password = payload.password ?? "";
    const fullName = payload.full_name ?? null;
    const profile = payload.profile;
    const survivor = payload.survivor;

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

    if (userId && profile?.role) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id: userId,
            role: profile.role,
            full_name: profile.full_name ?? fullName,
            is_active: profile.is_active ?? true,
            organization_id: profile.organization_id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Error upserting user profile:", profileError);
        return respond(200, { success: false, user_id: userId, email, error: `Profile upsert error: ${profileError.message}` }, origin);
      }
    }

    if (userId && profile?.role === "survivor" && survivor) {
      if (!survivor.location?.province || !survivor.location.city_town || !fullName) {
        return respond(200, { success: false, user_id: userId, email, error: "Missing required survivor registration fields" }, origin);
      }

      if (!locationKey) {
        return respond(200, { success: false, user_id: userId, email, error: "Survivor onboarding configuration error: missing survivor encryption key" }, origin);
      }

      try {
        const { encrypted, iv } = await encryptLocation(survivor.location, locationKey);
        const { riskScore, riskLevel } = computeRiskScore(survivor);
        const survivorCode = `SVR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const { data: survivorRecord, error: survivorError } = await supabase
          .from("survivors")
          .upsert(
            {
              user_id: userId,
              full_name: fullName,
              email: null,
              phone_number: survivor.phone_number ?? null,
              emergency_contact: survivor.emergency_contact ?? null,
              consent_accepted: Boolean(survivor.consent),
              consented_at: survivor.consent ? new Date().toISOString() : null,
              survivor_code: survivorCode,
              current_risk_level: riskLevel,
            },
            { onConflict: "user_id" }
          )
          .select("id")
          .single();

        if (survivorError || !survivorRecord) {
          throw new Error(`Database error (survivors): ${survivorError?.message || "Unknown error"}`);
        }

        const { error: locationError } = await supabase.from("survivor_location_records").insert({
          survivor_id: survivorRecord.id,
          encrypted_payload: encrypted,
          iv,
        });

        if (locationError) {
          throw new Error(`Database error (location): ${locationError.message}`);
        }

        const { error: riskError } = await supabase.from("survivor_risk_profiles").insert({
          survivor_id: survivorRecord.id,
          risk_level: riskLevel,
          risk_score: riskScore,
          factors: {
            emergency_contact: Boolean(survivor.emergency_contact),
            gps_provided: Boolean(survivor.location?.gps_coordinates),
          },
        });

        if (riskError) {
          throw new Error(`Database error (risk_profile): ${riskError.message}`);
        }

        await supabase.from("audit_logs").insert({
          action: "survivor_registered",
          module: "survivor_registration",
          description: `Survivor ${survivorCode} registered`,
          severity: "info",
        });

        return respond(
          200,
          {
            success: true,
            user_id: userId,
            email,
            survivor_id: survivorRecord.id,
            survivor_code: survivorCode,
            risk_level: riskLevel,
            risk_score: riskScore,
          },
          origin
        );
      } catch (survivorRegistrationError) {
        const message = survivorRegistrationError instanceof Error
          ? survivorRegistrationError.message
          : String(survivorRegistrationError);
        console.error("Error completing survivor onboarding:", message);
        return respond(200, { success: false, user_id: userId, email, error: message }, origin);
      }
    }

    return respond(200, { success: true, user_id: userId, email }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in create_username_user function:", message);
    return respond(200, { success: false, error: `Unexpected internal server error: ${message}` }, origin);
  }
}

Deno.serve(handleRequest);
