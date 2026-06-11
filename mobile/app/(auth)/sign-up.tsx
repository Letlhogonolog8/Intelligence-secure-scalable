import React, { useState } from "react";
import { View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, H1, Muted, Card, Field, Button, Banner } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { spacing } from "@/theme";

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!username.trim() || passphrase.length < 8 || !displayName.trim()) {
      setError(t("auth.passphraseHint"));
      return;
    }
    setLoading(true);
    try {
      await signUp(username, passphrase, displayName.trim());
      router.replace("/");
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        <H1>{t("auth.signUpTitle")}</H1>
        <Muted>{t("onboarding.tagline")}</Muted>
      </View>

      <Card>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Field
          label={t("auth.displayName")}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <Field
          label={t("auth.username")}
          hint={t("auth.usernameHint")}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <Field
          label={t("auth.passphrase")}
          hint={t("auth.passphraseHint")}
          secureTextEntry
          value={passphrase}
          onChangeText={setPassphrase}
        />
        <Button label={t("auth.signUp")} onPress={onSubmit} loading={loading} />
      </Card>

      <View style={{ alignItems: "center" }}>
        <Link href="/(auth)/sign-in">
          <Muted>{t("auth.haveAccount")}</Muted>
        </Link>
      </View>
    </Screen>
  );
}
