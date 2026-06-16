import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { Screen, Muted } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { ResourcesView } from "@/components/ResourcesView";
import { colors, font, radius, spacing } from "@/theme";

function QuickLink({
  icon,
  label,
  sub,
  tone,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  sub: string;
  tone?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const c = tone ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: c + "1A", borderColor: c + "30" },
        ]}
      >
        <Icon name={icon} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export default function Resources() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View style={{ gap: 2, marginTop: spacing.sm }}>
        <Text style={styles.title}>
          {t("resources.title", "Resources & help")}
        </Text>
        <Muted>
          {t(
            "resources.intro",
            "Find shelters, medical, legal and counseling support near you.",
          )}
        </Muted>
      </View>

      <View style={styles.listCard}>
        <QuickLink
          icon="shield"
          label={t("legal.title", "Know your rights")}
          sub={t("resources.legalSub", "Your legal protections & options")}
          onPress={() => router.push("/(survivor)/legal-rights")}
        />
        <QuickLink
          icon="folder"
          tone={colors.accent}
          label={t("evidence.title", "Evidence vault")}
          sub={t(
            "resources.evidenceSub",
            "Securely store photos, audio & notes",
          )}
          onPress={() => router.push("/(survivor)/evidence")}
          last
        />
      </View>

      <ResourcesView />
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
  listCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    height: 38,
    width: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  rowSub: { color: colors.textFaint, fontSize: font.small, marginTop: 1 },
});
