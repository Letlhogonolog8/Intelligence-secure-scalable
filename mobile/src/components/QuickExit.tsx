import React, { useCallback } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

import { colors, font, radius, spacing } from "@/theme";

/**
 * Quick-exit safety control (spec §12.4). Immediately replaces the visible
 * screen with a neutral website and resets the in-app stack so nothing
 * sensitive remains if someone takes the phone. Present on every survivor
 * screen header.
 */
const NEUTRAL_URL = "https://www.bbc.com/weather";

export function QuickExit() {
  const router = useRouter();

  const onExit = useCallback(() => {
    // Reset to a neutral, non-sensitive in-app screen (the sign-in gate), then
    // leave to a neutral website. Using a group-qualified path avoids the
    // ambiguity of the two shared `resources` routes.
    router.replace("/(auth)/sign-in");
    Linking.openURL(NEUTRAL_URL).catch(() => {});
  }, [router]);

  return (
    <Pressable
      onPress={onExit}
      accessibilityRole="button"
      accessibilityLabel="Quick exit to a neutral page"
      hitSlop={10}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.label}>✕ Exit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: "700" },
});
