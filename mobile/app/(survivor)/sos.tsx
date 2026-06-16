import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

import { Screen, Muted, Banner, Button } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import { sendSos, acknowledgeSos } from "@/features/sos/escalation";
import { useRegion } from "@/shared/region";
import { findService } from "@/shared/emergencyNumbers";
import { colors, font, gradients, radius, spacing } from "@/theme";

type SosState = "idle" | "counting" | "sending" | "sent" | "failed";
const CONFIRM_SECONDS = 5;

function Destination({
  icon,
  label,
  sub,
  tone,
  last,
}: {
  icon: IconName;
  label: string;
  sub: string;
  tone?: string;
  last?: boolean;
}) {
  const c = tone ?? colors.primary;
  return (
    <View style={[styles.dest, last && styles.destLast]}>
      <View
        style={[
          styles.destIcon,
          { backgroundColor: c + "1F", borderColor: c + "33" },
        ]}
      >
        <Icon name={icon} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.destLabel}>{label}</Text>
        <Text style={styles.destSub}>{sub}</Text>
      </View>
      <Icon name="check" size={16} color={colors.textFaint} />
    </View>
  );
}

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
      const ack = setTimeout(() => {
        if (escalationId.current)
          acknowledgeSos(escalationId.current).catch(() => {});
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

  const armed = state === "counting";
  const sent = state === "sent";
  const busy = state === "sending" || state === "sent";

  const buttonLabel =
    state === "idle" || state === "failed"
      ? t("sos.tapToSend", "Tap to send")
      : state === "counting"
        ? String(counter)
        : state === "sending"
          ? t("sos.sending", "Sending…")
          : t("sos.active", "Alert active");

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: spacing.sm }}>
        <Text style={styles.title}>{t("sos.title", "Emergency SOS")}</Text>
        <Muted>
          {t(
            "sos.subtitle",
            "Tap the button to send an emergency alert. You have a few seconds to cancel.",
          )}
        </Muted>
      </View>

      {sent ? (
        <Banner tone="success">
          {t("sos.sent", "Alert sent. Help is on the way.")}
        </Banner>
      ) : null}
      {state === "failed" ? (
        <Banner tone="danger">
          {t("sos.failed", "Could not send. Try again or call directly below.")}
        </Banner>
      ) : null}

      {/* Circular pulse-target SOS button */}
      <View style={styles.buttonZone}>
        <View
          style={[styles.ring, styles.ringOuter, armed && styles.ringArmed]}
        />
        <View
          style={[styles.ring, styles.ringMid, armed && styles.ringArmed]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sos.holdToSend", "Send emergency alert")}
          onPress={
            armed
              ? cancel
              : state === "idle" || state === "failed"
                ? startCountdown
                : undefined
          }
          disabled={busy}
          style={({ pressed }) => [
            styles.coreWrap,
            pressed && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={sent ? [colors.dangerDeep, "#9F1239"] : gradients.sos}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.core}
          >
            <Icon name="sos" size={44} color="#fff" />
            <Text style={styles.coreLabel}>{buttonLabel}</Text>
            {!busy ? (
              <Text style={styles.coreHint}>
                {armed
                  ? t("sos.tapCancel", "Tap to cancel")
                  : t("sos.sosWord", "SOS")}
              </Text>
            ) : null}
          </LinearGradient>
        </Pressable>
      </View>

      {armed ? (
        <Button
          label={t("sos.cancel", "Cancel SOS")}
          variant="secondary"
          onPress={cancel}
        />
      ) : null}

      {/* Alert destinations */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("sos.willAlert", "Alert will be sent to")}
        </Text>
        <View style={styles.destCard}>
          <Destination
            icon="shield"
            tone={colors.danger}
            label={t("sos.destPolice", "Police")}
            sub={t("sos.destPoliceSub", "Nearest precinct will respond")}
          />
          <Destination
            icon="people"
            label={t("sos.destContacts", "Emergency contacts")}
            sub={t("sos.destContactsSub", "Your trusted people")}
          />
          <Destination
            icon="heart"
            tone={colors.accent}
            label={t("sos.destNgo", "Support NGO")}
            sub={t("sos.destNgoSub", "Assigned partner organisation")}
          />
          <Destination
            icon="chat"
            tone={colors.success}
            label={t("sos.destCounselor", "Counselor")}
            sub={t("sos.destCounselorSub", "Your support worker")}
            last
          />
        </View>
      </View>

      <Banner tone="info">
        {t(
          "sos.locationConsent",
          "Your live location is shared with responders when you send an alert.",
        )}
      </Banner>

      {/* Direct call fallback */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("sos.callDirect", "Or call directly")}
        </Text>
        <View style={styles.callCard}>
          {hotline ? (
            <Button
              label={`${t("sos.callHotline", "GBV crisis line")} · ${hotline.number}`}
              variant="danger"
              onPress={() =>
                Linking.openURL(`tel:${hotline.dial}`).catch(() => {})
              }
            />
          ) : null}
          {police ? (
            <Button
              label={`${t("sos.callPolice", "Police")} · ${police.number}`}
              variant="secondary"
              onPress={() =>
                Linking.openURL(`tel:${police.dial}`).catch(() => {})
              }
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
        </View>
      </View>
    </Screen>
  );
}

const RING = 240;

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontFamily: "Inter_800ExtraBold",
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  buttonZone: {
    height: RING,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.sm,
  },
  ring: { position: "absolute", borderRadius: radius.pill, borderWidth: 1 },
  ringOuter: {
    height: RING,
    width: RING,
    borderColor: colors.danger + "22",
    backgroundColor: colors.danger + "08",
  },
  ringMid: {
    height: RING - 50,
    width: RING - 50,
    borderColor: colors.danger + "33",
    backgroundColor: colors.danger + "0F",
  },
  ringArmed: { borderColor: colors.danger + "66" },
  coreWrap: {
    borderRadius: radius.pill,
    shadowColor: colors.danger,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  core: {
    height: RING - 110,
    width: RING - 110,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 3,
    borderColor: "#ffffff22",
  },
  coreLabel: {
    color: "#fff",
    fontSize: font.h2,
    fontWeight: "900",
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
  },
  coreHint: {
    color: "#ffffffcc",
    fontSize: font.tiny,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  destCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  dest: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  destLast: { borderBottomWidth: 0 },
  destIcon: {
    height: 38,
    width: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  destLabel: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  destSub: { color: colors.textFaint, fontSize: font.small, marginTop: 1 },

  callCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
