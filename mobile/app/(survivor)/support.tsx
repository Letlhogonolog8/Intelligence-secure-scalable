import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button, Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { CaseTeamMessages } from "@/features/messages/CaseTeamMessages";
import {
  sendToAI,
  QUICK_PROMPTS,
  ChatMessage,
} from "@/features/chat/survivorChat";
import type { PeerSupportMessageRow } from "@/shared/types";
import { colors, font, gradients, radius, spacing, TOUCH_MIN } from "@/theme";

type Tab = "ai" | "peer" | "team";

export default function Support() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>{t("tabs.messages", "Messages")}</Text>
        <Text style={styles.subtitle}>
          {t("support.subtitle", "Confidential support, always here for you.")}
        </Text>
      </View>
      <View style={styles.segment}>
        <SegBtn
          active={tab === "ai"}
          label={t("support.aiChat", "AI companion")}
          onPress={() => setTab("ai")}
        />
        <SegBtn
          active={tab === "peer"}
          label={t("support.peer", "Peer support")}
          onPress={() => setTab("peer")}
        />
        <SegBtn
          active={tab === "team"}
          label={t("support.caseTeam", "Case team")}
          onPress={() => setTab("team")}
        />
      </View>
      {tab === "ai" ? (
        <AiChat />
      ) : tab === "peer" ? (
        <PeerSupport />
      ) : (
        <CaseTeamMessages />
      )}
    </SafeAreaView>
  );
}

