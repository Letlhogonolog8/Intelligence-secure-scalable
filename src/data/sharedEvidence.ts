import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Shared survivor evidence (responder side of the consent workflow).
 *
 * A survivor opts to share specific evidence-vault items with their case team
 * (see migration 20260614120000 + the mobile evidence screen). Each active
 * consent row grants approved responders read access to that one file in the
 * private `evidence` bucket; revoking removes access immediately. This module
 * lists the active consents and mints short-lived signed URLs on demand.
 */

export interface SharedEvidenceEntry {
  id: string;
  survivorId: string;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  note: string | null;
  grantedAt: string;
}

export const SHARED_EVIDENCE_QUERY_KEY = ["aegis", "sharedEvidence"] as const;

const EVIDENCE_BUCKET = "evidence";

const SHARED_EVIDENCE_COLUMNS =
  "id,survivor_id,storage_path,file_name,mime_type,note,granted_at";

type SharedEvidenceRow = {
  id: string;
  survivor_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  note: string | null;
  granted_at: string;
};

const mapRow = (row: SharedEvidenceRow): SharedEvidenceEntry => ({
  id: row.id,
  survivorId: row.survivor_id,
  storagePath: row.storage_path,
  fileName: row.file_name,
  mimeType: row.mime_type,
  note: row.note,
  grantedAt: row.granted_at,
});

export async function fetchSharedEvidence(
  limit = 100,
): Promise<SharedEvidenceEntry[]> {
  const { data, error } = await supabase
    .from("evidence_consents")
    .select(SHARED_EVIDENCE_COLUMNS)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export const useSharedEvidence = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: SHARED_EVIDENCE_QUERY_KEY,
    queryFn: () => fetchSharedEvidence(),
    enabled: hasSupabase && (options?.enabled ?? true),
    staleTime: 15000,
  });

/** Mint a short-lived signed URL for a consented evidence file. */
export async function createSharedEvidenceUrl(
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"];
const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "wav", "3gp", "caf", "ogg"];

export type SharedEvidenceKind = "image" | "audio" | "document";

/** Best-effort media kind from the file name (mime_type is often null). */
export function sharedEvidenceKind(
  entry: Pick<SharedEvidenceEntry, "fileName" | "mimeType">,
): SharedEvidenceKind {
  const mime = entry.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  const ext = entry.fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  return "document";
}
