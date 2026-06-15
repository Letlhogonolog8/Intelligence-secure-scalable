import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "@/i18n";

describe("SUPPORTED_LANGUAGES catalog", () => {
  it("covers 50+ languages toward the global-engine spec", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(50);
  });

  it("has unique codes and complete labels", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
      expect(lang.nativeLabel).toBeTruthy();
    }
  });

  it("includes the SA-focused and major world languages", () => {
    const codes = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
    for (const code of ["en", "zu", "af", "xh", "ar", "zh", "es", "fr", "hi"]) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("every code passes the set_preferred_language RPC validation (^[a-z]{2,3}$)", () => {
    // The cross-device sync RPC (migration 20260612130000) rejects codes that
    // don't match this pattern; keep the catalog compatible so any selectable
    // language can be synced.
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2,3}$/);
    }
  });
});
