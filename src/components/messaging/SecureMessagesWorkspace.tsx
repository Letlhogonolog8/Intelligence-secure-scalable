import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile, useUserProfiles } from "@/data/aegisData";
import {
  isConversationUnread,
  markConversationRead,
  secureMessagesKey,
  sendSecureMessage,
  SECURE_CONVERSATIONS_KEY,
  startSecureConversation,
  useSecureConversations,
  useSecureMessages,
  type SecureConversation,
} from "@/data/secureMessages";

/**
 * Portal-agnostic secure messaging workspace shared by every responder web
 * portal (police, NGO, counselor, admin). Conversations, participants and
 * messages are participant-scoped by RLS; delivery is realtime. Survivors use
 * the dedicated mobile screen — the same tables back both.
 */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;

const relative = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
};

const conversationTitle = (
  conv: SecureConversation,
  selfId: string,
  nameFor: (id: string) => string,
) => {
  if (conv.subject) return conv.subject;
  const others = conv.participants.filter((p) => p.userId !== selfId);
  if (others.length === 0) return "Just you";
  return others.map((p) => nameFor(p.userId)).join(", ");
};

const Avatar = ({ name }: { name: string }) => (
  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-[11px] font-black text-violet-200">
    {initials(name)}
  </div>
);

const NewConversationModal = ({
  selfId,
  onClose,
  onCreated,
}: {
  selfId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) => {
  const { data: profiles = [] } = useUserProfiles({ limit: 200 });
  const [subject, setSubject] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const recipients = profiles.filter(
    (p) => p.id !== selfId && p.isActive !== false,
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const create = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setBusy(true);
    try {
      const id = await startSecureConversation({
        subject: subject.trim() || null,
        caseId: caseRef.trim() || null,
        participantIds: selected,
      });
      toast.success("Conversation started");
      onCreated(id);
    } catch {
      toast.error("Couldn't start the conversation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="New secure conversation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">
            New secure conversation
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Message survivors, NGOs, counselors, and officers.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={caseRef}
            onChange={(event) => setCaseRef(event.target.value)}
            placeholder="Case reference (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Recipients
            </p>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
              {recipients.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">
                  No other users available to message yet.
                </p>
              ) : (
                recipients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-white/5",
                      selected.includes(p.id) && "bg-violet-500/15",
                    )}
                  >
                    <Avatar name={p.fullName || p.email || "User"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {p.fullName || p.email || "User"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        {p.role}
                      </p>
                    </div>
                    {selected.includes(p.id) && (
                      <CheckCircle2 className="h-4 w-4 text-violet-300" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start conversation"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SecureMessagesWorkspace: React.FC<{ className?: string }> = ({
  className,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const selfId = user?.id ?? "";
  const { data: profile } = useUserProfile(selfId || undefined);
  const { data: profiles = [] } = useUserProfiles({ limit: 200 });
  const { data: conversations = [] } = useSecureConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);

  const nameFor = (id: string) => {
    if (id === selfId) return "You";
    const p = profiles.find((x) => x.id === id);
    return p?.fullName || p?.email || id.slice(0, 8);
  };

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;
  const { data: messages = [] } = useSecureMessages(activeId);

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    if (!activeId || !selfId) return;
    void markConversationRead(activeId, selfId).then(() => {
      void queryClient.invalidateQueries({
        queryKey: SECURE_CONVERSATIONS_KEY,
      });
    });
  }, [activeId, selfId, queryClient, messages.length]);

  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("secure-messages-workspace")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "secure_messages" },
        (payload) => {
          const row = payload.new as { conversation_id?: string };
          void queryClient.invalidateQueries({
            queryKey: SECURE_CONVERSATIONS_KEY,
          });
          if (row.conversation_id) {
            void queryClient.invalidateQueries({
              queryKey: secureMessagesKey(row.conversation_id),
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const send = async () => {
    const body = draft.trim();
    if (!activeId) {
      toast.error("Select a conversation first");
      return;
    }
    if (!body || !selfId) {
      if (!body) toast.error("Message is empty");
      return;
    }
    setDraft("");
    try {
      await sendSecureMessage({
        conversationId: activeId,
        senderId: selfId,
        senderRole: profile?.role ?? null,
        body,
      });
      void queryClient.invalidateQueries({
        queryKey: secureMessagesKey(activeId),
      });
      void queryClient.invalidateQueries({
        queryKey: SECURE_CONVERSATIONS_KEY,
      });
    } catch {
      setDraft(body);
      toast.error("Couldn't send message");
    }
  };

  const unreadCount = conversations.filter((c) =>
    isConversationUnread(c, selfId),
  ).length;

  return (
    <div className={cn("space-y-4", className)}>
      {composing && (
        <NewConversationModal
          selfId={selfId}
          onClose={() => setComposing(false)}
          onCreated={(id) => {
            setComposing(false);
            void queryClient.invalidateQueries({
              queryKey: SECURE_CONVERSATIONS_KEY,
            });
            setActiveId(id);
          }}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquare className="h-4 w-4 text-violet-300" />
          Secure Messages
          {unreadCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500/20 px-1.5 text-[10px] font-black text-violet-200">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New Conversation
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
          {conversations.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-300">
              No conversations yet. Start one to message survivors, officers,
              NGOs, or counselors.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map((conv) => {
                const unread = isConversationUnread(conv, selfId);
                const title = conversationTitle(conv, selfId, nameFor);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setActiveId(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]",
                      conv.id === activeId && "bg-white/[0.05]",
                    )}
                  >
                    <Avatar name={title} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {title}
                      </p>
                      <p className="truncate text-xs text-slate-300">
                        {conv.caseId ? `Case ${conv.caseId} · ` : ""}
                        {conv.participants.length} participant
                        {conv.participants.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-400">
                        {relative(conv.lastMessageAt)}
                      </span>
                      {unread && (
                        <span className="h-2 w-2 rounded-full bg-violet-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex h-[520px] flex-col rounded-2xl border border-white/10 bg-slate-900/50">
          <div className="border-b border-white/5 px-5 py-3">
            <p className="text-sm font-black text-white">
              {activeConversation
                ? conversationTitle(activeConversation, selfId, nameFor)
                : "Conversation"}
            </p>
            <p className="text-[11px] text-slate-300">
              {activeConversation?.caseId
                ? `Case ${activeConversation.caseId}`
                : activeConversation
                  ? `${activeConversation.participants.length} participants`
                  : "Select a conversation"}
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {!activeConversation ? (
              <p className="py-10 text-center text-xs text-slate-400">
                Select or start a conversation to view messages.
              </p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                No messages yet. Say hello.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === selfId;
                return (
                  <div
                    key={m.id}
                    className={cn("max-w-[80%]", mine && "ml-auto")}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[10px] font-bold text-violet-300">
                        {nameFor(m.senderId)}
                        {m.senderRole ? ` · ${titleCase(m.senderRole)}` : ""}
                      </p>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2 text-sm",
                        mine
                          ? "rounded-tr-sm bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                          : "rounded-tl-sm border border-white/10 bg-white/[0.04] text-slate-200",
                      )}
                    >
                      {m.body}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-[9px] text-slate-500",
                        mine && "text-right",
                      )}
                    >
                      {relative(m.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-white/5 p-4">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder={
                activeConversation
                  ? "Type a secure message…"
                  : "Select a conversation first"
              }
              disabled={!activeConversation}
              className="h-10 border-white/10 bg-slate-900/60 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!activeConversation}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureMessagesWorkspace;
