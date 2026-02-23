import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const locationKey = Deno.env.get("SURVIVOR_LOCATION_KEY") ?? "";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

type RequestBody = {
  sessionId?: string;
  phoneNumber?: string;
  text?: string;
};

type SessionPayload = {
  province?: string;
  area?: string;
  description?: string;
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
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

const getEncryptionKey = async () => {
  const rawKey = base64ToBytes(locationKey);
  if (rawKey.length !== 32) {
    throw new Error("Invalid SURVIVOR_LOCATION_KEY length");
  }
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
};

const encryptLocation = async (payload: SessionPayload) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  return { encrypted: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
};

const extractInput = (text: string | undefined) => {
  if (!text) return "";
  const parts = text.split("*");
  return parts[parts.length - 1] ?? "";
};

const computeRiskScore = (description: string) => {
  const normalized = description.toLowerCase();
  let score = 35;
  if (normalized.includes("weapon") || normalized.includes("knife") || normalized.includes("gun")) {
    score += 35;
  }
  if (normalized.includes("assault") || normalized.includes("rape") || normalized.includes("threat")) {
    score += 25;
  }
  if (normalized.includes("child") || normalized.includes("minor")) {
    score += 20;
  }
  if (normalized.includes("repeat")) {
    score += 10;
  }
  const riskScore = Math.min(100, score);
  const riskLevel = riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low";
  const priority = riskLevel === "critical" ? "critical" : riskLevel === "high" ? "high" : "medium";
  return { riskScore, riskLevel, priority };
};

const buildResponse = (message: string, endSession = false, origin: string | null = null) =>
  new Response(JSON.stringify({ response: message, endSession }), {
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
  });

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

    const body = (await req.json()) as RequestBody;
    if (!body.sessionId || !body.phoneNumber) {
      return new Response(JSON.stringify({ error: "Missing USSD session identifiers" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const input = extractInput(body.text);
    const { data: existing } = await supabase
      .from("ussd_sessions")
      .select("state, payload")
      .eq("session_id", body.sessionId)
      .maybeSingle();

    const state = existing?.state ?? "menu";
    const payload = (existing?.payload as SessionPayload | null) ?? {};

    if (state === "menu") {
      if (!input) {
        await supabase.from("ussd_sessions").upsert({
          session_id: body.sessionId,
          phone_number: body.phoneNumber,
          state: "menu",
          last_input: input,
          payload: {},
          updated_at: new Date().toISOString(),
        });
        return buildResponse("CON AEGIS GBV\n1. Report GBV Incident\n2. Request Help\n3. Check Case Status\n4. Emergency Alert", false, origin);
      }
      if (input === "1") {
        await supabase.from("ussd_sessions").update({
          state: "report_province",
          last_input: input,
          updated_at: new Date().toISOString(),
        }).eq("session_id", body.sessionId);
        return buildResponse("CON Enter Province", false, origin);
      }
      if (input === "2") {
        return buildResponse("END Help request received. A responder will reach out shortly.", true, origin);
      }
      if (input === "3") {
        return buildResponse("END Please contact support to check case status.", true, origin);
      }
      if (input === "4") {
        return buildResponse("END Emergency alert triggered. If in immediate danger, call local emergency services.", true, origin);
      }
      return buildResponse("END Invalid option. Please dial again.", true, origin);
    }

    if (state === "report_province") {
      const nextPayload = { ...payload, province: input };
      await supabase.from("ussd_sessions").update({
        state: "report_area",
        last_input: input,
        payload: nextPayload,
        updated_at: new Date().toISOString(),
      }).eq("session_id", body.sessionId);
      return buildResponse("CON Enter Area", false, origin);
    }

    if (state === "report_area") {
      const nextPayload = { ...payload, area: input };
      await supabase.from("ussd_sessions").update({
        state: "report_description",
        last_input: input,
        payload: nextPayload,
        updated_at: new Date().toISOString(),
      }).eq("session_id", body.sessionId);
      return buildResponse("CON Describe incident", false, origin);
    }

    if (state === "report_description") {
      const nextPayload = { ...payload, description: input };
      await supabase.from("ussd_sessions").update({
        state: "report_confirm",
        last_input: input,
        payload: nextPayload,
        updated_at: new Date().toISOString(),
      }).eq("session_id", body.sessionId);
      return buildResponse("CON Confirm submission\n1. Yes\n2. No", false, origin);
    }

    if (state === "report_confirm") {
      if (input !== "1") {
        await supabase.from("ussd_sessions").delete().eq("session_id", body.sessionId);
        return buildResponse("END Submission cancelled.", true, origin);
      }

      if (!locationKey) {
        return buildResponse("END System error. Please try again later.", true, origin);
      }

      const { riskScore, riskLevel, priority } = computeRiskScore(payload.description ?? "");
      const { encrypted, iv } = await encryptLocation({
        province: payload.province ?? "",
        area: payload.area ?? "",
      });

      const { data: caseReport, error: caseError } = await supabase
        .from("case_reports")
        .insert({
          source: "ussd",
          status: "open",
          risk_level: riskLevel,
          risk_score: riskScore,
          priority,
          description: payload.description ?? null,
          encrypted_location: encrypted,
          location_iv: iv,
        })
        .select("id")
        .single();

      if (caseError || !caseReport) {
        return buildResponse("END Unable to create case. Please try again.", true, origin);
      }

      await supabase.from("risk_assessments").insert({
        case_id: caseReport.id,
        risk_level: riskLevel,
        risk_score: riskScore,
        factors: { source: "ussd" },
      });

      await supabase.from("coordination_events").insert([
        { case_id: caseReport.id, target_role: "police", status: "pending", notified_at: new Date().toISOString() },
        { case_id: caseReport.id, target_role: "ngo", status: "pending", notified_at: new Date().toISOString() },
      ]);

      await supabase.from("audit_logs").insert({
        action: "ussd_case_created",
        module: "ussd",
        description: `Case ${caseReport.id} created via USSD`,
        severity: "info",
      });

      await supabase.from("ussd_sessions").delete().eq("session_id", body.sessionId);
      return buildResponse(`END Case submitted. ID: ${caseReport.id}`, true, origin);
    }

    await supabase.from("ussd_sessions").delete().eq("session_id", body.sessionId);
    return buildResponse("END Session expired. Please dial again.", true, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
}

Deno.serve(handleRequest);
