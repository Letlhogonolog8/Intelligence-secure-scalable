import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Voice evidence archive data layer.
 *
 * A responder runs a survivor voice note through the translator
 * (/api/ai/voice-translate) and saves the result here: the original audio
 * goes to the private `voice-evidence` bucket (namespaced by uploader), the
 * transcript + translation go to `public.voice_evidence`. RLS restricts the
 * archive to approved responder roles; transcripts are full-text searchable
 * via the table's generated `search_tsv` column.
 */

export interface VoiceEvidenceEntry {
  id: string;
  uploadedBy: string;
  caseReference: string | null;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  originalText: string;
  detectedLanguage: string | null;
  translatedText: string | null;
  targetLanguage: string | null;
  createdAt: string;
}

export interface SaveVoiceEvidenceInput {
  file: File;
  caseReference?: string | null;
  originalText: string;
  detectedLanguage: string | null;
  translatedText: string;
  targetLanguage: string;
}

export const VOICE_EVIDENCE_QUERY_KEY = ["aegis", "voiceEvidence"] as const;

const VOICE_EVIDENCE_BUCKET = "voice-evidence";

const VOICE_EVIDENCE_COLUMNS =
  "id,uploaded_by,case_reference,storage_path,file_name,mime_type,original_text,detected_language,translated_text,target_language,created_at";

type VoiceEvidenceRow = {
  id: string;
  uploaded_by: string;
  case_reference: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  original_text: string;
  detected_language: string | null;
  translated_text: string | null;
  target_language: string | null;
  created_at: string;
};

const mapRow = (row: VoiceEvidenceRow): VoiceEvidenceEntry => ({
  id: row.id,
  uploadedBy: row.uploaded_by,
  caseReference: row.case_reference,
  storagePath: row.storage_path,
  fileName: row.file_name,
  mimeType: row.mime_type,
  originalText: row.original_text,
  detectedLanguage: row.detected_language,
  translatedText: row.translated_text,
  targetLanguage: row.target_language,
  createdAt: row.created_at,
});

export async function fetchVoiceEvidence(
  search = "",
  limit = 100,
): Promise<VoiceEvidenceEntry[]> {
  let query = supabase
    .from("voice_evidence")
    .select(VOICE_EVIDENCE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  const trimmed = search.trim();
  if (trimmed) {
    // websearch_to_tsquery tolerates free-form input (quotes, dashes, etc.)
    query = query.textSearch("search_tsv", trimmed, {
      type: "websearch",
      config: "simple",
    });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export const useVoiceEvidence = (
  search: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: [...VOICE_EVIDENCE_QUERY_KEY, search.trim()],
    queryFn: () => fetchVoiceEvidence(search),
    enabled: hasSupabase && (options?.enabled ?? true),
    staleTime: 15000,
  });

export async function saveVoiceEvidence(
  userId: string,
  input: SaveVoiceEvidenceInput,
): Promise<VoiceEvidenceEntry> {
  const safeName = (input.file.name || "voice-note")
    .replace(/[^\w.-]+/g, "_")
    .slice(-120);
  const storagePath = `${userId}/${Date.now()}-${safeName}`;

  const upload = await supabase.storage
    .from(VOICE_EVIDENCE_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || "audio/m4a",
      upsert: false,
    });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase
    .from("voice_evidence")
    .insert({
      uploaded_by: userId,
      case_reference: input.caseReference?.trim() || null,
      storage_path: storagePath,
      file_name: input.file.name || null,
      mime_type: input.file.type || null,
      original_text: input.originalText,
      detected_language: input.detectedLanguage,
      translated_text: input.translatedText,
      target_language: input.targetLanguage,
    })
    .select(VOICE_EVIDENCE_COLUMNS)
    .single();

  if (error || !data) {
    // Don't leave an orphaned audio file behind if the row insert failed.
    await supabase.storage
      .from(VOICE_EVIDENCE_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    throw error ?? new Error("Voice evidence insert returned no row");
  }
  return mapRow(data);
}

export async function deleteVoiceEvidence(
  entry: Pick<VoiceEvidenceEntry, "id" | "storagePath">,
): Promise<void> {
  const { error } = await supabase
    .from("voice_evidence")
    .delete()
    .eq("id", entry.id);
  if (error) throw error;
  // Best-effort: RLS only lets the uploader (or an admin in their own folder
  // case) remove the object; a stale file is preferable to a failed delete.
  await supabase.storage
    .from(VOICE_EVIDENCE_BUCKET)
    .remove([entry.storagePath])
    .catch(() => undefined);
}

export async function createVoiceEvidenceAudioUrl(
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VOICE_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Translate an archived note into `language` for the current viewer.
 *
 * Resolution order keeps evidence integrity and avoids duplicate AI calls:
 * 1. the original transcript / stored translation if they already match;
 * 2. the shared per-language cache (voice_evidence_translations);
 * 3. the backend /api/ai/translate pipeline, after which the result is
 *    cached best-effort for every other stakeholder with that language.
 */
export async function translateVoiceEvidence(
  userId: string,
  entry: Pick<
    VoiceEvidenceEntry,
    | "id"
    | "originalText"
    | "detectedLanguage"
    | "translatedText"
    | "targetLanguage"
  >,
  language: string,
): Promise<string> {
  if (entry.detectedLanguage === language) return entry.originalText;
  if (entry.targetLanguage === language && entry.translatedText) {
    return entry.translatedText;
  }

  const cached = await supabase
    .from("voice_evidence_translations")
    .select("translated_text")
    .eq("evidence_id", entry.id)
    .eq("language", language)
    .maybeSingle();
  if (cached.data?.translated_text) return cached.data.translated_text;

  const apiBaseUrl = (
    import.meta.env.VITE_API_URL || "http://localhost:3001/api"
  ).replace(/\/+$/, "");
  const response = await fetch(`${apiBaseUrl}/ai/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: entry.originalText, target: language }),
  });
  if (!response.ok) throw new Error(`translate_failed_${response.status}`);
  const payload = (await response.json()) as { translatedText?: string };
  const translatedText = payload.translatedText?.trim();
  if (!translatedText) throw new Error("translate_empty");

  // Cache for every stakeholder sharing this language; a unique-constraint
  // race or RLS hiccup must never break the translation the viewer already has.
  try {
    await supabase.from("voice_evidence_translations").insert({
      evidence_id: entry.id,
      language,
      translated_text: translatedText,
      translated_by: userId,
    });
  } catch {
    // best-effort cache only
  }

  return translatedText;
}
