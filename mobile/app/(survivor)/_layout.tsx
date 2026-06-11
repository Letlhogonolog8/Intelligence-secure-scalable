import React from "react";
import { ActivityIndicator, View, type ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/auth/AuthProvider";
import { QuickExit } from "@/components/QuickExit";
import { Icon, type IconName } from "@/components/Icon";
import { colors, font } from "@/theme";

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon name={name} color={color} size={size} />
  );
}

export default function SurvivorLayout() {
  const { initializing, session, profile } = useAuth();
  const { t } = useTranslation();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile && profile.role !== "survivor") return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { color: colors.text, fontSize: font.h3, fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <QuickExit />,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.cardBorder,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("tabs.home"), tabBarIcon: tabIcon("home") }}
      />
      <Tabs.Screen
        name="support"
        options={{ title: t("tabs.support"), tabBarIcon: tabIcon("chat") }}
      />
      <Tabs.Screen
        name="sos"
        options={{ title: t("tabs.sos"), tabBarIcon: tabIcon("sos") }}
      />
      <Tabs.Screen
        name="report"
        options={{ title: t("tabs.report"), tabBarIcon: tabIcon("report") }}
      />
      <Tabs.Screen
        name="resources"
        options={{ title: t("tabs.resources"), tabBarIcon: tabIcon("shield") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person") }}
      />
      {/* Reachable from Home/Profile/Resources but hidden from the tab bar. */}
      <Tabs.Screen name="case-status" options={{ href: null, title: t("caseStatus.title") }} />
      <Tabs.Screen name="legal-rights" options={{ href: null, title: t("legal.title", "Know Your Rights") }} />
      <Tabs.Screen name="evidence" options={{ href: null, title: t("evidence.title", "Evidence Vault") }} />
    </Tabs>
  );
}
