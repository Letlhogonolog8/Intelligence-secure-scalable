import React, { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  H2,
  Muted,
  Screen,
} from "@/components/ui";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api";
import { env, hasApi } from "@/lib/env";
import { colors, font, radius, spacing } from "@/theme";

interface UssdReply {
  sessionId?: string;
  text: string;
  endSession?: boolean;
}

/**
 * USSD access screen.
 *  - "Dial on this phone" launches the real *384*30933# session over the
 *    cellular network (Android; iOS restricts programmatic USSD).
 *  - "Try the menu in-app" drives the same backend USSD gateway
 *    (/api/ussd/process) so you can use the flow without the aggregator's
 *    web simulator.
 */
export default function UssdScreen() {
  const [phone, setPhone] = useState("+27820000000");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenText, setScreenText] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const telUri = `tel:${env.ussdCode.replace(/#/g, "%23")}`;

  const dial = () => {
    Linking.openURL(telUri).catch(() =>
      setError("Could not open the dialer on this device."),
    );
  };

  const post = async (userInput: string, useSession: string | null) => {
    if (!phone.trim()) {
      setError("Enter a phone number first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<UssdReply>("/api/ussd/process", {
        method: "POST",
        body: {
          phoneNumber: phone.trim(),
          userInput,
          sessionId: useSession ?? undefined,
        },
      });
      setSessionId(res.sessionId ?? useSession ?? null);
      setScreenText(res.text);
      setEnded(Boolean(res.endSession));
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    // Fresh client-side session id so each run starts at the main menu
    // instead of resuming a previous session for this number.
    const sid = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(sid);
    setEnded(false);
    setScreenText(null);
    post("", sid);
  };

  const reset = () => {
    setSessionId(null);
    setScreenText(null);
    setEnded(false);
    setReply("");
    setError(null);
  };

  return (
    <Screen>
      <H2>USSD access</H2>
      <Muted>
        USSD works on any phone with no internet. Dial it directly, or try the
        menu in-app below.
      </Muted>

      {/* Option B — real on-device dial */}
      <Card style={styles.card}>
        <View style={styles.rowHead}>
          <View style={styles.iconChip}>
            <Icon name="call" size={18} color={colors.primary} />
          </View>
          <Body style={styles.cardTitle}>Dial on this phone</Body>
        </View>
        <Text style={styles.code}>{env.ussdCode}</Text>
        <Muted>
          Opens your dialer and runs the live USSD session over the mobile
          network — exactly what survivors experience.
        </Muted>
        <View style={styles.spacer} />
        <Button label={`Dial ${env.ussdCode}`} onPress={dial} />
        {Platform.OS === "ios" ? (
          <View style={styles.note}>
            <Banner tone="warning">
              iPhone blocks auto-running USSD codes that contain “#”. The dialer
              will open — use the in-app menu below for a full test.
            </Banner>
          </View>
        ) : null}
      </Card>

      {/* Option A — in-app console driving the real backend gateway */}
      <Card style={styles.card}>
        <View style={styles.rowHead}>
          <View style={styles.iconChip}>
            <Icon name="chat" size={18} color={colors.primary} />
          </View>
          <Body style={styles.cardTitle}>Try the menu in-app</Body>
        </View>

        {!hasApi ? (
          <Banner tone="warning">
            Set EXPO_PUBLIC_API_URL to your backend (e.g. your Render URL) to
            use the in-app menu.
          </Banner>
        ) : (
          <>
            <Field
              label="Phone number (for the session)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              editable={!screenText}
              placeholder="+27820000000"
            />

            {screenText ? (
              <>
                <View style={styles.simScreen}>
                  <View style={styles.simHeaderRow}>
                    <Text style={styles.simHeader}>AEGIS USSD</Text>
                    <Text
                      style={[
                        styles.simState,
                        ended ? styles.simEnded : styles.simLive,
                      ]}
                    >
                      {ended ? "ENDED" : "LIVE"}
                    </Text>
                  </View>
                  <Text style={styles.simText}>{screenText}</Text>
                </View>

                {ended ? (
                  <Button label="Start again" onPress={start} loading={busy} />
                ) : (
                  <>
                    <Field
                      label="Your reply"
                      value={reply}
                      onChangeText={setReply}
                      placeholder="Type a number or text, then Send"
                      autoCapitalize="none"
                    />
                    <View style={styles.btnRow}>
                      <View style={styles.btnFlex}>
                        <Button
                          label="Send"
                          onPress={() => post(reply, sessionId)}
                          loading={busy}
                        />
                      </View>
                      <View style={styles.btnFlex}>
                        <Button
                          label="Cancel"
                          variant="ghost"
                          onPress={reset}
                        />
                      </View>
                    </View>
                  </>
                )}
              </>
            ) : (
              <Button
                label="Start USSD session"
                onPress={start}
                loading={busy}
              />
            )}
          </>
        )}

        {error ? (
          <View style={styles.note}>
            <Banner tone="danger">{error}</Banner>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, gap: spacing.sm },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: "rgba(168,85,247,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontWeight: "700" },
  code: {
    color: colors.text,
    fontSize: font.h2,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  spacer: { height: spacing.xs },
  note: { marginTop: spacing.sm },
  simScreen: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  simHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  simHeader: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  simState: { fontSize: font.tiny, fontWeight: "800", letterSpacing: 1 },
  simLive: { color: colors.success },
  simEnded: { color: colors.textFaint },
  simText: { color: colors.text, fontSize: font.body, lineHeight: 24 },
  btnRow: { flexDirection: "row", gap: spacing.md },
  btnFlex: { flex: 1 },
});
