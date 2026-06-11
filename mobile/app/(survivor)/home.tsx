import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { LinearGradient } from "expo-linear-gradient";

import { Screen, H1, H2, Muted, Card, Body, Brand } from "@/components/ui";
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

function QuickAction({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: (tone ?? colors.primary) + "22" }]}>
        <Icon name={icon} size={22} color={tone ?? colors.primary} />
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

  const name = profile?.full_name?.trim();

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Brand />
        <H1>{name ? `${t("home.greeting")}, ${name}` : t("home.greeting")}</H1>
        <View style={styles.statusRow}>
          <Icon name="check" size={20} color={colors.success} />
          <Body style={{ fontWeight: "700", color: colors.success }}>{t("home.allCalm")}</Body>
          <Muted style={{ fontSize: font.small }}>· {t("home.safetyStatus")}</Muted>
        </View>
      </LinearGradient>

      <View style={{ gap: spacing.md }}>
        <H2>{t("home.quickActions")}</H2>
        <View style={styles.grid}>
          <QuickAction icon="sos" tone={colors.danger} label={t("home.getHelpNow")} onPress={() => router.navigate("/(survivor)/sos")} />
          <QuickAction icon="chat" label={t("home.openChat")} onPress={() => router.navigate("/(survivor)/support")} />
          <QuickAction icon="report" label={t("home.reportIncident")} onPress={() => router.navigate("/(survivor)/report")} />
          <QuickAction icon="search" label={t("home.checkCase")} onPress={() => router.navigate("/(survivor)/case-status")} />
          <QuickAction icon="shield" label={t("home.viewResources")} onPress={() => router.navigate("/(survivor)/resources")} />
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <H2>{t("home.recentActivity")}</H2>
        {recent && recent.length > 0 ? (
          <Card>
            {recent.map((r) => (
              <View key={r.id} style={styles.activityRow}>
                <Icon name="time" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }}>{(r.escalation_type ?? "alert").replace(/_/g, " ")}</Body>
                  <Text style={styles.activityMeta}>
                    {r.status} · {r.triggered_at ? new Date(r.triggered_at).toLocaleString() : ""}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Muted>{t("home.noActivity")}</Muted>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: {
    width: "47%",
    minHeight: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    justifyContent: "center",
  },
  actionIcon: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  activityMeta: { color: colors.textFaint, fontSize: font.small, marginTop: 2, textTransform: "capitalize" },
});
