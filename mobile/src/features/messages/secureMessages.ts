import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

/**
 * Survivor-side secure messaging (mirrors web src/data/secureMessages.ts).
 * Conversations are participant-scoped by RLS, so a survivor only ever sees the
 * threads their case team (police / NGO / counselor) has opened with them, and
 * can reply in real time. Responders start conversations from the web portals.
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

export const SECURE_CONVERSATIONS_KEY = ["secureConversations"] as const;
export const secureMessagesKey = (conversationId: string) =>
  ["secureMessages", conversationId] as const;

type ConversationRow = {
  id: string;
  subject: string | null;
  case_id: string | null;
  last_message_at: string;
};

type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  role: string | null;
  last_read_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string | null;
  body: string;
  created_at: string;
};

export async function fetchConversations(): Promise<SecureConversation[]> {
  const { data: conversations, error } = await supabase
    .from("secure_conversations")
    .select("id,subject,case_id,last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (conversations ?? []) as ConversationRow[];
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
  for (const row of (participantRows ?? []) as ParticipantRow[]) {
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
    lastMessageAt: row.last_message_at,
    participants: byConversation.get(row.id) ?? [],
  }));
}

export async function fetchMessages(
  conversationId: string,
): Promise<SecureMessage[]> {
  if (!conversationId) return [];
  const { data, error } = await supabase
    .from("secure_messages")
    .select("id,conversation_id,sender_id,sender_role,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  senderRole?: string | null;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("empty");
  const { error } = await supabase.from("secure_messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    sender_role: input.senderRole ?? null,
    body,
  });
  if (error) throw error;
}

/**
 * Survivor opens a conversation with their case team (responders who have
 * engaged their incidents). Participant seeding happens server-side in the
 * start_survivor_case_team_conversation RPC.
 */
export async function startCaseTeamConversation(
  subject?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "start_survivor_case_team_conversation",
    { p_subject: subject ?? null },
  );
  if (error) throw error;
  return data as string;
}

export async function markRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!conversationId || !userId) return;
  await supabase
    .from("secure_conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

export function isConversationUnread(
  conversation: SecureConversation,
  userId: string,
): boolean {
  const self = conversation.participants.find((p) => p.userId === userId);
  if (!self) return false;
  return new Date(conversation.lastMessageAt) > new Date(self.lastReadAt);
}

export const useSecureConversations = () =>
  useQuery({
    queryKey: SECURE_CONVERSATIONS_KEY,
    queryFn: fetchConversations,
    staleTime: 10000,
  });

export const useSecureMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: secureMessagesKey(conversationId ?? "none"),
    queryFn: () =>
      conversationId ? fetchMessages(conversationId) : Promise.resolve([]),
    enabled: Boolean(conversationId),
    staleTime: 5000,
  });
