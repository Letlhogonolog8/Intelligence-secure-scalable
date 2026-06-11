import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { getStoredLanguage } from "@/i18n";
import { colors } from "@/theme";

/**
 * Launch gate (spec §6.1). Decides the first screen from language-onboarding
 * state and the Supabase session, then redirects. Survivors land on Home;
 * everyone else is routed to onboarding/auth.
 */
export default function Index() {
  const { initializing, session, profile } = useAuth();
  const [langChecked, setLangChecked] = useState(false);
  const [hasLang, setHasLang] = useState(false);

  useEffect(() => {
    getStoredLanguage().then((l) => {
      setHasLang(Boolean(l));
      setLangChecked(true);
    });
  }, []);

  if (initializing || !langChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!hasLang) return <Redirect href="/(onboarding)/language" />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  // A session whose profile is a non-survivor role is not allowed in this app;
  // the sign-in flow signs those out, but guard here too.
  if (profile && profile.role !== "survivor") return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(survivor)/home" />;
}
