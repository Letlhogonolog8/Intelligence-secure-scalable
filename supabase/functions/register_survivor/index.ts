import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

type LocationPayload = {
  province: string;
  city_town: string;
  physical_address?: string | null;
  gps_coordinates?: string | null;
};

type RequestBody = {
  user_id?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  emergency_contact?: string | null;
  consent?: boolean;
  location?: LocationPayload;
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const hexToBytes = (value: string) => {
  const normalized = value.length % 2 === 0 ? value : `0${value}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
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

const localDevLocationKey = "0123456789abcdef0123456789abcdef";

const isLocalSupabaseRuntime = (supabaseUrl: string) =>
  supabaseUrl.includes("127.0.0.1")
  || supabaseUrl.includes("localhost")
  || supabaseUrl.includes("kong:8000");

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

const computeRiskScore = (payload: RequestBody) => {
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const configuredLocationKey = Deno.env.get("SURVIVOR_LOCATION_KEY") ?? Deno.env.get("CHAT_ENCRYPTION_KEY") ?? "";
    const locationKey = configuredLocationKey || (isLocalSupabaseRuntime(supabaseUrl) ? localDevLocationKey : "");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing environment variables: SUPABASE_URL or SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON payload in request body");
    }

    if (!body?.user_id || !body.full_name || !body.location?.province || !body.location?.city_town) {
      return new Response(JSON.stringify({ error: "Missing required registration fields" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    if (!locationKey) {
      throw new Error("Encryption key (SURVIVOR_LOCATION_KEY) is missing from environment");
    }

    const { encrypted, iv } = await encryptLocation(body.location, locationKey);
    const { riskScore, riskLevel } = computeRiskScore(body);
    const survivorCode = `SVR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: survivor, error: survivorError } = await supabase
      .from("survivors")
      .upsert(
        {
          user_id: body.user_id,
          full_name: body.full_name,
          email: body.email ?? null,
          phone_number: body.phone_number ?? null,
          emergency_contact: body.emergency_contact ?? null,
          consent_accepted: Boolean(body.consent),
          consented_at: body.consent ? new Date().toISOString() : null,
          survivor_code: survivorCode,
          current_risk_level: riskLevel,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (survivorError || !survivor) {
      throw new Error(`Database error (survivors): ${survivorError?.message || 'Unknown error'}`);
    }

    const { error: locationError } = await supabase.from("survivor_location_records").insert({
      survivor_id: survivor.id,
      encrypted_payload: encrypted,
      iv,
    });

    if (locationError) {
      throw new Error(`Database error (location): ${locationError.message}`);
    }

    const { error: riskError } = await supabase.from("survivor_risk_profiles").insert({
      survivor_id: survivor.id,
      risk_level: riskLevel,
      risk_score: riskScore,
      factors: {
        emergency_contact: Boolean(body.emergency_contact),
        gps_provided: Boolean(body.location?.gps_coordinates),
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

    return new Response(
      JSON.stringify({
        success: true,
        survivor_id: survivor.id,
        survivor_code: survivorCode,
        risk_level: riskLevel,
        risk_score: riskScore,
      }),
      { headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Critical Edge Function Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
});
