import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Secure cross-role messaging data layer (police, survivors, NGOs, counselors,
 * admin). Conversations are participant-scoped via RLS; creation goes through
 * the `start_secure_conversation` RPC so the creator + recipients are seeded
 * atomically. See migration 20260701120000_secure_messaging.sql.
 */

export interface SecureParticipant {
  userId: string;
  role: string | null;
  lastReadAt: string;
}

export interface SecureConversation {
  id: string;
  subject: string | null;
  caseId: string | null;
  createdBy: string | null;
  createdAt: string;
  lastMessageAt: string;
  participants: SecureParticipant[];
}

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string | null;
  body: string;
  createdAt: string;
}

export const SECURE_CONVERSATIONS_KEY = [
  "aegis",
  "secureConversations",
] as const;
export const secureMessagesKey = (conversationId: string) =>
  ["aegis", "secureMessages", conversationId] as const;

export async function fetchSecureConversations(
  limit = 100,
): Promise<SecureConversation[]> {
  if (!hasSupabase) return [];
  const { data: conversations, error } = await supabase
    .from("secure_conversations")
    .select("id,subject,case_id,created_by,created_at,last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = conversations ?? [];
  if (rows.length === 0) return [];

  const { data: participantRows, error: participantError } = await supabase
    .from("secure_conversation_participants")
    .select("conversation_id,user_id,role,last_read_at")
    .in(
      "conversation_id",
      rows.map((row) => row.id),
    );
  if (participantError) throw participantError;

  const byConversation = new Map<string, SecureParticipant[]>();
  for (const row of participantRows ?? []) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push({
      userId: row.user_id,
      role: row.role,
      lastReadAt: row.last_read_at,
    });
    byConversation.set(row.conversation_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    caseId: row.case_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    participants: byConversation.get(row.id) ?? [],
  }));
}

export async function fetchSecureMessages(
  conversationId: string,
  limit = 200,
): Promise<SecureMessage[]> {
  if (!hasSupabase || !conversationId) return [];
  const { data, error } = await supabase
    .from("secure_messages")
    .select("id,conversation_id,sender_id,sender_role,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function sendSecureMessage(input: {
  conversationId: string;
  senderId: string;
  senderRole?: string | null;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Message is empty");
  const { error } = await supabase.from("secure_messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    sender_role: input.senderRole ?? null,
    body,
  });
  if (error) throw error;
}

export async function startSecureConversation(input: {
  subject?: string | null;
  caseId?: string | null;
  participantIds: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("start_secure_conversation", {
    p_subject: input.subject ?? null,
    p_case_id: input.caseId ?? null,
    p_participants: input.participantIds,
  });
  if (error) throw error;
  return data as string;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!hasSupabase || !conversationId || !userId) return;
  await supabase
    .from("secure_conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

/** A conversation is unread if a message arrived after the viewer last read it. */
export function isConversationUnread(
  conversation: SecureConversation,
  userId: string,
): boolean {
  const self = conversation.participants.find((p) => p.userId === userId);
  if (!self) return false;
  return new Date(conversation.lastMessageAt) > new Date(self.lastReadAt);
}

export const useSecureConversations = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: SECURE_CONVERSATIONS_KEY,
    queryFn: () => fetchSecureConversations(),
    enabled: hasSupabase && (options?.enabled ?? true),
    staleTime: 10000,
  });

export const useSecureMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: secureMessagesKey(conversationId ?? "none"),
    queryFn: () =>
      conversationId
        ? fetchSecureMessages(conversationId)
        : Promise.resolve([]),
    enabled: hasSupabase && Boolean(conversationId),
    staleTime: 5000,
  });
