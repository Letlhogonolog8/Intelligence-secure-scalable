/**
 * Server-side speech-to-text via Hugging Face's hosted Whisper endpoint.
 *
 * HF's shared serverless inference cold-loads the model on first use — it
 * replies 503 with an `estimated_time` while it warms up. The previous
 * implementation had no timeout at all on the outbound call and didn't
 * recognise that response, so a cold start just hung the request until the
 * *mobile client's* abort fired, which read to the survivor as "transcription
 * is broken". This bounds every attempt, rides out one cold-start wait, and
 * always resolves within a predictable budget.
 */

const HF_ROUTER = "https://router.huggingface.co/hf-inference/models";
/** Per-attempt cap — HF is either fast or it isn't; never hang past this. */
const ATTEMPT_TIMEOUT_MS = 30_000;
/** How long we're willing to wait out a reported cold-start before retrying. */
const MAX_COLD_START_WAIT_MS = 15_000;

interface HfLoadingBody {
  error?: string;
  estimated_time?: number;
}

async function callOnce(
  model: string,
  token: string,
  audio: Buffer,
  contentType: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    return await fetch(`${HF_ROUTER}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: audio,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface TranscribeResult {
  text: string;
  /** True when the first attempt hit a cold model load and had to retry. */
  coldStart: boolean;
}

/**
 * Transcribes `audio` via Hugging Face Whisper. Returns `{ text: "" }` when
 * ASR isn't configured or the audio is empty; throws on a genuine HF failure
 * so callers can log it, matching the existing error-handling convention.
 */
export async function transcribeAudio(
  audio: Buffer,
  contentType: string,
): Promise<TranscribeResult> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const model =
    process.env.HUGGINGFACE_ASR_MODEL || "openai/whisper-large-v3-turbo";

  if (
    !token ||
    token.startsWith("[replace") ||
    !Buffer.isBuffer(audio) ||
    audio.length === 0
  ) {
    return { text: "", coldStart: false };
  }

  let response = await callOnce(model, token, audio, contentType);
  let coldStart = false;

  if (response.status === 503) {
    const body = (await response
      .json()
      .catch(() => null)) as HfLoadingBody | null;
    coldStart = true;
    const waitMs = Math.min(
      Math.max((body?.estimated_time ?? 8) * 1000, 1000),
      MAX_COLD_START_WAIT_MS,
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    response = await callOnce(model, token, audio, contentType);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HF ${response.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { text?: string };
  return { text: (payload.text ?? "").trim(), coldStart };
}
