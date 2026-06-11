import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { Screen, GradientHeader, Button } from "@/components/ui";
import { ResourcesView } from "@/components/ResourcesView";
import { spacing } from "@/theme";

export default function Resources() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <GradientHeader title={t("resources.title")} />
      <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
        <Button
          label={t("legal.title", "Know Your Rights")}
          variant="secondary"
          onPress={() => router.push("/(survivor)/legal-rights")}
        />
        <Button
          label={t("evidence.title", "Evidence Vault")}
          variant="secondary"
          onPress={() => router.push("/(survivor)/evidence")}
        />
      </View>
      <ResourcesView />
    </Screen>
  );
}