function SegBtn({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.segBtn}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.segInner}
        >
          <Text style={styles.segTextActive}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.segInner, styles.segIdle]}>
          <Text style={styles.segText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ----------------------------- AI chat ----------------------------- */
interface UiMessage extends ChatMessage {
  id: string;
  crisis?: boolean;
}

function AiChat() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<UiMessage>>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    const history = messages.map(({ role, content }) => ({ role, content }));
    const { content } = await sendToAI(history, trimmed);
    const crisis = content.includes("CRISIS ALERT");
    setMessages((m) => [
      ...m,
      { id: `a-${Date.now()}`, role: "assistant", content, crisis },
    ]);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.disclaimer}>
        <Muted style={{ fontSize: font.small }}>
          {t("support.disclaimer")}
        </Muted>
      </View>

      {messages.length === 0 ? (
        <View style={styles.quickWrap}>
          {QUICK_PROMPTS.map((q) => (
            <Pressable
              key={q}
              onPress={() => send(q)}
              style={styles.quickChip}
              accessibilityRole="button"
            >
              <Text style={styles.quickText}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAi,
                item.crisis && styles.bubbleCrisis,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === "user" && {
                    color: "#FFFFFF",
                    fontWeight: "600",
                  },
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
        />
      )}

      {sending ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t("support.placeholder")}
          placeholderTextColor={colors.textFaint}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable
          onPress={() => send(input)}
          style={styles.sendBtn}
          accessibilityRole="button"
          accessibilityLabel={t("support.send")}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* --------------------------- Peer support --------------------------- */
const ALIAS_KEY = "aegis.peer.alias";
const PEER_MAX_CHARS = 280;

function timeAgo(iso: string): string {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function PeerSupport() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<PeerSupportMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [alias, setAlias] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  // Remember the chosen alias across sessions so posting stays one-tap.
  useEffect(() => {
    AsyncStorage.getItem(ALIAS_KEY)
      .then((saved) => {
        if (saved) setAlias(saved);
      })
      .catch(() => {});
  }, []);

  async function load() {
    const { data } = await supabase
      .from("peer_support_messages")
      .select("*")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as PeerSupportMessageRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("peer_support")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "peer_support_messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function post() {
    const content = text.trim();
    const who = alias.trim() || t("common.you");
    if (!content || posting) return;
    setPosting(true);
    void AsyncStorage.setItem(ALIAS_KEY, alias.trim()).catch(() => {});
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await supabase
      .from("peer_support_messages")
      .insert({ alias: who, content, flagged: false, expires_at: expires });
    setText("");
    setPosting(false);
    void load();
  }

  async function flag(id: string) {
    // RLS only allows UPDATE through this narrow RPC — a direct .update() is rejected.
    const { error } = await supabase.rpc("flag_peer_support_message", {
      p_message_id: id,
    });
    if (error) {
      Alert.alert(
        t("support.peerFlagFailedTitle", "Couldn't report message"),
        t(
          "support.peerFlagFailed",
          "Please check your connection and try again.",
        ),
      );
      return;
    }
    setRows((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.disclaimer}>
        <Muted style={{ fontSize: font.small }}>{t("support.peerNote")}</Muted>
      </View>
      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.xl }}
        />
      ) : (
        <FlatList
          style={styles.flex}
          data={rows}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <View style={styles.peerEmpty}>
              <View style={styles.peerEmptyBadge}>
                <Ionicons name="heart" size={28} color={colors.accent} />
              </View>
              <Text style={styles.peerEmptyTitle}>
                {t("support.peerEmptyTitle", "A space for each other")}
              </Text>
              <Muted style={{ textAlign: "center" }}>
                {t("support.peerEmpty")}
              </Muted>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.peerCard}>
              <View style={styles.peerHead}>
                <Text style={styles.peerAlias}>{item.alias}</Text>
                <Text style={styles.peerTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={styles.peerText}>{item.content}</Text>
              <Pressable
                onPress={() => flag(item.id)}
                accessibilityRole="button"
                accessibilityLabel={t("support.peerFlag")}
                hitSlop={8}
              >
                <Text style={styles.flag}>{t("support.peerFlag")}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      <View
        style={{
          padding: spacing.lg,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
        }}
      >
        <TextInput
          style={styles.aliasInput}
          placeholder={t("support.peerAlias")}
          placeholderTextColor={colors.textFaint}
          value={alias}
          onChangeText={setAlias}
          maxLength={24}
        />
        <TextInput
          style={[styles.input, { maxHeight: 90 }]}
          placeholder={t("support.peerPlaceholder")}
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={(v) => setText(v.slice(0, PEER_MAX_CHARS))}
          multiline
        />
        <View style={styles.peerActions}>
          <Text style={styles.counter}>
            {text.length}/{PEER_MAX_CHARS}
          </Text>
          <View style={{ flex: 1 }}>
            <Button
              label={t("support.peerPost")}
              onPress={post}
              loading={posting}
              disabled={!text.trim()}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  titleBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 2 },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontFamily: "Inter_800ExtraBold",
  },
  subtitle: { color: colors.textMuted, fontSize: font.small },
  segment: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  segBtn: { flex: 1, borderRadius: radius.pill, overflow: "hidden" },
  segInner: {
    minHeight: TOUCH_MIN,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segIdle: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  segText: { color: colors.textMuted, fontWeight: "700" },
  segTextActive: { color: "#fff", fontWeight: "800" },
  disclaimer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  quickWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  quickText: { color: colors.text, fontSize: font.small, fontWeight: "600" },
  bubble: { maxWidth: "85%", borderRadius: radius.md, padding: spacing.md },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleAi: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bubbleCrisis: {
    borderColor: colors.danger,
    backgroundColor: colors.danger + "1f",
  },
  bubbleText: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN,
    maxHeight: 120,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    color: colors.text,
    fontSize: font.body,
  },
  aliasInput: {
    minHeight: TOUCH_MIN,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: font.body,
  },
  sendBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  peerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  peerHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  peerAlias: { color: colors.accent, fontWeight: "700", fontSize: font.small },
  peerTime: { color: colors.textFaint, fontSize: font.tiny, fontWeight: "600" },
  peerText: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  flag: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  peerEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  peerEmptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + "1a",
    borderWidth: 1,
    borderColor: colors.accent + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  peerEmptyTitle: { color: colors.text, fontSize: font.h3, fontWeight: "800" },
  peerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  counter: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: "600",
    minWidth: 52,
  },
});
