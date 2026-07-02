import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { Screen, Button, Banner } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/auth/AuthProvider";
import i18n from "@/i18n";
import { saveDraft } from "@/features/offline/draftQueue";
import { getLocationSafe } from "@/features/sos/escalation";
import {
  generatePublicReference,
  submitCaseReportWithEscalation,
} from "@/features/reports/submitCaseReport";
import {
  attachCommunityEvidence,
  type CommunityEvidenceAsset,
} from "@/features/reports/communityEvidence";
import { VoiceCapture } from "@/features/voice/VoiceCapture";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

type Urgency = "low" | "medium" | "high";
type WhenKey = "today" | "yesterday" | "earlier" | "";
type ReporterRelationship = "self" | "on_behalf" | "witness" | "concern";

const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "Physical Abuse", label: "Physical abuse", icon: "shield" },
  { key: "Sexual Assault", label: "Sexual assault", icon: "shield" },
  { key: "Emotional Abuse", label: "Emotional abuse", icon: "heart" },
  { key: "Financial Abuse", label: "Financial abuse", icon: "folder" },
  { key: "Harassment", label: "Harassment", icon: "person" },
  { key: "Stalking", label: "Stalking", icon: "location" },
  { key: "Child Abuse", label: "Child abuse", icon: "people" },
  { key: "Online Abuse", label: "Online abuse", icon: "chat" },
  { key: "Other", label: "Other", icon: "report" },
];

const AFFECTED = [
  "Woman",
  "Man",
  "Girl",
  "Boy",
  "Non-binary",
  "Prefer not to say",
];

const WHENS: { key: Exclude<WhenKey, "">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "earlier", label: "Earlier" },
];

const RELATIONSHIPS: { key: ReporterRelationship; label: string }[] = [
  { key: "self", label: "I need help" },
  { key: "on_behalf", label: "Someone else needs help" },
  { key: "witness", label: "I witnessed something" },
  { key: "concern", label: "Community safety concern" },
];

