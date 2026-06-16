import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
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

// Force Inter as the base font on EVERY <Text>, so the device's system font
// (which may be a playful/handwritten skin) never shows through. We patch
// Text.render to merge a base family UNDERNEATH each element's own style, so
// explicit weights (Inter_800ExtraBold, etc.) still win. defaultProps.style is
// kept as a fallback but is insufficient on its own — it does not merge when a
// `style` prop is already passed (which nearly all our text does).
let fontApplied = false;
function applyDefaultFont() {
  if (fontApplied) return;
  fontApplied = true;

  const T = Text as unknown as {
    defaultProps?: { style?: unknown };
    render?: (...args: unknown[]) => React.ReactElement;
  };
  T.defaultProps = T.defaultProps ?? {};
  T.defaultProps.style = { fontFamily: "Inter_400Regular" };

  const original = T.render;
  if (typeof original === "function") {
    T.render = function patchedTextRender(...args: unknown[]) {
      const element = original.apply(this, args);
      const prevStyle = (element.props as { style?: unknown }).style;
      return React.cloneElement(element, {
        style: [{ fontFamily: "Inter_400Regular" }, prevStyle],
      } as Partial<typeof element.props>);
    };
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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

  // Hold the first paint until Inter is ready so text never flashes in the
  // device's system font. If loading errors, proceed anyway (don't hang).
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

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
