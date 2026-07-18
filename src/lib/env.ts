import { z } from "zod";

type RawEnv = Record<string, string | undefined>;

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("https://") ||
        value.startsWith("http://localhost") ||
        value.startsWith("http://127.0.0.1"),
      {
        message:
          "VITE_SUPABASE_URL must use https:// (or a localhost URL for development)",
      },
    )
    .optional(),
  VITE_SUPABASE_KEY: z.string().min(1).optional(),
  VITE_API_URL: z
    .string()
    .refine(
      (value) =>
        value.startsWith("/") ||
        value.startsWith("https://") ||
        value.startsWith("http://localhost") ||
        value.startsWith("http://127.0.0.1"),
      {
        message:
          "VITE_API_URL must be a same-origin path (e.g. /api), https:// URL, or a localhost URL",
      },
    )
    .optional(),
  VITE_LOG_ENDPOINT: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("https://") ||
        value.startsWith("http://localhost") ||
        value.startsWith("http://127.0.0.1"),
      {
        message:
          "VITE_LOG_ENDPOINT must use https:// (or http://localhost for development)",
      },
    )
    .optional(),
  VITE_LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  VITE_DATADOG_LOGS_ENDPOINT: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "VITE_DATADOG_LOGS_ENDPOINT must use https://",
    })
    .optional(),
  VITE_DATADOG_SERVICE: z.string().min(1).optional(),
  VITE_DATADOG_ENV: z.string().min(1).optional(),
  VITE_DATADOG_VERSION: z.string().min(1).optional(),
  // Where survivors get the dedicated mobile app. Shown on the web portal when a
  // survivor signs in (the web portal is for professional roles only).
  VITE_MOBILE_APP_URL: z.string().min(1).optional(),
});

type ParsedEnv = z.infer<typeof envSchema>;

type ParseEnvResult = {
  env: ParsedEnv;
  hasSupabase: boolean;
};

/**
 * A variable declared in .env but left blank (e.g. `VITE_MOBILE_APP_URL=`,
 * common for genuinely-optional config) comes through import.meta.env as an
 * empty string, not undefined — every field below is `.optional()`, which
 * only permits `undefined`, so a blank-but-present value fails validation
 * exactly like a malformed one. Normalize blank strings to undefined first
 * so "not set" and "set to nothing" behave identically.
 */
function blankToUndefined(raw: RawEnv): RawEnv {
  const normalized: RawEnv = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = value === "" ? undefined : value;
  }
  return normalized;
}

export const parseEnv = (raw: RawEnv): ParseEnvResult => {
  const parsed = envSchema.safeParse(blankToUndefined(raw));
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
  }

  const { VITE_SUPABASE_URL, VITE_SUPABASE_KEY } = parsed.data;
  if (VITE_SUPABASE_URL && !VITE_SUPABASE_KEY) {
    throw new Error("Invalid environment variables: VITE_SUPABASE_KEY");
  }
  if (!VITE_SUPABASE_URL && VITE_SUPABASE_KEY) {
    throw new Error("Invalid environment variables: VITE_SUPABASE_URL");
  }

  return {
    env: parsed.data,
    hasSupabase: Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_KEY),
  };
};

const parsed = parseEnv(import.meta.env as RawEnv);

export const env = parsed.env;
export const hasSupabase = parsed.hasSupabase;
