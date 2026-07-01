import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Case evidence register (responder-uploaded). Files live in the private
 * `case-evidence` bucket (namespaced by uploader id); metadata in
 * public.case_evidence. RLS restricts everything to approved responders.
 * See migration 20260701140000_case_evidence.sql.
 */

export interface CaseEvidenceEntry {
  id: string;
  caseReference: string | null;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  evidenceType: string | null;
  note: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export const CASE_EVIDENCE_QUERY_KEY = ["aegis", "caseEvidence"] as const;

const CASE_EVIDENCE_BUCKET = "case-evidence";

const CASE_EVIDENCE_COLUMNS =
  "id,case_reference,storage_path,file_name,mime_type,evidence_type,note,uploaded_by,created_at";

type CaseEvidenceRow = {
  id: string;
  case_reference: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  evidence_type: string | null;
  note: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const mapRow = (row: CaseEvidenceRow): CaseEvidenceEntry => ({
  id: row.id,
  caseReference: row.case_reference,
  storagePath: row.storage_path,
  fileName: row.file_name,
  mimeType: row.mime_type,
  evidenceType: row.evidence_type,
  note: row.note,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
});

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"];
const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "wav", "3gp", "caf", "ogg"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "avi", "mkv", "3gp"];

export type CaseEvidenceKind = "image" | "audio" | "video" | "document";

/** Media kind from the mime type, falling back to the file extension. */
export function caseEvidenceKind(
  entry: Pick<CaseEvidenceEntry, "fileName" | "mimeType">,
): CaseEvidenceKind {
  const mime = entry.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  const ext = entry.fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "document";
}

export async function fetchCaseEvidence(
  limit = 200,
): Promise<CaseEvidenceEntry[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("case_evidence")
    .select(CASE_EVIDENCE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as CaseEvidenceRow));
}

export async function uploadCaseEvidence(input: {
  file: File;
  uploaderId: string;
  caseReference?: string | null;
  note?: string | null;
}): Promise<CaseEvidenceEntry> {
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${input.uploaderId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CASE_EVIDENCE_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const kind = caseEvidenceKind({
    fileName: input.file.name,
    mimeType: input.file.type,
  });

  const { data, error } = await supabase
    .from("case_evidence")
    .insert({
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      evidence_type: kind,
      case_reference: input.caseReference?.trim() || null,
      note: input.note?.trim() || null,
      uploaded_by: input.uploaderId,
    })
    .select(CASE_EVIDENCE_COLUMNS)
    .single();
  if (error) throw error;
  return mapRow(data as CaseEvidenceRow);
}

/** Mint a short-lived signed URL for a case-evidence file. */
export async function createCaseEvidenceUrl(
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CASE_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export const useCaseEvidence = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: CASE_EVIDENCE_QUERY_KEY,
    queryFn: () => fetchCaseEvidence(),
    enabled: hasSupabase && (options?.enabled ?? true),
    staleTime: 15000,
  });
