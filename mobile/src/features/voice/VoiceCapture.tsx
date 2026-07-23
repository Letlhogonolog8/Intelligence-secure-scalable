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

import { env, hasApi } from "@/lib/env";
import { colors, font, radius, spacing, TOUCH_MIN } from "@/theme";

type State = "idle" | "recording" | "transcribing";

/** Longest note we accept — keeps the upload well under the server's 12 MB cap. */
const MAX_RECORDING_SECONDS = 120;
/**
 * Transcription leg can ride out a Hugging Face cold start, but never hang
 * forever. The server itself bounds a cold-start retry to ~75s
 * (server/ai/huggingfaceAsr.ts), so this gives it headroom to actually finish
 * rather than aborting the request out from under it.
 */
const TRANSCRIBE_TIMEOUT_MS = 90_000;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface CapturedRecording {
  uri: string;
  mimeType: string | null;
}

/**
 * Records a short spoken statement and transcribes it via the server's
 * Hugging Face ASR endpoint, handing the text back to the parent (e.g. to fill
 * the incident description). Fully optional — if the API base or microphone is
 * unavailable it surfaces a gentle message and the user can still type.
 *
 * `onRecordingCaptured` (optional) hands back the local file for the raw
 * recording itself, independent of whether transcription succeeds — the
 * parent decides whether it's appropriate to keep (e.g. attach as case
 * evidence) based on its own privacy rules.
 */
export function VoiceCapture({
  onTranscript,
  onRecordingCaptured,
}: {
  onTranscript: (text: string) => void;
  onRecordingCaptured?: (recording: CapturedRecording) => void;
}) {
  const { t } = useTranslation();
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

  if (!hasApi) return null;

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
    setState("transcribing");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("no_audio");
      const file = await fetch(uri);
      const blob = await file.blob();
      onRecordingCaptured?.({ uri, mimeType: blob.type || "audio/m4a" });
      const res = await fetch(`${env.apiUrl}/api/ai/transcribe`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/m4a" },
        body: blob,
        signal: controller.signal,
      });
      const { text, coldStart } = (await res.json()) as {
        text?: string;
        coldStart?: boolean;
      };
      if (text && text.trim()) {
        onTranscript(text.trim());
      } else if (coldStart) {
        setError(
          t(
            "voice.warming",
            "The transcription service is still warming up — please try again in a moment.",
          ),
        );
      } else {
        setError(
          t("voice.empty", "Couldn't transcribe that — you can type instead."),
        );
      }
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setError(
        aborted
          ? t(
              "voice.timeout",
              "The server is taking too long — please try again or type instead.",
            )
          : t("voice.failed", "Transcription failed — you can type instead."),
      );
    } finally {
      clearTimeout(timer);
      setState("idle");
      setElapsed(0);
    }
  }
  stopRef.current = () => void stop();

  const recording = state === "recording";
  const transcribing = state === "transcribing";

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={recording ? stop : start}
        disabled={transcribing}
        style={[styles.btn, recording && styles.btnRecording]}
        accessibilityRole="button"
        accessibilityLabel={
          recording
            ? t("voice.stop", "Stop recording")
            : t("voice.record", "Record voice note")
        }
      >
        {transcribing ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.btnText}>
              {t("voice.transcribing", "Transcribing…")}
            </Text>
          </View>
        ) : recording ? (
          <View style={styles.row}>
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
            <Text style={[styles.btnText, styles.btnTextRecording]}>
              {t("voice.stop", "Stop & transcribe")} · {formatElapsed(elapsed)}
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="mic" size={18} color={colors.primary} />
            <Text style={styles.btnText}>
              {t("voice.record", "Record voice note")}
            </Text>
          </View>
        )}
      </Pressable>
      {recording ? (
        <Text style={styles.hint}>
          {t(
            "voice.hint",
            "Speak naturally. Recording stops automatically at {{m}} minutes.",
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
  wrap: { gap: spacing.sm, marginTop: spacing.md },
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
