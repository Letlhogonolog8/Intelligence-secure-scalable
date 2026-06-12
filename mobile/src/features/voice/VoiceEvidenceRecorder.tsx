import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

type State = "idle" | "recording" | "uploading";

const BUCKET = "evidence";

/**
 * Evidence statements can run longer than report dictation; HIGH_QUALITY m4a
 * is roughly 1 MB/min, so five minutes stays a small private upload.
 */
const MAX_RECORDING_SECONDS = 300;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Records a voice note and stores the audio itself in the survivor's private
 * evidence vault (the owner-scoped `evidence` bucket) — unlike VoiceCapture,
 * which discards the audio after transcription. The recording becomes a
 * timestamped vault item alongside photos and documents.
 */
export function VoiceEvidenceRecorder({
  onSaved,
}: {
  onSaved?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const stopRef = useRef<() => void>(() => {});

  const clearTick = () => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  };

  useEffect(() => () => clearTick(), []);

  useEffect(() => {
    if (state !== "recording") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  async function start() {
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError(
          t("voice.permission", "Microphone access is needed to record."),
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsed(0);
      setState("recording");
      tick.current = setInterval(() => {
        setElapsed((s) => {
          // Auto-stop at the cap so a forgotten recorder never runs unbounded.
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            stopRef.current();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t("voice.startError", "Couldn't start recording."));
      setState("idle");
    }
  }

  async function stop() {
    clearTick();
    setState("uploading");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !user?.id) throw new Error("no_audio");
      const file = await fetch(uri);
      const blob = await file.blob();
      const ext = (uri.split(".").pop() || "m4a").toLowerCase();
      const path = `${user.id}/${Date.now()}-voice-note.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: blob.type || "audio/m4a",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      await onSaved?.();
    } catch {
      setError(
        t(
          "voiceEvidence.uploadError",
          "Couldn't save that recording. Check your connection and try again.",
        ),
      );
    } finally {
      setState("idle");
      setElapsed(0);
    }
  }
  stopRef.current = () => void stop();

  const recording = state === "recording";
  const uploading = state === "uploading";

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={recording ? stop : start}
        disabled={uploading}
        style={[styles.btn, recording && styles.btnRecording]}
        accessibilityRole="button"
        accessibilityLabel={
          recording
            ? t("voiceEvidence.stop", "Stop and save to vault")
            : t("voiceEvidence.record", "Record voice note")
        }
      >
        {uploading ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.btnText}>
              {t("voiceEvidence.saving", "Saving to vault…")}
            </Text>
          </View>
        ) : recording ? (
          <View style={styles.row}>
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
            <Text style={[styles.btnText, styles.btnTextRecording]}>
              {t("voiceEvidence.stop", "Stop and save to vault")} ·{" "}
              {formatElapsed(elapsed)}
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="mic" size={18} color={colors.primary} />
            <Text style={styles.btnText}>
              {t("voiceEvidence.record", "Record voice note")}
            </Text>
          </View>
        )}
      </Pressable>
      {recording ? (
        <Text style={styles.hint}>
          {t(
            "voiceEvidence.hint",
            "Recording saves privately to your vault. It stops automatically at {{m}} minutes.",
            {
              m: MAX_RECORDING_SECONDS / 60,
            },
          )}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btn: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + "66",
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRecording: {
    borderColor: colors.danger,
    backgroundColor: colors.danger + "1f",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  btnText: { color: colors.primary, fontWeight: "700", fontSize: font.body },
  btnTextRecording: { color: colors.danger },
  hint: { color: colors.textFaint, fontSize: font.tiny, textAlign: "center" },
  error: { color: colors.warning, fontSize: font.small },
});
