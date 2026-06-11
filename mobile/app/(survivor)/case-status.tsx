import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Screen, Muted, Card, Body, GradientHeader } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
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

// Plain-language journey milestones, in order. Each status maps to a milestone
// index so a survivor can see how far their case has progressed.
const MILESTONES = ["Submitted", "Under review", "Assigned", "In progress", "Resolved"] as const;
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
  const current = STATUS_STAGE[status] ?? 0;
  return (
    <View style={styles.timeline}>
      {MILESTONES.map((label, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepLeft}>
              <View
                style={[
                  styles.dot,
                  done && { backgroundColor: colors.primary, borderColor: colors.primary },
                  isCurrent && styles.dotCurrent,
                ]}
              />
              {i < MILESTONES.length - 1 ? (
                <View style={[styles.connector, i < current && { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, done && { color: colors.text }, isCurrent && { fontWeight: "800" }]}>
              {label}
            </Text>
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
      // Reports are filed with reported_by; older rows may use survivor_id.
      const { data } = await supabase
        .from("case_reports")
        .select("id, status, priority, description, created_at")
        .or(`reported_by.eq.${user!.id},survivor_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      return (data as CaseReportRow[]) ?? [];
    },
  });

  return (
    <Screen>
      <GradientHeader title={t("caseStatus.title")} subtitle={t("caseStatus.intro")} />

      {isLoading ? (
        <Muted>{t("common.loading")}</Muted>
      ) : data && data.length > 0 ? (
        data.map((c) => {
          const tone = STATUS_TONE[c.status] ?? colors.textMuted;
          return (
            <Card key={c.id}>
              <View style={styles.headerRow}>
                <Text style={styles.ref}>#{c.id.slice(0, 8).toUpperCase()}</Text>
                <View style={[styles.badge, { backgroundColor: tone + "22", borderColor: tone + "55" }]}>
                  <Text style={[styles.badgeText, { color: tone }]}>{c.status.replace(/_/g, " ")}</Text>
                </View>
              </View>

              <JourneyTimeline status={c.status} />

              {c.description ? <Body style={{ fontSize: font.small }}>{c.description}</Body> : null}
              <Muted style={{ fontSize: font.tiny }}>
                {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
              </Muted>
            </Card>
          );
        })
      ) : (
        <Card>
          <Muted>{t("caseStatus.notFound")}</Muted>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ref: { color: colors.text, fontWeight: "800", fontSize: font.body },
  badge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeText: { fontSize: font.tiny, fontWeight: "800", textTransform: "capitalize" },
  timeline: { marginVertical: spacing.md },
  step: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stepLeft: { alignItems: "center", width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.cardBorder, backgroundColor: colors.bgElevated },
  dotCurrent: { width: 16, height: 16, borderRadius: 8, shadowColor: colors.primary, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 },
  connector: { width: 2, height: 22, backgroundColor: colors.cardBorder, marginVertical: 2 },
  stepLabel: { color: colors.textFaint, fontSize: font.small, lineHeight: 18, marginBottom: spacing.md },
});
