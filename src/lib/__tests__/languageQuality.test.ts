import { describe, expect, it } from "vitest";
import {
  getFallbackSupportResponse,
  getGreetingResponse,
  inferLanguageFromMessage,
  isEchoingUserInput,
  isLowQualityResponse,
  isMismatchedLanguageResponse,
  isNearDuplicateResponse,
  normalizeLanguageCode,
} from "../../../supabase/functions/aegis-survivor-chat/languageQuality";

describe("languageQuality", () => {
  it("normalizes a supported language with region suffix", () => {
    expect(normalizeLanguageCode("tn-ZA")).toBe("tn");
  });

  it("falls back to english for unsupported language codes", () => {
    expect(normalizeLanguageCode("de")).toBe("en");
  });

  it("infers Setswana from common Setswana greeting", () => {
    expect(inferLanguageFromMessage("Dumela, o kae?")).toBe("tn");
  });

  it("infers isiZulu from common isiZulu greeting", () => {
    expect(inferLanguageFromMessage("Sawubona ngicela usizo")).toBe("zu");
  });

  it("returns Setswana greeting response for tn", () => {
    expect(getGreetingResponse("tn").toLowerCase()).toContain("dumela");
  });

  it("marks heavily repetitive text as low quality", () => {
    const repetitive = "ke a leboga ka go tsenya ke a leboga ka go tsenya ke a leboga ka go tsenya ke a leboga ka go tsenya";
    expect(isLowQualityResponse(repetitive)).toBe(true);
  });

  it("keeps meaningful text as not low quality", () => {
    const meaningful = "Ke a leboga ka go bua le nna. Re ka simolola ka kgato e le nngwe e e sireletsegileng jaanong.";
    expect(isLowQualityResponse(meaningful)).toBe(false);
  });

  it("detects language mismatch when response is mostly English for Setswana", () => {
    const english = "Thank you for sharing and please tell me what happened so I can help you with this safely now.";
    expect(isMismatchedLanguageResponse(english, "tn")).toBe(true);
  });

  it("does not flag language mismatch when Setswana markers are present", () => {
    const setswana = "Ke a leboga gore o buile le nna, mme re ka tsaya dikgato tsa polokego mmogo gompieno.";
    expect(isMismatchedLanguageResponse(setswana, "tn")).toBe(false);
  });

  it("returns supportive Setswana fallback without echoing the user message", () => {
    const fallback = getFallbackSupportResponse("tn", "low", "Ke kopa thuso ya maikutlo");
    expect(fallback).toContain("Ke a leboga go bua le nna");
    expect(fallback).not.toContain("Ke kopa thuso ya maikutlo");
  });

  it("returns critical fallback for critical risk", () => {
    const fallback = getFallbackSupportResponse("tn", "critical", "Ke kopa thuso");
    expect(fallback).toContain("Polokego ya gago e botlhokwa");
  });

  it("detects exact duplicate responses", () => {
    const response = "Ke a leboga go bua le nna, ke tla go thusa ka dikgato tse di sireletsegileng.";
    expect(isNearDuplicateResponse(response, response)).toBe(true);
  });

  it("does not mark clearly different responses as near duplicates", () => {
    const first = "Ke a go utlwa, a o ka mpolelela se se go tshwenyang thata?";
    const second = "A re dire leano la bosigo jo bo sireletsegileng le motho yo o mo ikanyang.";
    expect(isNearDuplicateResponse(first, second)).toBe(false);
  });

  it("detects verbatim user-input echo in assistant response", () => {
    const user = "Ngicela usizo ngoba ngikhathazekile kakhulu ngiphephe yini";
    const response = "Ngicela usizo ngoba ngikhathazekile kakhulu ngiphephe yini";
    expect(isEchoingUserInput(response, user)).toBe(true);
  });

  it("does not flag non-echo supportive response as user-input echo", () => {
    const user = "Ngicela usizo ngoba ngikhathazekile kakhulu ngiphephe yini";
    const response = "Ngiyakuzwa. Asiqale ngesinyathelo esisodwa sokuphepha ongakwazi ukusenza manje.";
    expect(isEchoingUserInput(response, user)).toBe(false);
  });
});
