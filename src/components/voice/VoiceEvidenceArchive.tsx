import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Archive,
  FileAudio,
  Languages,
  Loader2,
  Play,
  Search,
  Trash2,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/dashboard/DashboardPrimitives";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import {
  canSpeak,
  fetchServerTts,
  speakText,
  stopSpeaking,
} from "@/lib/speech";
import {
  createVoiceEvidenceAudioUrl,
  deleteVoiceEvidence,
  translateVoiceEvidence,
  useVoiceEvidence,
  VOICE_EVIDENCE_QUERY_KEY,
  type VoiceEvidenceEntry,
} from "@/data/voiceEvidence";
import { languageLabel } from "@/components/voice/voiceLanguages";
import { formatRelativeDateTime } from "@/lib/dashboardMetrics";

/**
 * Voice evidence archive for responder dashboards.
 *
 * Lists survivor voice notes persisted via the translator's "Save to archive"
 * action: original transcript, translation, detected/target languages, and an
 * optional case reference. Transcripts are full-text searchable (server-side
 * via the table's generated tsvector column), and the original audio plays
 * back through short-lived signed URLs from the private bucket.
 */

const VoiceEvidenceArchive: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useVoiceEvidence(deferredSearch);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [viewerTranslations, setViewerTranslations] = useState<
    Record<string, { language: string; text: string }>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpoken = () => {
    stopSpeaking();
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
  };

  // The viewer's UI language is their synced preferred language (item 4),
  // so "my language" is whatever the portal is currently displayed in.
  const viewerLanguage =
    (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] || "en";

  // Realtime: refresh the archive the moment any responder saves a note —
  // dashboards must never need a manual refresh.
  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("voice-evidence-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_evidence" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: VOICE_EVIDENCE_QUERY_KEY,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => () => stopSpoken(), []);

  const translateForViewer = async (entry: VoiceEvidenceEntry) => {
    if (!user?.id || translatingId) return;
    setActionError(null);
    setTranslatingId(entry.id);
    try {
      const text = await translateVoiceEvidence(user.id, entry, viewerLanguage);
      setViewerTranslations((prev) => ({
        ...prev,
        [entry.id]: { language: viewerLanguage, text },
      }));
    } catch {
      setActionError(
        "Couldn't translate that note right now. Please try again shortly.",
      );
    } finally {
      setTranslatingId(null);
    }
  };

  const speakEntry = async (entry: VoiceEvidenceEntry) => {
    if (speakingId === entry.id) {
      stopSpoken();
      setSpeakingId(null);
      return;
    }
    const viewer = viewerTranslations[entry.id];
    const text =
      viewer?.text ??
      (entry.targetLanguage === viewerLanguage && entry.translatedText
        ? entry.translatedText
        : entry.originalText);
    const language = viewer
      ? viewer.language
      : entry.targetLanguage === viewerLanguage && entry.translatedText
        ? viewerLanguage
        : (entry.detectedLanguage ?? viewerLanguage);

    stopSpoken();
    setSpeakingId(entry.id);

    // Prefer server-side Azure neural audio; fall back to the device voice.
    const dataUrl = await fetchServerTts(text, language);
    if (dataUrl) {
      const audio = new Audio(dataUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);
      void audio.play();
      return;
    }

    if (!speakText(text, language, () => setSpeakingId(null))) {
      setSpeakingId(null);
    }
  };

  const playEntry = async (entry: VoiceEvidenceEntry) => {
    setActionError(null);
    setPlayingId(entry.id);
    try {
      const url = await createVoiceEvidenceAudioUrl(entry.storagePath);
      if (!url) throw new Error("no signed url");
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      await audio.play();
    } catch {
      setPlayingId(null);
      setActionError("Couldn't play that recording. Please try again.");
    }
  };

  const removeEntry = async (entry: VoiceEvidenceEntry) => {
    setActionError(null);
    setDeletingId(entry.id);
    try {
      await deleteVoiceEvidence(entry);
      void queryClient.invalidateQueries({
        queryKey: VOICE_EVIDENCE_QUERY_KEY,
      });
    } catch {
      setActionError("Couldn't delete that entry. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <GlassPanel
      className={className}
      icon={<Archive className="h-4 w-4 text-purple-400" />}
      title="Voice evidence archive"
      subtitle="Saved survivor voice notes with searchable transcripts and translations"
      action={
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transcripts or case refs…"
            aria-label="Search voice evidence transcripts"
            className="h-9 border-white/10 bg-slate-950/70 pl-8 text-xs text-white"
          />
        </div>
      }
    >
      {actionError && (
        <p className="mb-3 text-xs font-medium text-rose-400">{actionError}</p>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading archived voice
          evidence…
        </p>
      ) : isError ? (
        <p className="py-6 text-xs font-medium text-rose-400">
          Couldn't load the voice evidence archive. Please refresh shortly.
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-xs text-slate-400">
          {search.trim()
            ? "No archived voice notes match that search."
            : "No voice evidence archived yet. Translate a survivor voice note above and save it to the archive."}
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-white/10 bg-slate-950/50 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <FileAudio className="h-3.5 w-3.5 text-purple-400" />
                  {entry.fileName ?? "Voice note"} ·{" "}
                  {formatRelativeDateTime(entry.createdAt)}
                  {entry.caseReference && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-purple-300">
                      Case {entry.caseReference}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void playEntry(entry)}
                    disabled={playingId === entry.id}
                    className="h-8 border-white/10 bg-white/5 text-[11px] font-bold"
                  >
                    {playingId === entry.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Play original
                  </Button>
                  {viewerTranslations[entry.id]?.language !== viewerLanguage &&
                    entry.detectedLanguage !== viewerLanguage &&
                    !(
                      entry.targetLanguage === viewerLanguage &&
                      entry.translatedText
                    ) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void translateForViewer(entry)}
                        disabled={translatingId === entry.id}
                        className="h-8 border-purple-500/25 bg-purple-500/10 text-[11px] font-bold text-purple-200 hover:bg-purple-500/20"
                      >
                        {translatingId === entry.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Languages className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {languageLabel(viewerLanguage)}
                      </Button>
                    )}
                  {canSpeak() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void speakEntry(entry)}
                      aria-label={
                        speakingId === entry.id
                          ? "Stop spoken playback"
                          : "Listen in your language"
                      }
                      className="h-8 border-white/10 bg-white/5 text-[11px] font-bold"
                    >
                      <Volume2
                        className={`h-3.5 w-3.5 ${speakingId === entry.id ? "animate-pulse text-purple-300" : ""}`}
                      />
                    </Button>
                  )}
                  {user?.id === entry.uploadedBy && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void removeEntry(entry)}
                      disabled={deletingId === entry.id}
                      aria-label="Delete voice evidence"
                      className="h-8 border-red-500/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Original · {languageLabel(entry.detectedLanguage)}
              </p>
              <p className="mb-2 text-sm leading-relaxed text-slate-200">
                {entry.originalText}
              </p>
              {entry.translatedText &&
                entry.translatedText !== entry.originalText && (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                      Translation · {languageLabel(entry.targetLanguage)}
                    </p>
                    <p className="text-sm leading-relaxed text-white">
                      {entry.translatedText}
                    </p>
                  </>
                )}
              {viewerTranslations[entry.id] &&
                viewerTranslations[entry.id].language !==
                  entry.targetLanguage && (
                  <div className="mt-2 rounded-md border border-purple-500/25 bg-purple-500/10 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                      Your language ·{" "}
                      {languageLabel(viewerTranslations[entry.id].language)}
                    </p>
                    <p className="text-sm leading-relaxed text-white">
                      {viewerTranslations[entry.id].text}
                    </p>
                  </div>
                )}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
};

export default VoiceEvidenceArchive;
