import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, H1, Muted, Card, Field, Button, Banner, Brand } from "@/components/ui";
import { useAuth, NotSurvivorError } from "@/auth/AuthProvider";
import { env } from "@/lib/env";
import { spacing } from "@/theme";

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When a staff member signs in here, offer a direct link to the web portal.
  const [showPortalLink, setShowPortalLink] = useState(false);

  async function onSubmit() {
    setError(null);
    setShowPortalLink(false);
    if (!username.trim() || !passphrase) {
      setError(t("auth.genericError"));
      return;
    }
    setLoading(true);
    try {
      await signIn(username, passphrase);
      router.replace("/");
    } catch (e) {
      if (e instanceof NotSurvivorError) {
        setError(t("auth.notSurvivor"));
        setShowPortalLink(true);
      } else {
        setError(t("auth.invalidCredentials"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
        <Brand />
        <View style={{ gap: spacing.xs }}>
          <H1>{t("auth.welcome")}</H1>
          <Muted>{t("onboarding.tagline")}</Muted>
        </View>
      </View>

      <Card>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {showPortalLink ? (
          <Button
            label={env.webPortalUrl.replace(/^https?:\/\//, "")}
            variant="secondary"
            onPress={() => Linking.openURL(env.webPortalUrl).catch(() => {})}
          />
        ) : null}
        <Field
          label={t("auth.username")}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          textContentType="username"
        />
        <Field
          label={t("auth.passphrase")}
          secureTextEntry
          value={passphrase}
          onChangeText={setPassphrase}
          textContentType="password"
        />
        <Button label={t("auth.signIn")} onPress={onSubmit} loading={loading} />
      </Card>

      <View style={{ gap: spacing.md, alignItems: "center" }}>
        <Link href="/(auth)/sign-up">
          <Muted>{t("auth.noAccount")}</Muted>
        </Link>
        <Link href="/(auth)/resources">
          <Muted>{t("auth.browseResources")}</Muted>
        </Link>
      </View>

      <Banner tone="warning">{t("onboarding.safetyNote")}</Banner>
    </Screen>
  );
}
