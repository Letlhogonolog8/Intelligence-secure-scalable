import { File } from "expo-file-system";

import { supabase } from "@/lib/supabase";

const BUCKET = "evidence";

/**
 * Generous enough for a multi-MB recording on a slow connection, but the UI
 * must never sit on "Saving…" indefinitely the way an un-timed request can.
 */
const UPLOAD_TIMEOUT_MS = 90_000;

export class VaultUploadTimeoutError extends Error {
  constructor() {
    super("vault_upload_timeout");
    this.name = "VaultUploadTimeoutError";
  }
}

/**
 * Read a local file as raw bytes. supabase-js storage uploads hang or produce
 * empty objects when handed a React Native Blob (RN's Blob is a native-side
 * reference, not real bytes), so we go through expo-file-system instead and
 * only fall back to fetch().blob() if the File API can't open the URI.
 */
async function readLocalFile(uri: string): Promise<Uint8Array | Blob> {
  try {
    const file = new File(uri);
    const bytes = await file.bytes();
    if (bytes.byteLength > 0) return bytes;
  } catch {
    // fall through to the blob path
  }
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Upload a local file into the survivor's private evidence vault with a hard
 * timeout. Throws VaultUploadTimeoutError when the network stalls; rethrows
 * storage errors otherwise.
 */
export async function uploadToVault(
  path: string,
  uri: string,
  contentType: string,
): Promise<void> {
  const body = await readLocalFile(uri);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new VaultUploadTimeoutError()),
      UPLOAD_TIMEOUT_MS,
    );
  });

  try {
    const { error } = await Promise.race([
      supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType, upsert: false }),
      timeout,
    ]);
    if (error) throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
