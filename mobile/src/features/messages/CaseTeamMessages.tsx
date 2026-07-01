import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";
import {
  isConversationUnread,
  markRead,
  secureMessagesKey,
  SECURE_CONVERSATIONS_KEY,
  sendMessage,
  useSecureConversations,
  useSecureMessages,
  type SecureConversation,
} from "@/features/messages/secureMessages";

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;

const timeAgo = (iso: string) => {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const conversationTitle = (conv: SecureConversation, selfId: string) => {
  if (conv.subject) return conv.subject;
  const others = conv.participants.filter((p) => p.userId !== selfId);
  if (others.length === 0) return "Case team";
  const roles = others
    .map((p) => (p.role ? titleCase(p.role) : "Responder"))
    .join(", ");
  return roles || "Case team";
};

/**
 * Survivor secure-messages view: the case team (police / NGO / counselor) opens
 * a conversation from the web portals and the survivor reads + replies here in
 * real time. Same participant-scoped tables back both sides.
 */
export function CaseTeamMessages() {
  const { user, profile } = useAuth();
  const selfId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading } = useSecureConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: messages = [] } = useSecureMessages(activeId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    const channel = supabase
      .channel("secure_messages_mobile")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "secure_messages" },
        (payload) => {
          void queryClient.invalidateQueries({
            queryKey: SECURE_CONVERSATIONS_KEY,
          });
          const cid = (payload.new as { conversation_id?: string })
            ?.conversation_id;
          if (cid) {
            void queryClient.invalidateQueries({
              queryKey: secureMessagesKey(cid),
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!activeId || !selfId) return;
    void markRead(activeId, selfId).then(() => {
      void queryClient.invalidateQueries({
        queryKey: SECURE_CONVERSATIONS_KEY,
      });
    });
  }, [activeId, selfId, messages.length, queryClient]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || !selfId || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendMessage({
        conversationId: activeId,
        senderId: selfId,
        senderRole: profile?.role ?? "survivor",
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
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Thread view
  if (activeConversation) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <Pressable
          onPress={() => setActiveId(null)}
          style={styles.backRow}
          accessibilityRole="button"
        >
          <Text style={styles.back}>‹ All conversations</Text>
        </Pressable>
        <Text style={styles.threadTitle}>
          {conversationTitle(activeConversation, selfId)}
        </Text>
        {activeConversation.caseId ? (
          <Text style={styles.threadSub}>Case {activeConversation.caseId}</Text>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No messages yet. Your case team will reach out here.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === selfId;
            return (
              <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
                {!mine && item.senderRole ? (
                  <Text style={styles.sender}>
                    {titleCase(item.senderRole)}
                  </Text>
                ) : null}
                <View
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  <Text
                    style={mine ? styles.bubbleTextMine : styles.bubbleText}
                  >
                    {item.body}
                  </Text>
                </View>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a secure message…"
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            onPress={() => void send()}
            style={styles.sendBtn}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Conversation list
  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>
            No messages from your case team yet. When a responder reaches out,
            their conversation appears here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const unread = isConversationUnread(item, selfId);
        return (
          <Pressable
            onPress={() => setActiveId(item.id)}
            style={styles.row}
            accessibilityRole="button"
          >
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>
                {conversationTitle(item, selfId)}
              </Text>
              <Text style={styles.rowSub}>
                {item.caseId ? `Case ${item.caseId} · ` : ""}
                {item.participants.length} participant
                {item.participants.length === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
              {unread ? <View style={styles.dot} /> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  empty: {
    color: colors.textFaint,
    fontSize: font.small,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: TOUCH_MIN,
  },
  rowTitle: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  rowSub: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  rowMeta: { alignItems: "flex-end", gap: 6 },
  dot: {
    height: 8,
    width: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  backRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  back: { color: colors.primary, fontSize: font.small, fontWeight: "700" },
  threadTitle: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  threadSub: {
    color: colors.textFaint,
    fontSize: font.tiny,
    paddingHorizontal: spacing.lg,
  },
  bubbleWrap: { maxWidth: "82%", alignSelf: "flex-start" },
  bubbleWrapMine: { alignSelf: "flex-end" },
  sender: {
    color: colors.primary,
    fontSize: font.tiny,
    fontWeight: "700",
    marginBottom: 2,
  },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  theirs: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
  },
  mine: { backgroundColor: colors.primary },
  bubbleText: { color: colors.text, fontSize: font.small, lineHeight: 20 },
  bubbleTextMine: { color: "#fff", fontSize: font.small, lineHeight: 20 },
  time: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  timeMine: { textAlign: "right" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: TOUCH_MIN,
    color: colors.text,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.body,
  },
  sendBtn: {
    height: TOUCH_MIN,
    width: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontSize: 20, fontWeight: "800" },
});
