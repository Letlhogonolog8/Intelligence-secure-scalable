import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  X,
  Mic,
  MicOff,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { enqueueOfflineReport } from "@/hooks/useOfflineSync";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  riskFlag?: boolean;
}

const QUICK_PROMPTS = [
  "I don't know where to start",
  "I need help right now",
  "I'm scared to report",
  "What are my rights?",
  "I need a safe shelter",
];

async function sendToAI(
  messages: Message[],
  userMessage: string,
): Promise<string> {
  const history = messages.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Must target the Express backend via VITE_API_URL: a relative /api path
    // resolves to the Vercel static host in production, which has no API.
    const apiBaseUrl = (
      import.meta.env.VITE_API_URL || "http://localhost:3001/api"
    ).replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/ai/survivor-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The system prompt is fixed server-side (see /api/ai/survivor-chat).
      body: JSON.stringify({
        messages: [...history, { role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) throw new Error("API error");
    const data = (await response.json()) as {
      content?: string;
      error?: string;
    };
    return data.content ?? "I'm here with you. Can you tell me a little more?";
  } catch {
    return getOfflineFallback(userMessage);
  }
}

function getOfflineFallback(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (/danger|help|attack|hurt|kill|die|emergency/i.test(lower)) {
    return "CRISIS ALERT: Please call Police: 10111 or the 24/7 Crisis Line: 0800 428 428 immediately. You can also dial *384*30933# from any phone — no internet needed. You are not alone.";
  }
  if (/shelter|place|stay|home|leave/i.test(lower)) {
    return "Finding a safe place is a brave step. Use AEGIS to connect with nearby shelters, or dial *384*30933# from any phone for immediate referrals.";
  }
  if (/rights|law|report|police/i.test(lower)) {
    return "You have the right to report safely and anonymously. AEGIS can connect you with legal advisors. Would you like to file a report through the platform?";
  }
  return "I hear you, and I'm glad you reached out. You are safe here. Can you share a little more about what's been happening, so I can help guide you?";
}

function isCrisisMessage(content: string): boolean {
  return /CRISIS ALERT:/i.test(content);
}

interface SurvivorAIChatProps {
  onClose?: () => void;
  embedded?: boolean;
}

const SurvivorAIChat: React.FC<SurvivorAIChatProps> = ({
  onClose,
  embedded = false,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello. I'm here to listen and support you — this is a safe, confidential space. Nothing you share here will be used against you. How are you doing right now?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionId = useRef(`chat-${Date.now()}`);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persistMessage = async (
    role: "user" | "assistant",
    content: string,
  ) => {
    try {
      await supabase.from("chat_messages").insert({
        id: `${sessionId.current}-${Date.now()}`,
        session_id: sessionId.current,
        role,
        sender_id: user?.id ?? null,
        sender_role: role === "user" ? "survivor" : "ai",
        message_type: "text",
        content,
        is_encrypted: false,
        language: "en",
        created_at: new Date().toISOString(),
      });
    } catch {
      await enqueueOfflineReport({
        id: `msg-${Date.now()}`,
        type: "case_report",
        payload: {
          session_id: sessionId.current,
          role,
          content,
          created_at: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleSend = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    await persistMessage("user", userText);

    const aiResponse = await sendToAI(messages, userText);
    const aiMsg: Message = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
      riskFlag: isCrisisMessage(aiResponse),
    };

    setMessages((prev) => [...prev, aiMsg]);
    await persistMessage("assistant", aiResponse);
    setIsLoading(false);
  };

  const toggleListening = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = "en-ZA";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const container = embedded
    ? "flex flex-col h-full"
    : "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] flex flex-col rounded-2xl border border-blue-500/20 bg-[#07090f] shadow-2xl shadow-blue-950/40";

  return (
    <div className={container}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-blue-950/40 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Bot className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              AEGIS Support Companion
            </p>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] text-slate-400">
                Confidential · Encrypted · Trauma-informed
              </p>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Privacy notice */}
      <div className="px-4 py-2 bg-emerald-950/30 border-b border-emerald-800/20 flex items-center gap-2 shrink-0">
        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
        <p className="text-[10px] text-emerald-300">
          This conversation is end-to-end protected. POPIA compliant. You can
          delete your history at any time.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : msg.riskFlag
                      ? "bg-rose-950/60 border border-rose-500/40 text-rose-100 rounded-bl-sm"
                      : "bg-slate-800/70 text-slate-100 rounded-bl-sm"
                }`}
              >
                {msg.riskFlag && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wide">
                      Crisis Support
                    </span>
                  </div>
                )}
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-slate-800/70 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-xs text-slate-400">Responding…</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-1.5 flex-wrap shrink-0">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-[11px] text-blue-300 border border-blue-500/25 bg-blue-950/30 hover:bg-blue-900/40 rounded-full px-3 py-1 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/8 flex gap-2 items-end shrink-0">
        <div className="relative flex-1">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type or speak your message…"
            className="resize-none bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500 text-sm rounded-xl pr-10 min-h-[44px] max-h-[120px]"
            rows={1}
          />
        </div>
        <button
          onClick={toggleListening}
          className={`h-11 w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
            isListening
              ? "bg-rose-600 border-rose-500 text-white animate-pulse"
              : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
          }`}
          title={isListening ? "Stop recording" : "Voice input"}
        >
          {isListening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="h-11 w-11 p-0 rounded-xl bg-blue-600 hover:bg-blue-500 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SurvivorAIChat;
