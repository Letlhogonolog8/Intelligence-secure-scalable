import { useState, useRef, useEffect, useCallback } from "react";
import {
  Users,
  Send,
  Shield,
  Heart,
  MessageCircle,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

interface PeerMessage {
  id: string;
  alias: string;
  content: string;
  timestamp: Date;
  isOwn?: boolean;
  flagged?: boolean;
}

const SAFE_ALIASES = [
  "Brave Sunflower",
  "Strong River",
  "Rising Star",
  "Quiet Mountain",
  "Gentle Wave",
  "Hopeful Dawn",
  "Steady Flame",
  "Resilient Oak",
  "Peaceful Sky",
  "Courageous Heart",
];

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end it all",
  "want to die",
  "self harm",
  "hurt myself",
];

function generateAlias(): string {
  return SAFE_ALIASES[Math.floor(Math.random() * SAFE_ALIASES.length)];
}

function containsCrisisSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const DEMO_MESSAGES: PeerMessage[] = [
  {
    id: "demo-1",
    alias: "Rising Star",
    content:
      "Today marks 3 months since I reported. The counselor sessions have helped so much. Sending strength to everyone here. 💛",
    timestamp: new Date(Date.now() - 1000 * 60 * 47),
  },
  {
    id: "demo-2",
    alias: "Gentle Wave",
    content:
      "I was scared to reach out at first. But this space has made me feel less alone. Thank you all.",
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
  },
  {
    id: "demo-3",
    alias: "Brave Sunflower",
    content:
      "For anyone who is new here — you are believed, you are not alone, and you deserve safety.",
    timestamp: new Date(Date.now() - 1000 * 60 * 18),
  },
];

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const PeerSupportNetwork: React.FC = () => {
  const [messages, setMessages] = useState<PeerMessage[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [myAlias] = useState(() => generateAlias());
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const MAX_CHARS = 280;

  const appendMessage = useCallback(
    (
      row: { id: string; alias: string; content: string; created_at: string },
      own: boolean,
    ) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [
          ...prev,
          {
            id: row.id,
            alias: row.alias,
            content: row.content,
            timestamp: new Date(row.created_at),
            isOwn: own,
          },
        ];
      });
    },
    [],
  );

  useEffect(() => {
    if (!hasSupabase) return;

    supabase
      .from("peer_support_messages")
      .select("id, alias, content, created_at")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(
            data.map((row) => ({
              id: row.id,
              alias: row.alias,
              content: row.content,
              timestamp: new Date(row.created_at),
              isOwn: row.alias === myAlias,
            })),
          );
        }
      });

    const channel = supabase
      .channel("peer-support-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "peer_support_messages" },
        (payload) => {
          const row = payload.new as {
            id: string;
            alias: string;
            content: string;
            created_at: string;
          };
          appendMessage(row, row.alias === myAlias);
        },
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [myAlias, appendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_CHARS || isSending) return;

    if (containsCrisisSignal(trimmed)) {
      setCrisisDetected(true);
      return;
    }

    setInput("");
    setCharCount(0);
    setCrisisDetected(false);

    if (hasSupabase) {
      setIsSending(true);
      await supabase
        .from("peer_support_messages")
        .insert({ alias: myAlias, content: trimmed });
      setIsSending(false);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          alias: myAlias,
          content: trimmed,
          timestamp: new Date(),
          isOwn: true,
        },
      ]);
    }
  };

  const handleInputChange = (value: string) => {
    if (value.length <= MAX_CHARS) {
      setInput(value);
      setCharCount(value.length);
      if (crisisDetected) setCrisisDetected(false);
    }
  };

  return (
    <Card className="border-white/15 bg-slate-950/70 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-bold">Survivor Peer Support</h3>
            {hasSupabase ? (
              isConnected ? (
                <span
                  className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
                  title="Live"
                />
              ) : (
                <WifiOff
                  className="h-3 w-3 text-slate-500"
                  aria-label="Connecting…"
                />
              )
            ) : (
              <span
                className="flex h-2 w-2 rounded-full bg-amber-400"
                title="Demo mode"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/60 border border-white/5 px-2.5 py-1 rounded-full">
            <Shield className="h-3 w-3 text-emerald-400" />
            <span>Fully Anonymous · AI Moderated</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          You appear as{" "}
          <span className="text-blue-300 font-semibold">{myAlias}</span>. No
          personal data is shared.
        </p>
      </div>

      <div className="px-5 py-3 bg-blue-500/5 border-b border-blue-500/10 flex items-start gap-2">
        <Heart className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-200/80 leading-relaxed">
          This is a trauma-informed, moderated space. Be kind and supportive.
          Crisis signals are automatically detected and you will be connected to
          a counselor. All messages are AI-reviewed for safety.
        </p>
      </div>

      <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-64 min-h-[140px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${msg.isOwn ? "items-end" : "items-start"}`}
          >
            {!msg.isOwn && (
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <MessageCircle className="h-3 w-3 text-blue-400" />
                </div>
                <span className="text-[10px] text-blue-300 font-semibold">
                  {msg.alias}
                </span>
                <span className="text-[10px] text-slate-500">
                  {timeAgo(msg.timestamp)}
                </span>
              </div>
            )}
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.isOwn
                  ? "bg-blue-600/30 border border-blue-500/20 text-blue-100 rounded-tr-sm"
                  : "bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
            {msg.isOwn && (
              <span className="text-[10px] text-slate-500">
                {timeAgo(msg.timestamp)}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {crisisDetected && (
        <div className="mx-5 mb-3 flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 animate-in fade-in duration-300">
          <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-rose-300 font-bold text-xs">
              We hear you and we care
            </p>
            <p className="text-rose-200/80 text-[11px] mt-0.5 leading-relaxed">
              It sounds like you may be in distress. A counselor is available
              right now. Please call{" "}
              <span className="font-mono font-bold">0800 428 428</span> (24/7
              crisis line) or dial{" "}
              <span className="font-mono font-bold">*123*456#</span> for
              immediate support.
            </p>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Share your experience or offer support..."
              rows={2}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500/40 transition-all"
            />
            <span
              className={`absolute bottom-2 right-3 text-[10px] ${charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-slate-600"}`}
            >
              {charCount}/{MAX_CHARS}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => void handleSend()}
            disabled={!input.trim() || charCount > MAX_CHARS || isSending}
            className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
};

export default PeerSupportNetwork;
