import React from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, H1, Muted } from "@/components/ui";
import { ResourcesView } from "@/components/ResourcesView";
import { spacing } from "@/theme";

/** Public, no-account resources (spec: resources browsable pre-login). */
export default function PublicResources() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <H1>{t("resources.title")}</H1>
        <Link href="/(auth)/sign-in">
          <Muted>← {t("common.back")}</Muted>
        </Link>
      </View>
      <ResourcesView />
    </Screen>
  );
}
