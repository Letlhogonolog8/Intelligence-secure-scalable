import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { useAuth } from "@/auth/AuthProvider";
import { QuickExit } from "@/components/QuickExit";
import { Icon, type IconName } from "@/components/Icon";
import { colors, font, gradients, radius } from "@/theme";

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon name={name} color={color} size={size} />
  );
}

/** Elevated, always-prominent SOS button that sits in the centre of the tab bar. */
function SosTabButton({
  onPress,
  accessibilityState,
}: BottomTabBarButtonProps) {
  return (
    <View style={sos.slot} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS"
        accessibilityState={accessibilityState}
        onPress={onPress ?? undefined}
        style={({ pressed }) => [sos.press, pressed && { opacity: 0.9 }]}
      >
        <LinearGradient
          colors={gradients.sos}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={sos.circle}
        >
          <Icon name="sos" size={26} color="#fff" />
        </LinearGradient>
        <Text style={sos.label}>SOS</Text>
      </Pressable>
    </View>
  );
}

export default function SurvivorLayout() {
  const { initializing, session, profile } = useAuth();
  const { t } = useTranslation();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile && profile.role !== "survivor")
    return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: {
          color: colors.text,
          fontSize: font.h3,
          fontWeight: "700",
        },
        headerShadowVisible: false,
        headerRight: () => <QuickExit />,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.cardBorder,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: font.tiny, fontWeight: "700" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("tabs.home", "Home"), tabBarIcon: tabIcon("home") }}
      />
      <Tabs.Screen
        name="case-status"
        options={{
          title: t("tabs.cases", "Cases"),
          tabBarIcon: tabIcon("folder"),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: t("tabs.sos", "SOS"),
          tabBarButton: (props) => <SosTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: t("tabs.messages", "Messages"),
          tabBarIcon: tabIcon("chat"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile", "Profile"),
          tabBarIcon: tabIcon("person"),
        }}
      />

      {/* Reachable from Home / quick actions, but hidden from the tab bar. */}
      <Tabs.Screen
        name="report"
        options={{ href: null, title: t("tabs.report", "Report") }}
      />
      <Tabs.Screen
        name="resources"
        options={{ href: null, title: t("tabs.resources", "Resources") }}
      />
      <Tabs.Screen
        name="legal-rights"
        options={{ href: null, title: t("legal.title", "Know Your Rights") }}
      />
      <Tabs.Screen
        name="evidence"
        options={{ href: null, title: t("evidence.title", "Evidence Vault") }}
      />
      <Tabs.Screen
        name="ussd"
        options={{ href: null, title: t("ussd.title", "USSD access") }}
      />
    </Tabs>
  );
}

const sos = StyleSheet.create({
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  press: { alignItems: "center", justifyContent: "center", marginTop: -18 },
  circle: {
    height: 56,
    width: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.bgElevated,
    shadowColor: colors.danger,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  label: {
    color: colors.danger,
    fontSize: font.tiny,
    fontWeight: "800",
    marginTop: 3,
  },
});
