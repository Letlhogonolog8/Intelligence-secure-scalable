import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { Screen, Muted, Body } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { colors, font, gradients, radius, spacing, TOUCH_MIN } from "@/theme";

interface RecentEscalation {
  id: string;
  status: string;
  escalation_type: string | null;
  triggered_at: string | null;
}

interface ActiveCase {
  id: string;
  status: string;
  priority: string | null;
  created_at: string | null;
}

function QuickAction({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: string;
}) {
  const c = tone ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.actionIcon,
          { backgroundColor: c + "1F", borderColor: c + "33" },
        ]}
      >
        <Icon name={icon} size={20} color={c} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useAuth();

  const { data: recent } = useQuery({
    queryKey: ["recent-escalations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<RecentEscalation[]> => {
      const { data } = await supabase
        .from("escalation_events")
        .select("id, status, escalation_type, triggered_at")
        .eq("user_id", user!.id)
        .order("triggered_at", { ascending: false })
        .limit(5);
      return (data as RecentEscalation[] | null) ?? [];
    },
  });

  const { data: activeCase } = useQuery({
    queryKey: ["home-active-case", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ActiveCase | null> => {
      const { data } = await supabase
        .from("case_reports")
        .select("id, status, priority, created_at")
        .or(`reported_by.eq.${user!.id},survivor_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data as ActiveCase[] | null)?.[0] ?? null;
    },
  });

  const name = profile?.full_name?.trim();
  const initial = (name || "A").charAt(0).toUpperCase();
  const hour = new Date().getHours();
  const greetingText =
    hour < 12
      ? t("home.morning", "Good morning")
      : hour < 18
        ? t("home.afternoon", "Good afternoon")
        : t("home.evening", "Good evening");

  return (
    <Screen>
      {/* Welcome header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {greetingText}
            {name ? `, ${name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.tagline}>
            {t("home.tagline", "Your safety. Your voice. Your future.")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.notifications", "Notifications")}
          onPress={() => router.navigate("/(survivor)/support")}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <Icon name="bell" size={22} color={colors.textMuted} />
          {recent && recent.length > 0 ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      {/* Safety status */}
      <View style={styles.safetyCard}>
        <View style={styles.safetyIcon}>
          <Icon name="shield" size={22} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.safetyKicker}>
            {t("home.safetyStatus", "Safety status")}
          </Text>
          <Text style={styles.safetyTitle}>
            {t("home.allCalm", "You are safe")}
          </Text>
          <Muted style={{ fontSize: font.small }}>
            {t("home.lastCheckIn", "Last check-in")}:{" "}
            {t("home.now", "just now")}
          </Muted>
        </View>
      </View>

      {/* Emergency SOS card */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.getHelpNow", "Emergency SOS")}
        onPress={() => router.navigate("/(survivor)/sos")}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <LinearGradient
          colors={gradients.sos}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sosCard}
        >
          <View style={styles.sosIcon}>
            <Icon name="sos" size={30} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>
              {t("home.getHelpNow", "Emergency SOS")}
            </Text>
            <Text style={styles.sosSub}>
              {t(
                "home.sosHint",
                "Open emergency tools — alert police, contacts & your counselor",
              )}
            </Text>
          </View>
          <Icon name="chevron" size={22} color="#ffffffcc" />
        </LinearGradient>
      </Pressable>

      {/* Active case */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("home.activeCase", "Active case")}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/(survivor)/case-status")}
          style={({ pressed }) => [styles.caseCard, pressed && styles.pressed]}
        >
          {activeCase ? (
            <>
              <View style={styles.caseIcon}>
                <Icon name="folder" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }}>
                  Case {activeCase.id.slice(0, 12)}
                </Body>
                <View style={styles.caseMetaRow}>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>
                      {activeCase.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                  {activeCase.priority ? (
                    <Muted style={{ fontSize: font.tiny }}>
                      · {activeCase.priority}
                    </Muted>
                  ) : null}
                </View>
              </View>
              <Icon name="chevron" size={20} color={colors.textFaint} />
            </>
          ) : (
            <>
              <View style={styles.caseIcon}>
                <Icon name="folder" size={20} color={colors.textFaint} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }}>
                  {t("home.noCaseTitle", "No active case")}
                </Body>
                <Muted style={{ fontSize: font.small }}>
                  {t(
                    "home.noCaseSub",
                    "File a report and it will appear here to track.",
                  )}
                </Muted>
              </View>
              <Icon name="chevron" size={20} color={colors.textFaint} />
            </>
          )}
        </Pressable>
      </View>

      {/* Quick actions */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("home.quickActions", "Quick actions")}
        </Text>
        <View style={styles.grid}>
          <QuickAction
            icon="report"
            label={t("home.reportIncident", "Report incident")}
            onPress={() => router.navigate("/(survivor)/report")}
          />
          <QuickAction
            icon="chat"
            label={t("home.openChat", "Messages")}
            onPress={() => router.navigate("/(survivor)/support")}
          />
          <QuickAction
            icon="search"
            label={t("home.checkCase", "Track case")}
            onPress={() => router.navigate("/(survivor)/case-status")}
          />
          <QuickAction
            icon="heart"
            tone={colors.accent}
            label={t("home.safetyPlan", "Safety plan")}
            onPress={() => router.navigate("/(survivor)/profile")}
          />
          <QuickAction
            icon="shield"
            label={t("home.viewResources", "Resources")}
            onPress={() => router.navigate("/(survivor)/resources")}
          />
          <QuickAction
            icon="map"
            tone={colors.success}
            label={t("home.findHelp", "Find help nearby")}
            onPress={() => router.navigate("/(survivor)/resources")}
          />
        </View>
      </View>

      {/* Live updates */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("home.recentActivity", "Live updates")}
        </Text>
        <View style={styles.feedCard}>
          {recent && recent.length > 0 ? (
            recent.map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.activityRow,
                  i === recent.length - 1 && styles.activityRowLast,
                ]}
              >
                <View style={styles.activityDot}>
                  <Icon name="time" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600", fontSize: font.small }}>
                    {(r.escalation_type ?? "alert").replace(/_/g, " ")}
                  </Body>
                  <Text style={styles.activityMeta}>
                    {r.status} ·{" "}
                    {r.triggered_at
                      ? new Date(r.triggered_at).toLocaleString()
                      : ""}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Muted style={{ fontSize: font.small }}>
              {t("home.noActivity", "No updates yet. You're all caught up.")}
            </Muted>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + "26",
    borderWidth: 1,
    borderColor: colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
  },
  greeting: {
    color: colors.text,
    fontSize: font.h2,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -0.3,
  },
  tagline: { color: colors.textFaint, fontSize: font.small, marginTop: 1 },
  bell: {
    height: 44,
    width: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 11,
    height: 9,
    width: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.card,
  },

  safetyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.success + "12",
    borderWidth: 1,
    borderColor: colors.success + "33",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  safetyIcon: {
    height: TOUCH_MIN,
    width: TOUCH_MIN,
    borderRadius: radius.md,
    backgroundColor: colors.success + "1F",
    alignItems: "center",
    justifyContent: "center",
  },
  safetyKicker: {
    color: colors.success,
    fontSize: font.tiny,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  safetyTitle: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
    marginTop: 1,
  },

  sosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: colors.danger,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sosIcon: {
    height: 52,
    width: 52,
    borderRadius: radius.pill,
    backgroundColor: "#ffffff2e",
    alignItems: "center",
    justifyContent: "center",
  },
  sosTitle: {
    color: "#fff",
    fontSize: font.h3,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
  },
  sosSub: {
    color: "#ffffffdd",
    fontSize: font.small,
    lineHeight: 18,
    marginTop: 2,
  },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  caseIcon: {
    height: TOUCH_MIN,
    width: TOUCH_MIN,
    borderRadius: radius.md,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  caseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: colors.warning + "1F",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillText: {
    color: colors.warning,
    fontSize: font.tiny,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: {
    width: "47%",
    flexGrow: 1,
    minHeight: 92,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    justifyContent: "center",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.text, fontSize: font.body, fontWeight: "700" },

  feedCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityDot: {
    height: 32,
    width: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  activityMeta: {
    color: colors.textFaint,
    fontSize: font.tiny,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
