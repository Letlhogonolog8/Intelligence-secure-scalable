import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * USSD Gateway Edge Function
 * Handles incoming USSD requests from SMS providers and manages sessions
 * 
 * Request format (standard USSD):
 * {
 *   "sessionId": "string",
 *   "phoneNumber": "string",
 *   "text": "user input",
 *   "serviceCode": "AEGIS code"
 * }
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const USSD_SECRET = Deno.env.get("USSD_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface USSDRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
  serviceCode: string;
}

interface USSDSession {
  id: string;
  current_menu: string;
  user_data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface USSDResponse {
  status: "ok" | "error";
  message: string;
  sessionActive?: boolean;
}

async function handleUSSDRequest(req: USSDRequest): Promise<USSDResponse> {
  try {
    const { sessionId, phoneNumber, text } = req;

    // Validate phone number
    if (!phoneNumber || phoneNumber.length < 10) {
      return {
        status: "error",
        message: "Invalid phone number",
      };
    }

    // Get or create session
    let session = await getOrCreateSession(phoneNumber);

    // Process user input
    const userInput = text?.trim() || "";

    // Handle session expiry
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      session = await createNewSession(phoneNumber);
    }

    // Process input and get response
    const menuResponse = await processMenuInput(session, userInput);

    // Log message
    await logUSSDMessage(session.session_id, "inbound", userInput, session.current_menu);
    await logUSSDMessage(session.session_id, "outbound", menuResponse, session.current_menu);

    // Check if session should continue
    const sessionActive = session.is_active && expiresAt > new Date();

    return {
      status: "ok",
      message: menuResponse,
      sessionActive,
    };
  } catch (error) {
    console.error("USSD Error:", error);
    return {
      status: "error",
      message: "Service unavailable. Please try again later.",
    };
  }
}

async function getOrCreateSession(phoneNumber: string) {
  try {
    // Try to get existing active session
    const { data: existingSession, error: fetchError } = await supabase
      .from("ussd_sessions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingSession) {
      const expiresAt = new Date(existingSession.expires_at);
      if (expiresAt > new Date()) {
        return existingSession;
      }
    }

    // Create new session
    return await createNewSession(phoneNumber);
  } catch (error) {
    console.error("Session fetch error:", error);
    return await createNewSession(phoneNumber);
  }
}

async function createNewSession(phoneNumber: string) {
  const sessionId = `USSD_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5-minute session timeout

  const { data, error } = await supabase
    .from("ussd_sessions")
    .insert({
      phone_number: phoneNumber,
      session_id: sessionId,
      current_menu: "main",
      metadata: {},
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function processMenuInput(session: USSDSession, userInput: string): Promise<string> {
  const currentMenu = session.current_menu;
  const choice = userInput.trim().toUpperCase();

  // Handle exit
  if (choice === "STOP" || choice === "0") {
    await endSession(session.id);
    return "Thank you for using AEGIS. Session ended.";
  }

  // Menu definitions
  const menus: Record<string, Record<string, { next?: string; action?: string; label: string }>> = {
    main: {
      "1": { next: "support", label: "Get Support" },
      "2": { next: "reporting", label: "Report Incident" },
      "3": { next: "resources", label: "Find Resources" },
      "4": { next: "auth", label: "Login" },
    },
    support: {
      "1": { action: "submit", label: "Crisis Support" },
      "2": { action: "submit", label: "Schedule Counseling" },
      "3": { action: "submit", label: "Safety Planning" },
      "4": { action: "submit", label: "Legal Info" },
      "0": { next: "main", label: "Back" },
    },
    reporting: {
      "1": { action: "submit", label: "Anonymous Report" },
      "2": { action: "submit", label: "Report with Info" },
      "3": { action: "submit", label: "Case Status" },
      "0": { next: "main", label: "Back" },
    },
    resources: {
      "1": { action: "submit", label: "Emergency Shelters" },
      "2": { action: "submit", label: "Health Services" },
      "3": { action: "submit", label: "Legal Services" },
      "4": { action: "submit", label: "Counseling" },
      "0": { next: "main", label: "Back" },
    },
    auth: {
      "1": { action: "submit", label: "Survivor Login" },
      "2": { action: "submit", label: "Counselor Login" },
      "3": { action: "submit", label: "Reset Password" },
      "0": { next: "main", label: "Back" },
    },
  };

  const menuDef = menus[currentMenu];
  const selectedChoice = menuDef[choice];

  if (!selectedChoice) {
    return getMenuResponse(currentMenu);
  }

  if (selectedChoice.next) {
    // Navigate to next menu
    await updateSessionMenu(session.id, selectedChoice.next);
    return getMenuResponse(selectedChoice.next);
  } else if (selectedChoice.action === "submit") {
    // Store submission for processing
    await logUSSDSubmission(session.session_id, currentMenu, choice, userInput);
    return `${selectedChoice.label} received. We will contact you shortly.\nReply STOP to exit.`;
  }

  return getMenuResponse(currentMenu);
}

function getMenuResponse(menu: string): string {
  const menuTexts: Record<string, string> = {
    main: "AEGIS Support System\n1. Get Support\n2. Report Incident\n3. Find Resources\n4. Login\n0. Exit",
    support: "Support Services\n1. Crisis Support\n2. Schedule Counseling\n3. Safety Planning\n4. Legal Info\n0. Back",
    reporting: "Report Incident\n1. Anonymous\n2. With Contact Info\n3. Check Status\n0. Back",
    resources: "Find Services\n1. Shelters\n2. Health\n3. Legal\n4. Counseling\n0. Back",
    auth: "AEGIS Login\n1. Survivor\n2. Counselor\n3. Reset Password\n0. Back",
  };

  return menuTexts[menu] || menuTexts.main;
}

async function updateSessionMenu(sessionId: string, newMenu: string) {
  await supabase
    .from("ussd_sessions")
    .update({ current_menu: newMenu })
    .eq("id", sessionId);
}

async function endSession(sessionId: string) {
  await supabase
    .from("ussd_sessions")
    .update({ is_active: false })
    .eq("id", sessionId);
}

async function logUSSDMessage(
  sessionId: string,
  direction: string,
  content: string,
  menuLevel: string
) {
  await supabase.from("ussd_messages").insert({
    session_id: sessionId,
    direction,
    content,
    menu_level: menuLevel,
    timestamp: new Date().toISOString(),
    status: "delivered",
  });
}

async function logUSSDSubmission(
  sessionId: string,
  menuLevel: string,
  menuCode: string,
  userInput: string
) {
  await supabase.from("ussd_submissions").insert({
    session_id: sessionId,
    menu_level: menuLevel,
    menu_code: menuCode,
    user_input: userInput,
    timestamp: new Date().toISOString(),
    status: "pending",
  });
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // Webhook signature verification
  const signature = req.headers.get("X-USSD-Signature");
  if (signature !== USSD_SECRET) {
    return new Response(
      JSON.stringify({ status: "error", message: "Invalid signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json() as USSDRequest;
    const response = await handleUSSDRequest(body);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Request processing error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Service error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
