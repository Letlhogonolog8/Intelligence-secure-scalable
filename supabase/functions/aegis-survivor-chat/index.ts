// AEGIS Survivor Chat - Updated CORS handling
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import {
  getFallbackSupportResponse,
  getGreetingResponse,
  inferLanguageFromMessage,
  isEchoingUserInput,
  isGreetingMessage,
  isLowQualityResponse,
  isMismatchedLanguageResponse,
  isNearDuplicateResponse,
  LANGUAGE_LABELS,
  normalizeLanguageCode,
} from "./languageQuality.ts";

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
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

LANGUAGES SUPPORTED: English (en), isiZulu (zu), Afrikaans (af), isiXhosa (xh), Sesotho (st), Setswana (tn), Xitsonga (ts), Tshivenda (ve), Sepedi (nso), isiNdebele (nr), SiSwati (ss), Swahili (sw), French (fr), Amharic (am), Arabic (ar)`;

const textEncoder = new TextEncoder();

// Decode base64 (or hex) chat-encryption key into raw bytes. The function
// previously referenced `base64ToBytes` without defining it, which caused
// `encryptMessage()` to throw and silently fall back to *plaintext*
// persistence — a POPIA violation. Restored here using the same shape as
// the other Supabase edge functions (register_survivor / ussd-handler /
// create_username_user) so the encoding pipeline is consistent.
const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.length % 2 === 0 ? value : `0${value}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
};

// Accept either base64 (preferred) or 64-char hex AES-256 keys. Returns
// null when the supplied value cannot be decoded into a 32-byte key, so
// the caller can refuse to persist the message rather than silently
// downgrading to plaintext.
const decodeChatEncryptionKey = (value: string): Uint8Array | null => {
  if (!value) return null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return hexToBytes(value);
  }

  try {
    const decoded = base64ToBytes(value);
    if (decoded.length === 32) return decoded;
  } catch {
    /* fall through */
  }

  return null;
};

