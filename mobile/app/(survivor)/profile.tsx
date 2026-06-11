import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Screen, H2, Muted, Card, Button, GradientHeader } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { SUPPORTED_LANGUAGES, LanguageCode, setLanguage } from "@/i18n";
import i18n from "@/i18n";
import { useRegion } from "@/shared/region";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

type NotifPref = "generic" | "silent" | "off";
const NOTIF_KEY = "aegis.notif";
const LOCK_KEY = "aegis.applock";

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { country, countries, setCountry } = useRegion();
  const [lang, setLang] = useState<string>(i18n.language);
  const [notif, setNotif] = useState<NotifPref>("generic");
  const [appLock, setAppLock] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((v) => v && setNotif(v as NotifPref));
    AsyncStorage.getItem(LOCK_KEY).then((v) => setAppLock(v === "1"));
  }, []);

  async function changeLang(code: LanguageCode) {
    await setLanguage(code);
    setLang(code);
  }
  async function changeNotif(v: NotifPref) {
    setNotif(v);
    await AsyncStorage.setItem(NOTIF_KEY, v);
  }
  async function toggleLock(v: boolean) {
    setAppLock(v);
    await AsyncStorage.setItem(LOCK_KEY, v ? "1" : "0");
  }

  return (
    <Screen>
      <GradientHeader title={t("profile.settings")} subtitle={profile?.full_name?.trim() || undefined} />

      <Card>
        <H2>{t("profile.language")}</H2>
        <View style={styles.chips}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Pressable key={l.code} onPress={() => changeLang(l.code)} style={[styles.chip, lang === l.code && styles.chipActive]} accessibilityRole="button">
              <Text style={[styles.chipText, lang === l.code && styles.chipTextActive]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <H2>{t("profile.region")}</H2>
        <Muted style={{ fontSize: font.small }}>{t("profile.regionDesc")}</Muted>
        <View style={styles.chips}>
          {countries.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => setCountry(c.code)}
              style={[styles.chip, country.code === c.code && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: country.code === c.code }}
            >
              <Text style={[styles.chipText, country.code === c.code && styles.chipTextActive]}>
                {c.flag} {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <H2>{t("profile.notificationPrivacy")}</H2>
        {(["generic", "silent", "off"] as NotifPref[]).map((opt) => (
          <Pressable key={opt} onPress={() => changeNotif(opt)} style={styles.radioRow} accessibilityRole="radio" accessibilityState={{ selected: notif === opt }}>
            <View style={[styles.radio, notif === opt && styles.radioOn]}>{notif === opt ? <View style={styles.radioDot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.radioLabel}>
                {opt === "generic" ? t("profile.notifGeneric") : opt === "silent" ? t("profile.notifSilent") : t("profile.notifOff")}
              </Text>
              {opt === "generic" ? <Muted style={{ fontSize: font.small }}>{t("profile.notifGenericDesc")}</Muted> : null}
            </View>
          </Pressable>
        ))}
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <H2>{t("profile.appLock")}</H2>
            <Muted style={{ fontSize: font.small }}>{t("profile.appLockDesc")}</Muted>
          </View>
          <Switch value={appLock} onValueChange={toggleLock} trackColor={{ true: colors.primary }} />
        </View>
      </Card>

      <Button label={t("profile.signOut")} variant="secondary" onPress={async () => { await signOut(); router.replace("/"); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: TOUCH_MIN - 10, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bgElevated },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "1f" },
  chipText: { color: colors.text, fontWeight: "600", fontSize: font.small },
  chipTextActive: { color: colors.primary },
  radioRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  radioLabel: { color: colors.text, fontSize: font.body, fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
