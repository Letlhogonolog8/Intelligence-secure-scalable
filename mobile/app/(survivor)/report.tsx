import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Screen, H2, Card, Button, Banner, GradientHeader } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import i18n from "@/i18n";
import { saveDraft } from "@/features/offline/draftQueue";
import { getLocationSafe } from "@/features/sos/escalation";
import { VoiceCapture } from "@/features/voice/VoiceCapture";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

type Urgency = "low" | "medium" | "high";
type WhenKey = "today" | "yesterday" | "earlier" | "";

const TYPES = ["Physical", "Emotional", "Sexual", "Financial", "Other"];
const WHENS: { key: Exclude<WhenKey, "">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "earlier", label: "Earlier" },
];

// Map the coarse "when" picker to an approximate incident timestamp.
function whenToTimestamp(when: WhenKey): string | null {
  const now = new Date();
  if (when === "today") return now.toISOString();
  if (when === "yesterday") {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }
  return null; // "earlier"/unknown â€” leave null
}

export default function Report() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [when, setWhen] = useState<WhenKey>("");
  const [shareLocation, setShareLocation] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "info" | "danger"; text: string } | null>(null);

  const riskFor = (u: Urgency) => (u === "high" ? "high" : u === "medium" ? "medium" : "low");

  async function buildPayload() {
    const loc = shareLocation ? await getLocationSafe() : null;
    return {
      survivor_id: null,
      reported_by: anonymous ? null : user?.id ?? null,
      source: "mobile_app",
      report_method: "in_app",
      language: i18n.language,
      status: "new",
      category: type || null,
      risk_level: shareLocation && urgency === "high" ? "critical" : riskFor(urgency),
      priority: urgency,
      is_anonymous: anonymous,
      incident_occurred_at: whenToTimestamp(when),
      location: loc ? { lat: loc.lat, lng: loc.lng } : null,
      description: description.trim() || null,
    };
  }

  function reset() {
    setDescription("");
    setType("");
    setWhen("");
    setConsent(false);
  }

  async function submit() {
    setResult(null);
    if (!consent || !description.trim()) {
      setResult({ tone: "danger", text: t("report.consent") });
      return;
    }
    setLoading(true);
    const payload = await buildPayload();
    try {
      const { data, error } = await supabase
        .from("case_reports")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      const ref = (data as { id: string }).id.slice(0, 8).toUpperCase();
      setResult({ tone: "success", text: t("report.submitted", { ref }) });
      reset();
    } catch {
      await saveDraft(payload);
      setResult({ tone: "info", text: t("report.queued") });
      reset();
    } finally {
      setLoading(false);
    }
  }

  async function draft() {
    await saveDraft(await buildPayload());
    setResult({ tone: "info", text: t("report.queued") });
  }

  return (
    <Screen>
      <GradientHeader title={t("report.title")} subtitle={t("report.intro")} />

      {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}

      <Card>
        <H2>{t("report.type")}</H2>
        <View style={styles.chips}>
          {TYPES.map((ty) => (
            <Pressable key={ty} onPress={() => setType(ty)} style={[styles.chip, type === ty && styles.chipActive]} accessibilityRole="button">
              <Text style={[styles.chipText, type === ty && styles.chipTextActive]}>{ty}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <H2>{t("report.description")}</H2>
        <TextInput
          style={styles.textarea}
          placeholder={t("report.descriptionHint")}
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <VoiceCapture
          onTranscript={(text) => setDescription((cur) => (cur ? `${cur} ${text}` : text))}
        />
      </Card>

      <Card>
        <H2>{t("report.when", "When did it happen?")}</H2>
        <View style={styles.chips}>
          {WHENS.map((w) => (
            <Pressable key={w.key} onPress={() => setWhen((cur) => (cur === w.key ? "" : w.key))} style={[styles.chip, when === w.key && styles.chipActive]} accessibilityRole="button">
              <Text style={[styles.chipText, when === w.key && styles.chipTextActive]}>{t(`report.when_${w.key}`, w.label)}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <H2>{t("report.urgency")}</H2>
        <View style={styles.chips}>
          {(["low", "medium", "high"] as Urgency[]).map((u) => (
            <Pressable key={u} onPress={() => setUrgency(u)} style={[styles.chip, urgency === u && styles.chipActive]} accessibilityRole="button">
              <Text style={[styles.chipText, urgency === u && styles.chipTextActive]}>
                {t(`report.urgency${u[0].toUpperCase()}${u.slice(1)}` as "report.urgencyLow")}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("report.shareLocation")}</Text>
          <Switch value={shareLocation} onValueChange={setShareLocation} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("report.anonymous", "Report anonymously")}</Text>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.primary }} />
        </View>
        {anonymous ? <Text style={styles.hint}>{t("report.anonymousHint", "Your identity won't be attached to this report. You won't be able to track it from this device.")}</Text> : null}
      </Card>

      <Pressable onPress={() => setConsent((c) => !c)} style={styles.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
        <View style={[styles.checkbox, consent && styles.checkboxOn]}>{consent ? <Text style={styles.checkmark}>âœ“</Text> : null}</View>
        <Text style={styles.consentText}>{t("report.consent")}</Text>
      </Pressable>

      <View style={{ gap: spacing.md }}>
        <Button label={t("report.submit")} onPress={submit} loading={loading} />
        <Button label={t("report.saveDraft")} variant="secondary" onPress={draft} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: TOUCH_MIN - 8, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bgElevated },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "1f" },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  textarea: { minHeight: 120, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.lg, color: colors.text, fontSize: font.body, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  switchLabel: { color: colors.text, fontSize: font.body },
  hint: { color: colors.textMuted, fontSize: font.small, lineHeight: 18, marginTop: spacing.sm },
  consentRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#FFFFFF", fontWeight: "900" },
  consentText: { color: colors.textMuted, flex: 1, fontSize: font.small, lineHeight: 19 },
});