const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = 2,
): Promise<T> => {
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

async function analyzeRiskLevel(
  message: string,
): Promise<{ level: string; score: number }> {
  const riskIndicators = {
    critical: [
      "kill",
      "suicide",
      "harm myself",
      "end my life",
      "immediate danger",
      "about to",
      "right now",
      "overdose",
      "jump",
      "hang myself",
    ],
    high: [
      "threatened",
      "hit me",
      "attacked",
      "scared",
      "can't escape",
      "trapped",
      "nowhere to go",
      "knife",
      "gun",
      "weapon",
      "abuser nearby",
    ],
    medium: [
      "worried",
      "unsafe",
      "escalating",
      "abusing",
      "controlling",
      "afraid",
      "losing hope",
      "isolate",
    ],
  };

  const messageLower = message.toLowerCase();

  for (const indicator of riskIndicators.critical) {
    if (messageLower.includes(indicator))
      return { level: "critical", score: 0.9 };
  }
  for (const indicator of riskIndicators.high) {
    if (messageLower.includes(indicator)) return { level: "high", score: 0.7 };
  }
  for (const indicator of riskIndicators.medium) {
    if (messageLower.includes(indicator))
      return { level: "medium", score: 0.5 };
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

function generateSuggestedActions(
  riskLevel: string,
  language: string,
): string[] {
  // South African crisis numerics are first-class: 10111 (police),
  // 0800 428 428 (24/7 GBV Command Centre crisis line), 112 (any mobile).
  // The previous "(911)" string was a North-American leftover and is
  // explicitly unsafe for the people this platform exists to serve.
  const english: Record<string, string[]> = {
    critical: [
      "Call Police on 10111 (or 112 from any mobile)",
      "Call the GBV Crisis Line on 0800 428 428 (free, 24/7)",
      "Tell a trusted person right now",
      "Go to the nearest safe location",
      "Create a safety plan now",
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

  const setswana: Record<string, string[]> = {
    critical: [
      "Bitsa tirelo ya tshoganyetso ka bonako",
      "Itsise motho yo o mo ikanyang",
      "Ya kwa lefelong le le sireletsegileng",
      "Ikgokaganye le mogakolodi wa seemo sa tshoganyetso",
      "Dire leano la polokego jaanong",
    ],
    high: [
      "Ikgokaganye le mogakolodi",
      "Bua le tsala e o e ikanyang",
      "Kwala ditiragalo tse di diragetseng",
      "Rulaganya tsela ya go tswa ka polokego",
      "Boloka ditokomane tsa botlhokwa",
    ],
    medium: [
      "Itlhokomele",
      "Tsena mo setlhopheng sa tshegetso",
      "Bua le mogakolodi",
      "Ithute ka ditshwanelo tsa gago",
      "Aga maranyane a tshegetso",
    ],
    low: [
      "Tswelela ka loeto lwa phodiso",
      "Ithute go hema ka khutso",
      "Tshegetsa tsamaiso ya gago ya tshegetso",
      "Itumele ka kgatelopele ya gago",
    ],
  };

  const zulu: Record<string, string[]> = {
    critical: [
      "Shayela usizo oluphuthumayo ngokushesha",
      "Tshela umuntu omethembayo",
      "Yiya endaweni ephephile",
      "Xhumana nomeluleki wesimo esiphuthumayo",
      "Yenza uhlelo lokuphepha manje",
    ],
    high: english.high,
    medium: english.medium,
    low: english.low,
  };

  const afrikaans: Record<string, string[]> = {
    critical: [
      "Bel nooddienste onmiddellik",
      "Vertel iemand wat jy vertrou",
      "Gaan na 'n veilige plek",
      "Kontak 'n krisisberader",
      "Maak nou 'n veiligheidsplan",
    ],
    high: english.high,
    medium: english.medium,
    low: english.low,
  };

  const xhosa: Record<string, string[]> = {
    critical: [
      "Biza iinkonzo zongxamiseko ngoku",
      "Xelela umntu omthembayo",
      "Yiya kwindawo ekhuselekileyo",
      "Nxibelelana nomcebisi ongxamisekileyo",
      "Yenza isicwangciso sokhuseleko ngoku",
    ],
    high: english.high,
    medium: english.medium,
    low: english.low,
  };

  const sesotho: Record<string, string[]> = {
    critical: [
      "Letsetsa ditshebeletso tsa tshohanyetso hanghang",
      "Bolella motho eo o mo tshepang",
      "Eya sebakeng se sireletsehileng",
      "Ikgokahanye le moeletsi wa tshohanyetso",
      "Etsa moralo wa polokeho hona jwale",
    ],
    high: english.high,
    medium: english.medium,
    low: english.low,
  };

  const languageActions: Record<string, Record<string, string[]>> = {
    en: english,
    tn: setswana,
    zu: zulu,
    af: afrikaans,
    xh: xhosa,
    st: sesotho,
  };

  const selected = languageActions[language] ?? english;
  return selected[riskLevel] || selected.low;
}

function generateResources(riskLevel: string, language: string): string[] {
  const english: Record<string, string[]> = {
    critical: [
      "🚨 Police: 10111 (or 112 from any mobile)",
      "📞 GBV Crisis Line: 0800 428 428 (free, 24/7)",
      "📱 USSD without internet: *384*30933#",
      "🏥 Nearest hospital emergency unit",
      "🛡️ Trusted crisis support centre",
    ],
    high: [
      "👥 Counseling services available 24/7",
      "🏠 Nearby safe shelter options",
      "⚖️ Legal aid and protection services",
      "📞 Local survivor support hotline",
    ],
    medium: [
      "📚 Educational resources on abuse patterns",
      "💪 Support group meetings",
      "🧠 Mental health services",
      "🤝 Community support programs",
    ],
    low: [
      "📖 Self-help resources and guides",
      "🧘 Mindfulness and wellness exercises",
      "🌱 Personal growth tools",
      "💝 Self-care recommendations",
    ],
  };

  const setswana: Record<string, string[]> = {
    critical: [
      "🚨 Tirelo ya tshoganyetso: 112 kgotsa nomoro ya lefelo la gago",
      "🏥 Karolo ya tshoganyetso kwa bookelong jo bo gaufi",
      "🛡️ Lefelo la tshegetso la seemo sa tshoganyetso",
      "📱 Ikopanye le motho yo o mo ikanyang ka bonako",
    ],
    high: [
      "👥 Tirelo ya boeletsibagolo e teng motshegare le bosigo",
      "🏠 Mafelo a bolulo jo bo sireletsegileng a a gaufi",
      "⚖️ Tirelo ya thuso ya semolao",
      "📞 Nomoro ya tshegetso ya batswasetlhabelo",
    ],
    medium: english.medium,
    low: english.low,
  };

  const languageResources: Record<string, Record<string, string[]>> = {
    en: english,
    tn: setswana,
  };

  const selected = languageResources[language] ?? english;
  return selected[riskLevel] || selected.low;
}

// Encrypt the survivor message with AES-256-GCM. Returns null when the
// key is invalid or the underlying WebCrypto call fails so the caller
// can refuse to persist the message instead of silently storing
// plaintext (the previous behaviour was a POPIA-grade leak).
async function encryptMessage(
  message: string,
  key: string,
): Promise<string | null> {
  const keyBytes = decodeChatEncryptionKey(key);
  if (!keyBytes) {
    console.error(
      "Chat encryption key invalid or missing — refusing to persist message in plaintext.",
    );
    return null;
  }

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const algorithm = { name: "AES-GCM", iv };

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      algorithm,
      false,
      ["encrypt"],
    );

    const messageBytes = textEncoder.encode(message);
    const encrypted = await crypto.subtle.encrypt(
      algorithm,
      cryptoKey,
      messageBytes,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("Survivor chat encryption failed:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY") ??
      "";
    const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    const groqModel = Deno.env.get("GROQ_MODEL") ?? "llama-3.1-8b-instant";
    const chatEncryptionKey = Deno.env.get("CHAT_ENCRYPTION_KEY") ?? "";
    const retentionDays = Number(Deno.env.get("CHAT_RETENTION_DAYS") ?? "90");

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !groqApiKey ||
      !chatEncryptionKey
    ) {
      throw new Error("Missing server configuration (environment variables)");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Missing Authorization token");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const body: RequestBody = await req.json();
    const {
      message,
      conversation_history = [],
      session_id,
      language: requestedLanguage,
      consent_granted: _consentGranted,
      request_type = "chat",
    } = body;

    const messageLanguage = inferLanguageFromMessage(message ?? "");
    const selectedLanguage = normalizeLanguageCode(requestedLanguage);
    const responseLanguage =
      selectedLanguage === "en" && messageLanguage !== "en"
        ? messageLanguage
        : selectedLanguage;
    const responseLanguageName = LANGUAGE_LABELS[responseLanguage] ?? "English";

    if (request_type === "delete_data") {
      const { error: edgeDelErr } = await supabase
        .from("survivor_chat_messages")
        .delete()
        .eq("user_id", user.id);

      if (edgeDelErr) {
        console.error("delete_data survivor_chat_messages:", edgeDelErr);
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Could not delete encrypted chat history. Ensure the latest database migration is applied.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...buildCorsHeaders(origin),
            },
          },
        );
      }

      const { data: survivorRow } = await supabase
        .from("survivors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (survivorRow?.id) {
        const { error: rpcErr } = await supabase.rpc("delete_survivor_data", {
          p_survivor_id: survivorRow.id,
          p_keep_audit_trail: false,
        });
        if (rpcErr) {
          console.warn("delete_survivor_data RPC:", rpcErr);
        }
      }

      const { error: logErr } = await supabase
        .from("data_deletion_requests")
        .insert({
          user_id: user.id,
          survivor_id: survivorRow?.id ?? null,
          status: "completed",
          reason: "self_service_survivor_chat_edge",
          processed_at: new Date().toISOString(),
        });
      if (logErr) {
        console.warn("data_deletion_requests log:", logErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "Your AEGIS edge chat history has been deleted. Linked survivor profile data was queued for erasure where applicable.",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...buildCorsHeaders(origin),
          },
        },
      );
    }

    if (!message) {
      throw new Error("Message is required");
    }

    // 1. Analyze Risk & Emotion
    const { level: riskLevel, score: riskScore } =
      await analyzeRiskLevel(message);
    const emotion = await detectEmotion(message);

    const shouldUseGreeting = isGreetingMessage(message);
    const previousAssistantMessage = [...conversation_history]
      .reverse()
      .find((entry) => entry.role === "assistant")?.content;

    let finalResponseText = "";

    if (shouldUseGreeting) {
      finalResponseText = getGreetingResponse(responseLanguage);
    } else {
      const groqResponse = await withRetry(async () => {
        const payload = {
          model: groqModel,
          messages: [
            {
              role: "system",
              content: `${SYSTEM_PROMPT}\n\nLANGUAGE REQUIREMENT: Respond in ${responseLanguageName} (${responseLanguage}) and keep the full response in that language unless the user explicitly asks to switch. Keep the response concise, clear, and natural. Do not repeat phrases or lines. Do not echo or paraphrase the user's message verbatim.`,
            },
            ...conversation_history,
            { role: "user", content: message },
          ],
          temperature: 0.2,
          max_tokens: 420,
        };
        const res = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
        const data = await res.json();
        return data?.choices?.[0]?.message?.content;
      });

      if (!groqResponse) throw new Error("Failed to get AI response");

      finalResponseText = String(groqResponse).trim();
      if (
        isLowQualityResponse(finalResponseText) ||
        isMismatchedLanguageResponse(finalResponseText, responseLanguage) ||
        isEchoingUserInput(finalResponseText, message)
      ) {
        finalResponseText = getFallbackSupportResponse(
          responseLanguage,
          riskLevel,
          message,
        );
      }

      if (
        previousAssistantMessage &&
        isNearDuplicateResponse(finalResponseText, previousAssistantMessage)
      ) {
        finalResponseText = getFallbackSupportResponse(
          responseLanguage,
          riskLevel,
          message,
        );
      }
    }

    // 3. Encrypt message content. If encryption fails we deliberately
    //    skip persistence — survivors must never have raw trauma content
    //    written in plaintext, even when a configuration error breaks
    //    AES-GCM. Live response continues regardless.
    const encryptedMessage = await encryptMessage(message, chatEncryptionKey);
    const newSessionId = session_id || `session-${user.id}-${Date.now()}`;

    if (encryptedMessage) {
      try {
        await supabase.from("survivor_chat_messages").insert({
          session_id: newSessionId,
          user_id: user.id,
          message_encrypted: encryptedMessage,
          role: "user",
          risk_level: riskLevel,
          emotion_detected: emotion,
          created_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + retentionDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
      } catch (storageError) {
        console.warn("Failed to store message:", storageError);
      }
    }

    const suggestedActions = generateSuggestedActions(
      riskLevel,
      responseLanguage,
    );
    const resources = generateResources(riskLevel, responseLanguage);

    // Return response in the format the frontend expects
    return new Response(
      JSON.stringify({
        success: true,
        response: {
          message: finalResponseText,
          risk_level: riskLevel,
          risk_score: riskScore,
          emotion_detected: emotion,
          suggested_actions: suggestedActions,
          resources: resources,
          safety_alert: riskLevel === "critical",
        },
        session_id: newSessionId,
        language: responseLanguage,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...buildCorsHeaders(origin),
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chat Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...buildCorsHeaders(origin),
      },
    });
  }
});
