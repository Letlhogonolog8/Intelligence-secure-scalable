import { env, hasApi } from "@/lib/env";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const QUICK_PROMPTS = [
  "I don't know where to start",
  "I need help right now",
  "I'm scared to report",
  "What are my rights?",
  "I need a safe shelter",
];

function getOfflineFallback(message: string): string {
  const lower = message.toLowerCase();
  if (/danger|hurt|hit|kill|weapon|now|help me/.test(lower)) {
    return "CRISIS ALERT: If you are in immediate danger, please call the Police on 10111 or use the SOS tab now. You are not alone, and reaching out took courage.";
  }
  if (/report|police|case|charge/.test(lower)) {
    return "You have the right to report at any police station, with a support person present. When you're ready, the Report tab can help. What feels like the next safe step for you?";
  }
  if (/shelter|safe place|stay|home/.test(lower)) {
    return "Safe shelters offer confidential accommodation. You can call the GBV Command Centre on 0800 428 428 anytime. Would it help to look at the Resources tab together?";
  }
  return "I'm here with you, and what you're feeling is valid. You don't have to face this alone. Can you tell me a little more about what's on your mind right now?";
}

/**
 * Send a message to the AEGIS support AI via the backend
 * (POST {API}/api/ai/survivor-chat). Falls back to a safe, supportive
 * offline reply if the network is unavailable — chat must never hard-fail.
 */
export async function sendToAI(
  history: ChatMessage[],
  userMessage: string,
): Promise<{ content: string; offline: boolean }> {
  if (!hasApi) return { content: getOfflineFallback(userMessage), offline: true };

  const recent = history.slice(-8);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${env.apiUrl}/api/ai/survivor-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The system prompt is fixed server-side (see /api/ai/survivor-chat).
      body: JSON.stringify({
        messages: [...recent, { role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("api_error");
    const data = (await res.json()) as { content?: string };
    return {
      content: data.content ?? "I'm here with you. Can you tell me a little more?",
      offline: false,
    };
  } catch {
    return { content: getOfflineFallback(userMessage), offline: true };
  } finally {
    clearTimeout(timer);
  }
}
