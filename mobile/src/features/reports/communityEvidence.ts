import { supabase } from "@/lib/supabase";
import { uploadToBucket } from "@/lib/vaultUpload";

/**
 * Evidence attached to a community/witness report filed on behalf of a
 * survivor. Files land in the shared `case-evidence` bucket and metadata in
 * `public.case_evidence` (linked to the new case via case_id), so responders
 * see them in the web Case Evidence Register — the same place they see their
 * own uploads. Gated by RLS: only the authenticated reporter who filed the
 * community_mobile case can attach, and only to their own storage folder
 * (migration 20260702150000_community_evidence.sql).
 */

const CASE_EVIDENCE_BUCKET = "case-evidence";

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"];
const AUDIO_EXT = ["m4a", "mp3", "aac", "wav", "3gp", "caf", "ogg"];
const VIDEO_EXT = ["mp4", "mov", "webm", "avi", "mkv"];

export interface CommunityEvidenceAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/** Media kind from mime type, falling back to the file extension. */
function evidenceKind(fileName: string, mimeType: string | null): string {
  const mime = mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "document";
}

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

/**
 * Upload each attached asset and register it against the case. Best-effort per
 * file: returns how many attached so the caller can inform the reporter without
 * failing the whole report if one upload stalls.
 */
export async function attachCommunityEvidence(input: {
  caseId: string;
  caseReference: string | null;
  uploaderId: string;
  assets: CommunityEvidenceAsset[];
}): Promise<{ attached: number; failed: number }> {
  let attached = 0;
  let failed = 0;

  for (const asset of input.assets) {
    const fallbackName = asset.uri.split("/").pop() || `evidence-${Date.now()}`;
    const fileName = safe(asset.fileName || fallbackName);
    const mimeType = asset.mimeType ?? null;
    const path = `${input.uploaderId}/community-${input.caseId}-${Date.now()}-${fileName}`;
    try {
      await uploadToBucket(
        CASE_EVIDENCE_BUCKET,
        path,
        asset.uri,
        mimeType ?? "application/octet-stream",
      );
      const { error } = await supabase.from("case_evidence").insert({
        case_id: input.caseId,
        case_reference: input.caseReference,
        storage_path: path,
        file_name: fileName,
        mime_type: mimeType,
        evidence_type: evidenceKind(fileName, mimeType),
        note: "Attached to community report",
        uploaded_by: input.uploaderId,
      });
      if (error) throw error;
      attached += 1;
    } catch {
      failed += 1;
    }
  }

  return { attached, failed };
}
