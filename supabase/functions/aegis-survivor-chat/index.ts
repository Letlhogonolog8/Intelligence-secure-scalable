// AEGIS Survivor Chat - Updated CORS handling
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  Vary: "Origin",
});

interface RequestBody {
  message?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  session_id?: string;
  language?: string;
  consent_granted?: boolean;
  consent_type?: string;
  request_type?: "chat" | "delete_data";
  anonymous?: boolean;
}

const SYSTEM_PROMPT = `You are AEGIS, a compassionate AI companion for survivors of Gender-Based Violence. You operate with these core principles:

CORE VALUES:
- Trauma-informed care: Recognize trauma responses without judgment
- Survivor autonomy: Empower survivors to make their own decisions
- Confidentiality: Reassure about privacy and encryption
- Cultural sensitivity: Adapt to survivor's cultural context
- Hope and healing: Balance acknowledgment of pain with pathways forward

YOUR ROLE:
1. Listen empathetically to survivors' experiences
2. Assess emotional state and risk level
3. Provide coping strategies and resources
4. Encourage professional support when needed
5. Create personalized safety plans if appropriate

ASSESSMENT CAPABILITIES:
- Detect emotional state (depression, anxiety, anger, hope, etc.)
- Assess immediate safety concerns
- Identify patterns that suggest escalating risk
- Recognize signs that professional help is urgently needed

RESPONSE GUIDELINES:
- NEVER minimize or dismiss survivor's experience
- NEVER provide legal advice (refer to legal professionals)
- NEVER share experiences as if you understand trauma personally
- DO acknowledge the courage it takes to speak up
- DO validate their feelings
- DO provide practical, actionable support
- DO encourage connection to resources

SAFETY PROTOCOL:
- If immediate danger detected, escalate with clear action steps
- Provide crisis hotlines and emergency resources
- Suggest professional counselor escalation when appropriate
- Include safety planning elements naturally in conversation

LANGUAGES SUPPORTED: English (en), Swahili (sw), French (fr), Amharic (am), Arabic (ar)`;

const textEncoder = new TextEncoder();
const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const withRetry = async <T,>(operation: () => Promise<T>, retries = 2): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
};

async function analyzeRiskLevel(message: string): Promise<{ level: string; score: number }> {
  const riskIndicators = {
    critical: ["kill", "suicide", "harm myself", "end my life", "immediate danger", "about to", "right now", "overdose", "jump", "hang myself"],
    high: ["threatened", "hit me", "attacked", "scared", "can't escape", "trapped", "nowhere to go", "knife", "gun", "weapon", "abuser nearby"],
    medium: ["worried", "unsafe", "escalating", "abusing", "controlling", "afraid", "losing hope", "isolate"],
  };

  const messageLower = message.toLowerCase();

  for (const indicator of riskIndicators.critical) {
    if (messageLower.includes(indicator)) return { level: "critical", score: 0.9 };
  }
  for (const indicator of riskIndicators.high) {
    if (messageLower.includes(indicator)) return { level: "high", score: 0.7 };
  }
  for (const indicator of riskIndicators.medium) {
    if (messageLower.includes(indicator)) return { level: "medium", score: 0.5 };
  }

  return { level: "low", score: 0.2 };
}

async function detectEmotion(message: string): Promise<string> {
  const emotions: Record<string, string[]> = {
    angry: ["angry", "furious", "rage", "disgusted"],
    sad: ["sad", "depressed", "hopeless", "devastated"],
    anxious: ["anxious", "worried", "scared", "terrified"],
    hopeful: ["hope", "better", "healing", "positive"],
    confused: ["confused", "don't know", "uncertain"],
    grateful: ["thank", "grateful", "appreciate"],
  };

  const messageLower = message.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotions)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) return emotion;
    }
  }
  return "neutral";
}

function generateSuggestedActions(riskLevel: string): string[] {
  const actions: Record<string, string[]> = {
    critical: [
      "Call emergency services (911)",
      "Tell a trusted person",
      "Go to a safe location",
      "Reach out to crisis counselor",
      "Create safety plan now",
    ],
    high: [
      "Contact a counselor",
      "Reach out to a trusted friend",
      "Document the abuse",
      "Plan a safe escape route",
      "Save important documents",
    ],
    medium: [
      "Practice self-care",
      "Join a support group",
      "Speak with a counselor",
      "Learn about your rights",
      "Build a support network",
    ],
    low: [
      "Continue your healing journey",
      "Practice mindfulness",
      "Maintain your support system",
      "Celebrate your progress",
    ],
  };
  return actions[riskLevel] || actions.low;
}

