import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Screen, Muted, Body } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRealtimeSync } from "@/lib/realtime";
import type { CaseReportRow } from "@/shared/types";
import { colors, font, radius, spacing } from "@/theme";

const STATUS_TONE: Record<string, string> = {
  new: colors.primary,
  received: colors.primary,
  under_review: colors.warning,
  assigned: colors.accent,
  escalated: colors.danger,
  in_progress: colors.accent,
  closed: colors.success,
  resolved: colors.success,
};

const MILESTONES = [
  "Submitted",
  "Under review",
  "Assigned",
  "In progress",
  "Resolved",
] as const;
const STATUS_STAGE: Record<string, number> = {
  new: 0,
  received: 0,
  under_review: 1,
  assigned: 2,
  escalated: 2,
  in_progress: 3,
  closed: 4,
  resolved: 4,
};

function JourneyTimeline({ status }: { status: string }) {
  const { t } = useTranslation();
  const current = STATUS_STAGE[status] ?? 0;
  return (
    <View style={styles.timeline}>
      {MILESTONES.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const reached = done || isCurrent;
        const stateText = done
          ? t("caseStatus.completed", "Completed")
          : isCurrent
            ? t("caseStatus.current", "In progress")
            : t("caseStatus.pending", "Pending");
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepLeft}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                ]}
              >
                {done ? <Icon name="check" size={12} color="#fff" /> : null}
              </View>
              {i < MILESTONES.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    i < current && { backgroundColor: colors.primary },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepBody}>
              <Text
                style={[
                  styles.stepLabel,
                  reached && { color: colors.text },
                  isCurrent && { fontWeight: "800" },
                ]}
              >
                {t(`caseStatus.ms_${i}`, label)}
              </Text>
              <Text
                style={[
                  styles.stepState,
                  isCurrent && { color: colors.primary },
                ]}
              >
                {stateText}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function CaseStatus() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-cases", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("case_reports")
        .select("id, status, priority, description, created_at")
        .or(`reported_by.eq.${user!.id},survivor_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      return (data as CaseReportRow[]) ?? [];
    },
  });

  // Live updates: when a responder changes this survivor's case on the web
  // portal, the row change streams in and the list refetches automatically.
  useRealtimeSync("case_reports", ["my-cases", user?.id], {
    enabled: Boolean(user?.id),
  });

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: spacing.sm }}>
        <Text style={styles.title}>{t("caseStatus.title", "My cases")}</Text>
        <Muted>
          {t(
            "caseStatus.intro",
            "Track the progress of your reports in real time.",
          )}
        </Muted>
      </View>

      {isLoading ? (
        <Muted>{t("common.loading", "Loading…")}</Muted>
      ) : data && data.length > 0 ? (
        data.map((c) => {
          const tone = STATUS_TONE[c.status] ?? colors.textMuted;
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.caseIcon}>
                  <Icon name="folder" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ref}>
                    Case #{c.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <Muted style={{ fontSize: font.tiny }}>
                    {t("caseStatus.updated", "Updated")}{" "}
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : ""}
                  </Muted>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: tone + "22", borderColor: tone + "55" },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: tone }]}>
                    {c.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <JourneyTimeline status={c.status} />

              {c.description ? (
                <View style={styles.descBox}>
                  <Body style={{ fontSize: font.small }}>{c.description}</Body>
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="folder" size={26} color={colors.textFaint} />
          </View>
          <Body style={{ fontWeight: "700", textAlign: "center" }}>
            {t("caseStatus.noneTitle", "No cases yet")}
          </Body>
          <Muted style={{ fontSize: font.small, textAlign: "center" }}>
            {t(
              "caseStatus.notFound",
              "When you file a report it will appear here so you can track its progress.",
            )}
          </Muted>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontFamily: "Inter_800ExtraBold",
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  caseIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  ref: { color: colors.text, fontWeight: "800", fontSize: font.body },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: font.tiny,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  timeline: { marginTop: spacing.xs },
  step: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stepLeft: { alignItems: "center", width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "33",
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.cardBorder,
    marginVertical: 2,
  },
  stepBody: { flex: 1, paddingBottom: spacing.md },
  stepLabel: { color: colors.textFaint, fontSize: font.body, lineHeight: 20 },
  stepState: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },

  descBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  empty: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    height: 56,
    width: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
});
