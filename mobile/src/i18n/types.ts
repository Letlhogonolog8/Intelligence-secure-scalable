import type { en } from "@/i18n/en";

/**
 * A translation bundle has the exact same key structure as English, but every
 * leaf is a plain `string` (English uses `as const` literal types). Typing each
 * locale as `Translations` forces it to be COMPLETE — a missing key is a
 * compile error, which protects safety-critical copy from silently falling back.
 */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Translations = DeepString<typeof en>;
