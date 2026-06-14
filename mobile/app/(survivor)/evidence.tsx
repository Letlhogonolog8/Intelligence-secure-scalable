import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

import {
  Screen,
  Card,
  Muted,
  Button,
  Banner,
  GradientHeader,
} from "@/components/ui";
import { VoiceEvidenceRecorder } from "@/features/voice/VoiceEvidenceRecorder";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { uploadToVault, VaultUploadTimeoutError } from "@/lib/vaultUpload";
import { colors, font, radius, spacing } from "@/theme";

const BUCKET = "evidence";

const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "wav", "3gp", "caf", "ogg"];

function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.includes(ext);
}

interface VaultItem {
  name: string;
  path: string;
  signedUrl: string | null;
}

export default function Evidence() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{
    tone: "success" | "info" | "danger";
    text: string;
  } | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [sharedPaths, setSharedPaths] = useState<Set<string>>(new Set());
  const [sharingPath, setSharingPath] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const stopPlayback = useCallback(() => {
    playerRef.current?.remove();
    playerRef.current = null;
    setPlayingPath(null);
  }, []);

  useEffect(() => stopPlayback, [stopPlayback]);

  const togglePlayback = useCallback(
    async (item: VaultItem) => {
      if (playingPath === item.path) {
        stopPlayback();
        return;
      }
      if (!item.signedUrl) return;
      stopPlayback();
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
        const player = createAudioPlayer({ uri: item.signedUrl });
        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) stopPlayback();
        });
        playerRef.current = player;
        setPlayingPath(item.path);
        player.play();
      } catch {
        stopPlayback();
      }
    },
    [playingPath, stopPlayback],
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(user.id, { sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const withUrls = await Promise.all(
        (data ?? [])
          .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
          .map(async (f) => {
            const path = `${user.id}/${f.name}`;
            const { data: signed } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(path, 3600);
            return { name: f.name, path, signedUrl: signed?.signedUrl ?? null };
          }),
      );
      setItems(withUrls);

      // Which items the survivor has actively shared with their case team.
      const { data: consents } = await supabase
        .from("evidence_consents")
        .select("storage_path, revoked_at")
        .eq("survivor_id", user.id);
      setSharedPaths(
        new Set(
          (consents ?? [])
            .filter((c: { revoked_at: string | null }) => c.revoked_at == null)
            .map((c: { storage_path: string }) => c.storage_path),
        ),
      );
    } catch {
      setNote({
        tone: "info",
        text: t(
          "evidence.loadError",
          "Couldn't load your vault. Pull to retry once you're online.",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPhoto() {
    setNote(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setNote({
        tone: "danger",
        text: t(
          "evidence.permission",
          "Photo access is needed to add evidence.",
        ),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0] || !user?.id) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      const ext = (
        asset.fileName?.split(".").pop() ||
        asset.uri.split(".").pop() ||
        "jpg"
      ).toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      await uploadToVault(path, asset.uri, asset.mimeType ?? "image/jpeg");
      setNote({
        tone: "success",
        text: t("evidence.added", "Evidence saved securely."),
      });
      await load();
    } catch (err) {
      setNote({
        tone: "danger",
        text:
          err instanceof VaultUploadTimeoutError
            ? t(
                "evidence.uploadTimeout",
                "Upload is taking too long — check your connection and try again.",
              )
            : t(
                "evidence.uploadError",
                "Upload failed. Check your connection and try again.",
              ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare(item: VaultItem) {
    if (!user?.id) return;
    setNote(null);
    setSharingPath(item.path);
    const currentlyShared = sharedPaths.has(item.path);
    try {
      if (currentlyShared) {
        const { error } = await supabase
          .from("evidence_consents")
          .update({ revoked_at: new Date().toISOString() })
          .eq("survivor_id", user.id)
          .eq("storage_path", item.path);
        if (error) throw error;
        setSharedPaths((prev) => {
          const next = new Set(prev);
          next.delete(item.path);
          return next;
        });
        setNote({
          tone: "info",
          text: t(
            "consent.revoked",
            "Stopped sharing. Your case team can no longer open this file.",
          ),
        });
      } else {
        const { error } = await supabase.from("evidence_consents").upsert(
          {
            survivor_id: user.id,
            storage_path: item.path,
            file_name: item.name,
            revoked_at: null,
            granted_at: new Date().toISOString(),
          },
          { onConflict: "survivor_id,storage_path" },
        );
        if (error) throw error;
        setSharedPaths((prev) => new Set(prev).add(item.path));
        setNote({
          tone: "success",
          text: t(
            "consent.shared",
            "Shared with your case team. You can stop sharing anytime.",
          ),
        });
      }
    } catch {
      setNote({
        tone: "danger",
        text: t("consent.error", "Couldn't update sharing. Please try again."),
      });
    } finally {
      setSharingPath(null);
    }
  }

  async function remove(path: string) {
    if (playingPath === path) stopPlayback();
    setBusy(true);
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      // Drop any consent row so a deleted file leaves no dangling share grant.
      if (user?.id) {
        await supabase
          .from("evidence_consents")
          .delete()
          .eq("survivor_id", user.id)
          .eq("storage_path", path);
      }
      setItems((prev) => prev.filter((i) => i.path !== path));
      setSharedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } catch {
      setNote({
        tone: "danger",
        text: t("evidence.deleteError", "Couldn't delete that file."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title={t("evidence.title", "Evidence Vault")}
        subtitle={t(
          "evidence.intro",
          "Privately store photos, documents and voice notes tied to your case.",
        )}
      />

      <Card
        style={{
          borderColor: colors.primary + "44",
          backgroundColor: colors.primary + "10",
        }}
      >
        <Muted style={{ fontSize: font.small }}>
          {t(
            "evidence.privacy",
            "Files are private to you and encrypted at rest. Nothing is shared unless you choose to — you can share an item with your case team and stop sharing anytime.",
          )}
        </Muted>
      </Card>

      {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}

      <Button
        label={
          busy
            ? t("evidence.working", "Working…")
            : t("evidence.add", "Add photo / document")
        }
        onPress={addPhoto}
        loading={busy}
      />

      <VoiceEvidenceRecorder
        onSaved={async () => {
          setNote({
            tone: "success",
            text: t("voiceEvidence.added", "Voice note saved to your vault."),
          });
          await load();
        }}
      />

      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.lg }}
        />
      ) : items.length === 0 ? (
        <Card>
          <Muted>
            {t(
              "evidence.empty",
              "Your vault is empty. Add a photo to keep it safe.",
            )}
          </Muted>
        </Card>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <Card key={item.path} style={styles.cell}>
              {isAudioFile(item.name) ? (
                <Pressable
                  onPress={() => void togglePlayback(item)}
                  style={[
                    styles.thumb,
                    styles.thumbFallback,
                    styles.audioThumb,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    playingPath === item.path
                      ? t("voiceEvidence.pause", "Stop playback")
                      : t("voiceEvidence.play", "Play voice note")
                  }
                >
                  <Ionicons
                    name={
                      playingPath === item.path ? "stop-circle" : "play-circle"
                    }
                    size={44}
                    color={colors.primary}
                  />
                  <Text style={styles.audioLabel}>
                    {t("voiceEvidence.label", "Voice note")}
                  </Text>
                </Pressable>
              ) : item.signedUrl ? (
                <Image
                  source={{ uri: item.signedUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.docIcon}>📄</Text>
                </View>
              )}
              <View style={styles.cellFooter}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable
                  onPress={() => void remove(item.path)}
                  hitSlop={8}
                  accessibilityLabel={t("evidence.delete", "Delete")}
                >
                  <Text style={styles.delete}>✕</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => void toggleShare(item)}
                disabled={sharingPath === item.path}
                style={[
                  styles.shareBtn,
                  sharedPaths.has(item.path) && styles.shareBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  sharedPaths.has(item.path)
                    ? t("consent.stop", "Stop sharing with case team")
                    : t("consent.share", "Share with case team")
                }
              >
                {sharingPath === item.path ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={
                        sharedPaths.has(item.path)
                          ? "people"
                          : "lock-closed-outline"
                      }
                      size={13}
                      color={
                        sharedPaths.has(item.path)
                          ? colors.success
                          : colors.textFaint
                      }
                    />
                    <Text
                      style={[
                        styles.shareText,
                        sharedPaths.has(item.path) && styles.shareTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {sharedPaths.has(item.path)
                        ? t("consent.sharedShort", "Shared with team")
                        : t("consent.shareShort", "Share with team")}
                    </Text>
                  </>
                )}
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cell: { width: "47%", padding: spacing.sm },
  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  audioThumb: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  audioLabel: { color: colors.textMuted, fontSize: font.tiny },
  docIcon: { fontSize: 36 },
  cellFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  fileName: { color: colors.textMuted, fontSize: font.tiny, flex: 1 },
  delete: { color: colors.danger, fontWeight: "900", fontSize: font.body },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
  },
  shareBtnActive: {
    borderColor: colors.success + "66",
    backgroundColor: colors.success + "14",
  },
  shareText: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: "700",
  },
  shareTextActive: { color: colors.success },
});
