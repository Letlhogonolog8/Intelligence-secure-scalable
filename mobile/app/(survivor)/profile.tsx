import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Screen, Muted, Button } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import { SUPPORTED_LANGUAGES, LanguageCode, setLanguage } from "@/i18n";
import i18n from "@/i18n";
import { useRegion } from "@/shared/region";
import { colors, font, radius, spacing } from "@/theme";

type NotifPref = "generic" | "silent" | "off";
const NOTIF_KEY = "aegis.notif";
const LOCK_KEY = "aegis.applock";

function SettingRow({
  icon,
  label,
  sub,
  tone,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  tone?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const c = tone ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: c + "1A", borderColor: c + "30" },
        ]}
      >
        <Icon name={icon} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Icon name="chevron" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
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

  const name = profile?.full_name?.trim() || t("profile.survivor", "Survivor");
  const initial = name.charAt(0).toUpperCase();

  return (
    <Screen>
      <Text style={styles.title}>{t("profile.settings", "Profile")}</Text>

      {/* Profile header */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>
            {user?.email ?? t("profile.protected", "Protected account")}
          </Text>
        </View>
      </View>

      {/* Safety & evidence quick links */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("profile.safety", "Safety & evidence")}
        </Text>
        <View style={styles.listCard}>
          <SettingRow
            icon="shield"
            label={t("legal.title", "Know your rights")}
            sub={t("profile.legalSub", "Your legal protections & options")}
            onPress={() => router.navigate("/(survivor)/legal-rights")}
          />
          <SettingRow
            icon="folder"
            tone={colors.accent}
            label={t("evidence.title", "Evidence vault")}
            sub={t(
              "profile.evidenceSub",
              "Securely store photos, audio & notes",
            )}
            onPress={() => router.navigate("/(survivor)/evidence")}
          />
          <SettingRow
            icon="call"
            label={t("ussd.title", "USSD access")}
            sub={t("profile.ussdSub", "Get help with no internet — any phone")}
            onPress={() => router.navigate("/(survivor)/ussd")}
            last
          />
        </View>
      </View>

      {/* Language */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("profile.language", "Language")}
        </Text>
        <View style={styles.chips}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => changeLang(l.code)}
              style={[styles.chip, lang === l.code && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipText,
                  lang === l.code && styles.chipTextActive,
                ]}
              >
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Region */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>{t("profile.region", "Region")}</Text>
        <Muted style={{ fontSize: font.small }}>
          {t("profile.regionDesc", "Sets your local emergency numbers.")}
        </Muted>
        <View style={styles.chips}>
          {countries.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => setCountry(c.code)}
              style={[
                styles.chip,
                country.code === c.code && styles.chipActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: country.code === c.code }}
            >
              <Text
                style={[
                  styles.chipText,
                  country.code === c.code && styles.chipTextActive,
                ]}
              >
                {c.flag} {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Notification privacy */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("profile.notificationPrivacy", "Notification privacy")}
        </Text>
        <View style={styles.listCard}>
          {(["generic", "silent", "off"] as NotifPref[]).map((opt, i, arr) => (
            <Pressable
              key={opt}
              onPress={() => changeNotif(opt)}
              style={[styles.radioRow, i === arr.length - 1 && styles.rowLast]}
              accessibilityRole="radio"
              accessibilityState={{ selected: notif === opt }}
            >
              <View style={[styles.radio, notif === opt && styles.radioOn]}>
                {notif === opt ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>
                  {opt === "generic"
                    ? t("profile.notifGeneric")
                    : opt === "silent"
                      ? t("profile.notifSilent")
                      : t("profile.notifOff")}
                </Text>
                {opt === "generic" ? (
                  <Muted style={{ fontSize: font.small }}>
                    {t("profile.notifGenericDesc")}
                  </Muted>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* App lock */}
      <View style={styles.lockCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>
            {t("profile.appLock", "App lock")}
          </Text>
          <Muted style={{ fontSize: font.small }}>
            {t(
              "profile.appLockDesc",
              "Require device authentication to open the app.",
            )}
          </Muted>
        </View>
        <Switch
          value={appLock}
          onValueChange={toggleLock}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <Button
        label={t("profile.signOut", "Log out")}
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace("/");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontFamily: "Inter_800ExtraBold",
    marginTop: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + "26",
    borderWidth: 1,
    borderColor: colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: font.h2,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
  },
  name: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
  },
  email: { color: colors.textFaint, fontSize: font.small, marginTop: 1 },

  listCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    height: 38,
    width: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  rowSub: { color: colors.textFaint, fontSize: font.small, marginTop: 1 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "1f",
  },
  chipText: { color: colors.text, fontWeight: "600", fontSize: font.small },
  chipTextActive: { color: colors.primary },

  radioRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  radioLabel: { color: colors.text, fontSize: font.body, fontWeight: "600" },

  lockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
