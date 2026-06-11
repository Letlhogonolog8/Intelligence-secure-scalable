import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Text } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/auth/AuthProvider";
import { RegionProvider } from "@/shared/region";
// Importing this module initializes i18n synchronously (see src/i18n/index.ts),
// so translations are ready on first render — no async gate that can hang the splash.
import { applyStoredLanguage } from "@/i18n";
import { colors } from "@/theme";

// Apply Inter as the app-wide default font once it has loaded. This overrides
// whatever system font the device imposes, so the brand typography is consistent
// everywhere. Bold weights are loaded too (Android synthesises any gaps).
let fontApplied = false;
function applyDefaultFont() {
  if (fontApplied) return;
  const T = Text as unknown as { defaultProps?: { style?: unknown } };
  T.defaultProps = T.defaultProps ?? {};
  T.defaultProps.style = { fontFamily: "Inter_400Regular" };
  fontApplied = true;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  if (fontsLoaded) applyDefaultFont();

  // Apply the saved language in the background; never blocks first render.
  useEffect(() => {
    void applyStoredLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RegionProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: "fade",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(survivor)" />
            </Stack>
            </RegionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
