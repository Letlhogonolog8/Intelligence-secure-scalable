import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, H2, Muted, Body } from "@/components/ui";
import { GUIDES } from "@/shared/constants";
import { useRegion } from "@/shared/region";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

export function ResourcesView() {
  const { t } = useTranslation();
  const { country, countries, setCountry } = useRegion();
  const [picking, setPicking] = useState(false);

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <View style={styles.regionRow}>
          <View style={{ flex: 1 }}>
            <H2>{t("resources.emergency")}</H2>
            <Muted style={{ fontSize: font.small }}>
              {country.flag} {t("resources.regionFor", { country: country.name })}
            </Muted>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicking((p) => !p)}
            style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.changeText}>{t("common.change")}</Text>
          </Pressable>
        </View>

        {picking ? (
          <View style={styles.countryGrid}>
            {countries.map((c) => (
              <Pressable
                key={c.code}
                accessibilityRole="button"
                accessibilityState={{ selected: c.code === country.code }}
                onPress={() => {
                  setCountry(c.code);
                  setPicking(false);
                }}
                style={[styles.countryChip, c.code === country.code && styles.countryChipActive]}
              >
                <Text style={[styles.countryText, c.code === country.code && styles.countryTextActive]}>
                  {c.flag} {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Muted style={{ fontSize: font.small }}>{t("resources.offlineNote")}</Muted>
        <View style={{ gap: spacing.sm }}>
          {country.services.map((svc) => (
            <View key={svc.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Body style={styles.contactLabel}>{t(`services.${svc.id}`)}</Body>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("resources.call")} ${t(`services.${svc.id}`)} ${svc.number}`}
                onPress={() => Linking.openURL(`tel:${svc.dial}`).catch(() => {})}
                style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.callText}>{svc.number}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <H2>{t("resources.guides")}</H2>
        <View style={{ gap: spacing.md }}>
          {GUIDES.map((g) => (
            <View key={g.id} style={styles.guide}>
              <Body style={styles.guideTitle}>{t(`guides.${g.id}.title`)}</Body>
              <Muted style={styles.guideDesc}>{t(`guides.${g.id}.body`)}</Muted>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  regionRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  changeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  changeText: { color: colors.primary, fontSize: font.small, fontWeight: "700" },
  countryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countryChip: {
    minHeight: TOUCH_MIN - 12,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  countryChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "1f" },
  countryText: { color: colors.text, fontSize: font.small, fontWeight: "600" },
  countryTextActive: { color: colors.primary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  contactLabel: { fontWeight: "700" },
  callBtn: {
    minHeight: TOUCH_MIN - 8,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  callText: { color: "#fff", fontWeight: "800", fontSize: font.body },
  guide: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  guideTitle: { fontWeight: "700" },
  guideDesc: { fontSize: font.small, lineHeight: 19 },
});