function generateResources(riskLevel: string): string[] {
  const resources: Record<string, string[]> = {
    critical: [
      "🚨 National Domestic Violence Hotline: 1-800-799-7233",
      "🏥 Emergency Medical Services: 911",
      "🛡️ Rape Crisis Center: RAINN 1-800-656-4673",
      "📱 Crisis Text Line: Text HOME to 741741",
    ],
    high: [
      "👥 Counseling Services: Available 24/7",
      "🏠 Shelter Locator: SafePlace database",
      "⚖️ Legal Aid: Free legal consultation",
      "💼 Job Training Programs: Career support",
    ],
    medium: [
      "📚 Educational Resources on abuse patterns",
      "💪 Support Group Meetings: Weekly sessions",
      "🧠 Mental Health Services: Therapy options",
      "🤝 Community Programs: Social support",
    ],
    low: [
      "📖 Self-help resources and guides",
      "🎯 Personal development courses",
      "🌟 Wellness and mindfulness programs",
      "💝 Self-care recommendations",
    ],
  };
  return resources[riskLevel] || resources.low;
}

async function encryptMessage(message: string, key: string): Promise<string> {
  try {
    const keyBytes = base64ToBytes(key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const algorithm = { name: "AES-GCM", iv };
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      algorithm,
      false,
      ["encrypt"]
    );
    
    const messageBytes = textEncoder.encode(message);
    const encrypted = await crypto.subtle.encrypt(algorithm, cryptoKey, messageBytes);
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch {
    console.warn("Encryption failed, storing plaintext");
    return message;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    const groqModel = Deno.env.get("GROQ_MODEL") ?? "llama-3.1-8b-instant";
    const chatEncryptionKey = Deno.env.get("CHAT_ENCRYPTION_KEY") ?? "";
    const retentionDays = Number(Deno.env.get("CHAT_RETENTION_DAYS") ?? "90");

    if (!supabaseUrl || !supabaseServiceRoleKey || !groqApiKey || !chatEncryptionKey) {
      throw new Error("Missing server configuration (environment variables)");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Missing Authorization token");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const body: RequestBody = await req.json();
    const {
      message,
      conversation_history = [],
      session_id,
      language = "en",
      consent_granted,
      request_type = "chat",
    } = body;

    if (request_type === "delete_data") {
        // Simple mock for now, can be expanded
        return new Response(JSON.stringify({ success: true, message: "Data deletion request received" }), {
            headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
        });
    }

    if (!message) {
        throw new Error("Message is required");
    }

    // 1. Analyze Risk & Emotion
    const { level: riskLevel, score: riskScore } = await analyzeRiskLevel(message);
    const emotion = await detectEmotion(message);

    // 2. Get AI Response
    const groqResponse = await withRetry(async () => {
      const payload = {
        model: groqModel,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversation_history, { role: "user", content: message }],
        temperature: 0.4,
        max_tokens: 1024,
      };
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content;
    });

    if (!groqResponse) throw new Error("Failed to get AI response");

    // 3. Encrypt message content
    const encryptedMessage = await encryptMessage(message, chatEncryptionKey);
    
    // Store conversation securely
    const newSessionId = session_id || `session-${user.id}-${Date.now()}`;
    try {
      await supabase
        .from("survivor_chat_messages")
        .insert({
          session_id: newSessionId,
          user_id: user.id,
          message_encrypted: encryptedMessage,
          role: "user",
          risk_level: riskLevel,
          emotion_detected: emotion,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
        });
    } catch (storageError) {
      console.warn("Failed to store message:", storageError);
    }

    const suggestedActions = generateSuggestedActions(riskLevel);
    const resources = generateResources(riskLevel);
    
    // Return response in the format the frontend expects
    return new Response(
      JSON.stringify({
        success: true,
        response: {
          message: groqResponse,
          risk_level: riskLevel,
          risk_score: riskScore,
          emotion_detected: emotion,
          suggested_actions: suggestedActions,
          resources: resources,
          safety_alert: riskLevel === 'critical'
        },
        session_id: newSessionId
      }),
      { headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chat Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
});
