import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Screen, Card, Body, Muted, GradientHeader } from "@/components/ui";
import { colors, font, spacing } from "@/theme";

interface Section {
  key: string;
  title: string;
  points: string[];
}

// Plain-language legal guidance. Content is GBV-focused and intentionally
// general; emergency numbers are shown per-country elsewhere (Resources/SOS).
const SECTIONS: Section[] = [
  {
    key: "rights",
    title: "Know your rights",
    points: [
      "You have the right to safety, dignity, and to be treated without discrimination.",
      "You can report abuse at any police station — they cannot refuse to open a case.",
      "You have the right to a support person with you when you report or testify.",
      "Services for survivors (counselling, medical care, shelter) are free.",
    ],
  },
  {
    key: "protection",
    title: "Protection orders",
    points: [
      "A protection order is a court instruction telling an abuser to stop and stay away.",
      "Apply at your nearest Magistrate's Court — it is free and you do not need a lawyer.",
      "Bring your ID and any evidence (messages, photos, medical/police references).",
      "An interim order can be granted the same day; keep a copy with you at all times.",
      "If the order is broken, call the police immediately — breaking it is a crime.",
    ],
  },
  {
    key: "police",
    title: "Reporting to the police",
    points: [
      "Ask to open a case and get the case (CAS/OB) number — write it down.",
      "You can request a female officer and a private room.",
      "Give as much detail as you safely can: what happened, when, where, and who.",
      "Keep evidence: do not delete messages; photograph injuries and damage.",
    ],
  },
  {
    key: "medical",
    title: "At the clinic or hospital",
    points: [
      "Seek medical care even if injuries seem minor — some harm is not visible.",
      "After sexual assault, a medical exam can collect evidence and provide PEP and emergency contraception.",
      "Tell staff it is a GBV case so they follow the right protocol and complete the J88 form.",
      "Treatment does not require you to have opened a police case first.",
    ],
  },
  {
    key: "court",
    title: "Going to court",
    points: [
      "You can ask to testify via CCTV or behind a screen so you don't face the accused.",
      "A prosecutor represents the case — you do not pay for this.",
      "Bring your case number and any documents; arrive early and ask for the victim support room.",
      "You may bring a support person or social worker with you.",
    ],
  },
  {
    key: "privacy",
    title: "Your privacy & safety",
    points: [
      "Your report and personal details are confidential and access-controlled.",
      "Use this app's Quick Exit and app-lock features if you may be watched.",
      "Plan a safe place and a packed bag (ID, money, medication) in case you must leave quickly.",
      "Tell one trusted person your safety plan.",
    ],
  },
];

export default function LegalRights() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>("rights");

  return (
    <Screen>
      <GradientHeader
        title={t("legal.title", "Know Your Rights")}
        subtitle={t("legal.intro", "Plain-language guidance on your legal rights and next steps.")}
      />

      <Card style={{ borderColor: colors.warning + "55", backgroundColor: colors.warning + "12" }}>
        <Muted style={{ fontSize: font.small }}>
          {t(
            "legal.disclaimer",
            "This is general information, not legal advice. Laws differ by country. For your situation, contact a local legal aid clinic or the GBV helpline.",
          )}
        </Muted>
      </Card>

      {SECTIONS.map((s) => {
        const expanded = open === s.key;
        return (
          <Card key={s.key} style={{ paddingVertical: spacing.sm }}>
            <Pressable
              onPress={() => setOpen(expanded ? null : s.key)}
              style={styles.head}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Text style={styles.headTitle}>{t(`legal.section.${s.key}`, s.title)}</Text>
              <Text style={styles.chevron}>{expanded ? "−" : "+"}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.points}>
                {s.points.map((p, i) => (
                  <View key={i} style={styles.point}>
                    <View style={styles.bullet} />
                    <Body style={{ fontSize: font.small, flex: 1 }}>{t(`legal.${s.key}.${i}`, p)}</Body>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headTitle: { color: colors.text, fontWeight: "700", fontSize: font.body, flex: 1, paddingRight: spacing.md },
  chevron: { color: colors.primary, fontSize: font.h3, fontWeight: "800", width: 22, textAlign: "center" },
  points: { marginTop: spacing.md, gap: spacing.md },
  point: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
});
