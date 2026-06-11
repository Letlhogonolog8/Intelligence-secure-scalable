import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { env } from "@/lib/env";
import { colors, font, gradients, radius, spacing, TOUCH_MIN } from "@/theme";

export function Screen({
  children,
  scroll = true,
  edges = ["top", "bottom"],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {inner}
    </SafeAreaView>
  );
}

/**
 * Brand mark: the AEGIS-AI logo loaded from the web portal (`/aegis-logo.png`),
 * falling back to a gradient shield if it's not deployed yet or the device is
 * offline. Saving the logo to the web's `public/aegis-logo.png` lights it up on
 * both web and mobile — no separate mobile asset needed.
 */
export function Brand({ title, subtitle }: { title?: string; subtitle?: string }) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const logoUri = `${env.webPortalUrl}/aegis-logo.png`;
  return (
    <View style={brand.row}>
      {!logoFailed && env.webPortalUrl ? (
        <Image
          source={{ uri: logoUri }}
          onError={() => setLogoFailed(true)}
          style={brand.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={brand.badge}
        >
          <Ionicons name="shield-checkmark" size={22} color="#fff" />
        </LinearGradient>
      )}
      <View style={{ flex: 1 }}>
        <Text style={brand.kicker}>AEGIS-AI</Text>
        <Text style={brand.title}>{title ?? "AEGIS Support"}</Text>
        <Text style={brand.subtitle}>{subtitle ?? "Protect · Connect · Empower"}</Text>
      </View>
    </View>
  );
}

/** Gradient page header used across the survivor tabs for consistent branding. */
export function GradientHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={brand.header}
    >
      <H1>{title}</H1>
      {subtitle ? <Text style={brand.headerSub}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  const isGradient = variant === "primary" || variant === "danger";
  const onDark = variant === "secondary" || variant === "ghost";

  const content = loading ? (
    <ActivityIndicator color={onDark ? colors.primary : "#fff"} />
  ) : (
    <Text style={[styles.btnLabel, onDark && styles.btnLabelSecondary]}>{label}</Text>
  );

  if (isGradient) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled }}
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [styles.btnWrap, pressed && styles.btnPressed, isDisabled && styles.btnDisabled]}
      >
        <LinearGradient
          colors={variant === "danger" ? gradients.sos : gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        pressed && styles.btnPressed,
        isDisabled && styles.btnDisabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textFaint} style={styles.input} {...rest} />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  children: React.ReactNode;
}) {
  const toneColor =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : tone === "warning"
          ? colors.warning
          : colors.primary;
  return (
    <View style={[styles.banner, { borderColor: toneColor + "55", backgroundColor: toneColor + "14" }]}>
      <Text style={[styles.bannerText, { color: toneColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: "800", letterSpacing: -0.3, fontFamily: "Inter_800ExtraBold" },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: "700", fontFamily: "Inter_700Bold" },
  muted: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  body: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  btnWrap: { borderRadius: radius.pill, overflow: "hidden" },
  btn: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  btnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.cardBorder },
  btnGhost: { backgroundColor: "transparent" },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { color: "#fff", fontSize: font.body, fontWeight: "800", fontFamily: "Inter_800ExtraBold" },
  btnLabelSecondary: { color: colors.text },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  input: {
    minHeight: TOUCH_MIN,
    backgroundColor: colors.bgElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: font.body,
  },
  fieldHint: { color: colors.textFaint, fontSize: font.small, lineHeight: 18 },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { fontSize: font.small, lineHeight: 19, fontWeight: "600" },
});

const brand = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badge: {
    height: 44,
    width: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { height: 52, width: 52, borderRadius: radius.md },
  kicker: { color: colors.primary, fontSize: font.tiny, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase", fontFamily: "Inter_700Bold" },
  title: { color: colors.text, fontSize: font.h3, fontWeight: "800", fontFamily: "Inter_800ExtraBold" },
  subtitle: { color: colors.textFaint, fontSize: font.small },
  header: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  headerSub: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
});
