import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

import { Screen, H1, Muted, Card, Banner, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import { sendSos, acknowledgeSos } from "@/features/sos/escalation";
import { useRegion } from "@/shared/region";
import { findService } from "@/shared/emergencyNumbers";
import { colors, font, gradients, radius, spacing } from "@/theme";

type SosState = "idle" | "counting" | "sending" | "sent" | "failed";
const CONFIRM_SECONDS = 5;

export default function Sos() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { country } = useRegion();
  const [state, setState] = useState<SosState>("idle");
  const [counter, setCounter] = useState(CONFIRM_SECONDS);
  const escalationId = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const fire = useCallback(async () => {
    setState("sending");
    try {
      const id = await sendSos(user?.id);
      escalationId.current = id;
      setState("sent");
      // Auto-acknowledge after 2 minutes (mirrors web PanicButton lifecycle).
      const ack = setTimeout(() => {
        if (escalationId.current) acknowledgeSos(escalationId.current).catch(() => {});
      }, 120000);
      timers.current.push(ack as unknown as ReturnType<typeof setInterval>);
    } catch {
      setState("failed");
    }
  }, [user?.id]);

  const startCountdown = useCallback(() => {
    setCounter(CONFIRM_SECONDS);
    setState("counting");
    const iv = setInterval(() => {
      setCounter((c) => {
        if (c <= 1) {
          clearInterval(iv);
          void fire();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    timers.current.push(iv);
  }, [fire]);

  const cancel = useCallback(() => {
    clearTimers();
    setState("idle");
    setCounter(CONFIRM_SECONDS);
  }, [clearTimers]);

  const hotline = findService(country, "gbv");
  const police = findService(country, "police");

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <H1>{t("sos.title")}</H1>
        <Muted>{t("sos.subtitle")}</Muted>
      </View>

      {state === "sent" ? <Banner tone="success">{t("sos.sent")}</Banner> : null}
      {state === "failed" ? <Banner tone="danger">{t("sos.failed")}</Banner> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("sos.holdToSend")}
        onPress={state === "counting" ? cancel : state === "idle" || state === "failed" ? startCountdown : undefined}
        disabled={state === "sending" || state === "sent"}
        style={({ pressed }) => [styles.bigBtnWrap, pressed && { opacity: 0.92 }]}
      >
        <LinearGradient
          colors={state === "sent" ? [colors.dangerDeep, "#9F1239"] : gradients.sos}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bigBtn}
        >
          <Icon name="sos" size={56} color="#fff" />
          <Text style={styles.bigBtnText}>
            {state === "idle" && t("sos.holdToSend")}
            {state === "counting" && t("sos.countdown", { n: counter })}
            {state === "sending" && t("sos.sending")}
            {state === "sent" && t("sos.active")}
            {state === "failed" && t("sos.holdToSend")}
          </Text>
        </LinearGradient>
      </Pressable>

      <Banner tone="info">{t("sos.locationConsent")}</Banner>

      <Card>
        {hotline ? (
          <Button
            label={`${t("sos.callHotline")} · ${hotline.number}`}
            variant="danger"
            onPress={() => Linking.openURL(`tel:${hotline.dial}`).catch(() => {})}
          />
        ) : null}
        {police ? (
          <Button
            label={`${t("sos.callPolice")} · ${police.number}`}
            variant="secondary"
            onPress={() => Linking.openURL(`tel:${police.dial}`).catch(() => {})}
          />
        ) : null}
        {country.ussd ? (
          <Muted style={{ fontSize: font.small, textAlign: "center" }}>
            {t("sos.ussdFallback", { code: country.ussd })}
          </Muted>
        ) : null}
        <Muted style={{ fontSize: font.tiny, textAlign: "center" }}>
          {country.flag} {t("resources.regionFor", { country: country.name })}
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigBtnWrap: {
    borderRadius: radius.xl,
    overflow: "hidden",
    shadowColor: colors.danger,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  bigBtn: {
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    minHeight: 180,
  },
  bigBtnText: { color: "#fff", fontSize: font.h2, fontWeight: "900", textAlign: "center", paddingHorizontal: spacing.lg },
});
