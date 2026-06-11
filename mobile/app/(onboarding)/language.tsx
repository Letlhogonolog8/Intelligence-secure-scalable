import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, H1, Muted, Button, Brand } from "@/components/ui";
import {
  SUPPORTED_LANGUAGES,
  LanguageCode,
  setLanguage,
  deviceLanguage,
} from "@/i18n";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

export default function LanguagePicker() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LanguageCode>("en");

  function choose(code: LanguageCode) {
    setSelected(code);
    void setLanguage(code);
  }

  // Persist the chosen language BEFORE navigating, otherwise the launch gate
  // sees no stored language and redirects straight back here (infinite loop).
  async function onContinue() {
    await setLanguage(selected);
    router.replace("/");
  }

  async function useDevice() {
    const code = deviceLanguage();
    setSelected(code);
    await setLanguage(code);
    router.replace("/");
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
        <Brand />
        <View style={{ gap: spacing.xs }}>
          <H1>{t("common.selectLanguage")}</H1>
          <Muted>{t("onboarding.tagline")}</Muted>
        </View>
      </View>

      <View style={styles.grid}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              onPress={() => choose(lang.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={lang.label}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <Button label={t("common.continue")} onPress={onContinue} />
        <Button label={t("common.usePhoneLanguage")} variant="ghost" onPress={useDevice} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "1f" },
  chipText: { color: colors.text, fontSize: font.body, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
});
