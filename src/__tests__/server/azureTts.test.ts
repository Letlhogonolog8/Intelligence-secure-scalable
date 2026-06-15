import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTtsConfigured,
  ttsVoiceFor,
  synthesizeSpeech,
} from "../../../server/ai/azureTts";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("ttsVoiceFor", () => {
  it("maps supported languages to Azure neural voices", () => {
    expect(ttsVoiceFor("en")).toBe("en-ZA-LeahNeural");
    expect(ttsVoiceFor("af")).toBe("af-ZA-AdriNeural");
    expect(ttsVoiceFor("zu")).toBe("zu-ZA-ThandoNeural");
    expect(ttsVoiceFor("FR-fr")).toBe("fr-FR-DeniseNeural");
  });

  it("returns null for languages Azure doesn't voice", () => {
    expect(ttsVoiceFor("xh")).toBeNull();
    expect(ttsVoiceFor("nso")).toBeNull();
  });
});

describe("isTtsConfigured", () => {
  it("requires both key and region", () => {
    delete process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_REGION;
    expect(isTtsConfigured()).toBe(false);

    process.env.AZURE_SPEECH_KEY = "k";
    expect(isTtsConfigured()).toBe(false);

    process.env.AZURE_SPEECH_REGION = "southafricanorth";
    expect(isTtsConfigured()).toBe(true);
  });
});

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    process.env.AZURE_SPEECH_KEY = "test-key";
    process.env.AZURE_SPEECH_REGION = "southafricanorth";
  });

  it("returns null when not configured", async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await synthesizeSpeech("hello", "en")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for an unsupported language without calling the API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await synthesizeSpeech("molo", "xh")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts SSML to the regional endpoint and returns base64 mp3", async () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => audio.buffer,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await synthesizeSpeech("She is safe now", "en");

    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe("audio/mpeg");
    expect(result?.audioBase64).toBe(Buffer.from(audio).toString("base64"));

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(
      "https://southafricanorth.tts.speech.microsoft.com/cognitiveservices/v1",
    );
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("test-key");
    expect(init.body).toContain("en-ZA-LeahNeural");
    expect(init.body).toContain("She is safe now");
  });

  it("escapes XML-special characters in the text", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await synthesizeSpeech("Tom & Jerry <test>", "en");
    const [, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(init.body).toContain("Tom &amp; Jerry &lt;test&gt;");
  });

  it("returns null when the provider responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );
    expect(await synthesizeSpeech("hello", "en")).toBeNull();
  });
});