function whenToTimestamp(when: WhenKey): string | null {
  const now = new Date();
  if (when === "today") return now.toISOString();
  if (when === "yesterday") {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }
  return null;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export default function Report() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cats, setCats] = useState<string[]>([]);
  const [affected, setAffected] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [when, setWhen] = useState<WhenKey>("");
  const [relationship, setRelationship] =
    useState<ReporterRelationship>("self");
  const [shareLocation, setShareLocation] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [evidence, setEvidence] = useState<CommunityEvidenceAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "info" | "danger";
    text: string;
  } | null>(null);

  const riskFor = (u: Urgency) =>
    u === "high" ? "high" : u === "medium" ? "medium" : "low";

  async function buildPayload() {
    const loc = shareLocation ? await getLocationSafe() : null;
    const affectedPrefix = affected.length
      ? `[Affected: ${affected.join(", ")}] `
      : "";
    const isCommunity = relationship !== "self";
    return {
      survivor_id: null,
      reported_by: anonymous ? null : (user?.id ?? null),
      source: "mobile_app",
      report_method: isCommunity ? "community_mobile" : "in_app",
      reporter_relationship: isCommunity ? relationship : null,
      // A public tracking reference lets community/witness reporters follow up
      // by reference — matching the web community page and server tracker.
      public_reference: isCommunity ? generatePublicReference() : null,
      language: i18n.language,
      status: "new",
      category: cats.length ? cats.join(", ") : null,
      risk_level:
        shareLocation && urgency === "high" ? "critical" : riskFor(urgency),
      priority: urgency,
      is_anonymous: anonymous,
      incident_occurred_at: whenToTimestamp(when),
      location: loc ? { lat: loc.lat, lng: loc.lng } : null,
      description: (affectedPrefix + description.trim()).trim() || null,
    };
  }

  function reset() {
    setDescription("");
    setCats([]);
    setAffected([]);
    setWhen("");
    setRelationship("self");
    setConsent(false);
    setEvidence([]);
  }

  // Evidence can only be attached to a non-anonymous community report: RLS ties
  // the upload to the reporter's own case (reported_by = auth.uid()).
  const canAttachEvidence = relationship !== "self" && !anonymous;

  async function pickEvidence() {
    setResult(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setResult({
        tone: "danger",
        text: t("report.evidencePermission", {
          defaultValue: "Photo access is needed to attach evidence.",
        }),
      });
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (picked.canceled) return;
    setEvidence((cur) => [
      ...cur,
      ...picked.assets.map((a) => ({
        uri: a.uri,
        fileName: a.fileName ?? null,
        mimeType: a.mimeType ?? null,
      })),
    ]);
  }

  function removeEvidence(index: number) {
    setEvidence((cur) => cur.filter((_, i) => i !== index));
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
      const data = await submitCaseReportWithEscalation(payload);
      // Community/witness reports get a shareable CR- reference to track later;
      // a survivor's own report shows a short case reference.
      const ref =
        payload.public_reference ??
        (data.id ?? "submitted").slice(0, 8).toUpperCase();

      // Attach any evidence to the new case so responders see it in their
      // Case Evidence Register. Best-effort: a failed upload never loses the
      // report itself.
      let evidenceNote = "";
      if (data.id && canAttachEvidence && evidence.length && user?.id) {
        const { attached, failed } = await attachCommunityEvidence({
          caseId: data.id,
          caseReference: payload.public_reference,
          uploaderId: user.id,
          assets: evidence,
        });
        if (attached)
          evidenceNote += ` ${t("report.evidenceAttached", {
            defaultValue: "{{count}} evidence file(s) attached.",
            count: attached,
          })}`;
        if (failed)
          evidenceNote += ` ${t("report.evidenceFailed", {
            defaultValue:
              "{{count}} file(s) couldn't upload — you can add them later.",
            count: failed,
          })}`;
      }

      setResult({
        tone: "success",
        text: t("report.submitted", { ref }) + evidenceNote,
      });
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
      <View style={{ gap: 2, marginTop: spacing.sm }}>
        <Text style={styles.title}>{t("report.title", "Report incident")}</Text>
        <Text style={styles.intro}>
          {t(
            "report.intro",
            "You can remain anonymous. Share only what you're comfortable with.",
          )}
        </Text>
      </View>

      {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}

      {/* Reporter relationship */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.relationship", "Who are you reporting for?")}
        </Text>
        <View style={styles.chips}>
          {RELATIONSHIPS.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRelationship(r.key)}
              style={[styles.chip, relationship === r.key && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipText,
                  relationship === r.key && styles.chipTextActive,
                ]}
              >
                {t(`report.relationship_${r.key}`, r.label)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* What happened */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.type", "What happened?")}
        </Text>
        <Text style={styles.sectionHint}>
          {t("report.selectAll", "Select all that apply")}
        </Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const on = cats.includes(c.key);
            return (
              <Pressable
                key={c.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setCats((cur) => toggle(cur, c.key))}
                style={[styles.catCard, on && styles.catCardOn]}
              >
                <Icon
                  name={c.icon}
                  size={18}
                  color={on ? colors.primary : colors.textFaint}
                />
                <Text style={[styles.catLabel, on && { color: colors.text }]}>
                  {t(`report.cat_${c.key}`, c.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Who is affected */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.affected", "Who is affected?")}
        </Text>
        <View style={styles.chips}>
          {AFFECTED.map((a) => {
            const on = affected.includes(a);
            return (
              <Pressable
                key={a}
                onPress={() => setAffected((cur) => toggle(cur, a))}
                style={[styles.chip, on && styles.chipActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>
                  {t(`report.affected_${a}`, a)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Description */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.description", "What happened? (details)")}
        </Text>
        <TextInput
          style={styles.textarea}
          placeholder={t(
            "report.descriptionHint",
            "Share what you're comfortable with…",
          )}
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <VoiceCapture
          onTranscript={(text) =>
            setDescription((cur) => (cur ? `${cur} ${text}` : text))
          }
        />
      </View>

      {/* Evidence — community/witness reports only */}
      {relationship !== "self" ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>
            {t("report.evidence", "Attach evidence (optional)")}
          </Text>
          {anonymous ? (
            <Text style={styles.sectionHint}>
              {t(
                "report.evidenceAnon",
                "Turn off anonymous reporting to attach photos or documents.",
              )}
            </Text>
          ) : (
            <>
              <Text style={styles.sectionHint}>
                {t(
                  "report.evidenceHint",
                  "Photos or documents are shared securely with the response team.",
                )}
              </Text>
              {evidence.length ? (
                <View style={{ gap: spacing.xs }}>
                  {evidence.map((asset, i) => (
                    <View key={`${asset.uri}-${i}`} style={styles.evidenceRow}>
                      <Icon name="folder" size={16} color={colors.primary} />
                      <Text style={styles.evidenceName} numberOfLines={1}>
                        {asset.fileName ||
                          asset.uri.split("/").pop() ||
                          "Evidence"}
                      </Text>
                      <Pressable
                        onPress={() => removeEvidence(i)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          "report.removeEvidence",
                          "Remove",
                        )}
                      >
                        <Text style={styles.evidenceRemove}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button
                label={t("report.addEvidence", "Add photo / document")}
                variant="secondary"
                onPress={pickEvidence}
              />
            </>
          )}
        </View>
      ) : null}

      {/* When */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.when", "When did it happen?")}
        </Text>
        <View style={styles.chips}>
          {WHENS.map((w) => (
            <Pressable
              key={w.key}
              onPress={() => setWhen((cur) => (cur === w.key ? "" : w.key))}
              style={[styles.chip, when === w.key && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipText,
                  when === w.key && styles.chipTextActive,
                ]}
              >
                {t(`report.when_${w.key}`, w.label)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Urgency + options */}
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>
          {t("report.urgency", "How urgent is it?")}
        </Text>
        <View style={styles.chips}>
          {(["low", "medium", "high"] as Urgency[]).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUrgency(u)}
              style={[styles.chip, urgency === u && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipText,
                  urgency === u && styles.chipTextActive,
                ]}
              >
                {t(
                  `report.urgency${u[0].toUpperCase()}${u.slice(1)}` as "report.urgencyLow",
                )}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.optionCard}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>
                {t("report.shareLocation", "Share my location")}
              </Text>
              <Text style={styles.switchSub}>
                {t(
                  "report.shareLocationSub",
                  "Helps responders reach you faster",
                )}
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={[styles.switchRow, styles.switchRowDivider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>
                {t("report.anonymous", "Report anonymously")}
              </Text>
              <Text style={styles.switchSub}>
                {t(
                  "report.anonymousHint",
                  "Your identity won't be attached. You won't be able to track it from this device.",
                )}
              </Text>
            </View>
            <Switch
              value={anonymous}
              onValueChange={(v) => {
                setAnonymous(v);
                if (v) setEvidence([]); // evidence needs an identified reporter
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>
      </View>

      {/* Consent */}
      <Pressable
        onPress={() => setConsent((c) => !c)}
        style={styles.consentRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
      >
        <View style={[styles.checkbox, consent && styles.checkboxOn]}>
          {consent ? <Icon name="check" size={16} color="#fff" /> : null}
        </View>
        <Text style={styles.consentText}>{t("report.consent")}</Text>
      </Pressable>

      <View style={{ gap: spacing.md }}>
        <Button
          label={t("report.submit", "Submit report")}
          onPress={submit}
          loading={loading}
        />
        <Button
          label={t("report.saveDraft", "Save as draft")}
          variant="secondary"
          onPress={draft}
        />
      </View>
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
  },
  intro: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionHint: { color: colors.textFaint, fontSize: font.small, marginTop: -2 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catCard: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  catCardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "1A",
  },
  catLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "700",
    flexShrink: 1,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: TOUCH_MIN - 8,
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
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.primary },

  textarea: {
    minHeight: 120,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: font.body,
    textAlignVertical: "top",
  },

  optionCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  switchRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  switchLabel: { color: colors.text, fontSize: font.body, fontWeight: "600" },
  switchSub: {
    color: colors.textFaint,
    fontSize: font.small,
    lineHeight: 17,
    marginTop: 1,
  },

  evidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  evidenceName: { color: colors.textMuted, fontSize: font.small, flex: 1 },
  evidenceRemove: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: font.body,
  },

  consentRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: font.small,
    lineHeight: 19,
  },
});
