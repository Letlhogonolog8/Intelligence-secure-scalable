import {
  fetchVoiceEvidence,
  saveVoiceEvidence,
  translateVoiceEvidence,
} from "@/data/voiceEvidence";

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

type QueryResult = { data: unknown; error: unknown };

const createQueryBuilder = (result: QueryResult) => {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    textSearch: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.textSearch.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
};

const sampleRow = {
  id: "ve-1",
  uploaded_by: "user-1",
  case_reference: "AEG-1001",
  storage_path: "user-1/123-note.m4a",
  file_name: "note.m4a",
  mime_type: "audio/m4a",
  original_text: "Ngicela usizo",
  detected_language: "zu",
  translated_text: "Please help me",
  target_language: "en",
  created_at: "2026-06-12T08:00:00Z",
};

beforeEach(() => {
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
});

describe("fetchVoiceEvidence", () => {
  it("maps rows to camelCase and skips text search for empty input", async () => {
    const builder = createQueryBuilder({ data: [sampleRow], error: null });
    mockFrom.mockReturnValue(builder);

    const entries = await fetchVoiceEvidence("   ");

    expect(mockFrom).toHaveBeenCalledWith("voice_evidence");
    expect(builder.textSearch).not.toHaveBeenCalled();
    expect(entries).toEqual([
      {
        id: "ve-1",
        uploadedBy: "user-1",
        caseReference: "AEG-1001",
        storagePath: "user-1/123-note.m4a",
        fileName: "note.m4a",
        mimeType: "audio/m4a",
        originalText: "Ngicela usizo",
        detectedLanguage: "zu",
        translatedText: "Please help me",
        targetLanguage: "en",
        createdAt: "2026-06-12T08:00:00Z",
      },
    ]);
  });

  it("applies websearch full-text filtering on the generated column", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchVoiceEvidence("  scared house  ");

    expect(builder.textSearch).toHaveBeenCalledWith(
      "search_tsv",
      "scared house",
      { type: "websearch", config: "simple" },
    );
  });

  it("throws when the query fails", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("permission denied"),
    });
    mockFrom.mockReturnValue(builder);

    await expect(fetchVoiceEvidence("")).rejects.toThrow("permission denied");
  });
});

describe("saveVoiceEvidence", () => {
  const file = new File(["audio-bytes"], "note 1.m4a", { type: "audio/m4a" });

  it("uploads audio then inserts the transcript row", async () => {
    const upload = vi.fn(async () => ({ data: { path: "p" }, error: null }));
    const remove = vi.fn(async () => ({ data: null, error: null }));
    mockStorageFrom.mockReturnValue({ upload, remove });
    const builder = createQueryBuilder({ data: sampleRow, error: null });
    mockFrom.mockReturnValue(builder);

    const entry = await saveVoiceEvidence("user-1", {
      file,
      caseReference: " AEG-1001 ",
      originalText: "Ngicela usizo",
      detectedLanguage: "zu",
      translatedText: "Please help me",
      targetLanguage: "en",
    });

    expect(mockStorageFrom).toHaveBeenCalledWith("voice-evidence");
    expect(upload).toHaveBeenCalledTimes(1);
    const [path] = upload.mock.calls[0] as unknown as [string];
    expect(path).toMatch(/^user-1\/\d+-note_1.m4a$/);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        uploaded_by: "user-1",
        case_reference: "AEG-1001",
        original_text: "Ngicela usizo",
        translated_text: "Please help me",
        target_language: "en",
      }),
    );
    expect(remove).not.toHaveBeenCalled();
    expect(entry.id).toBe("ve-1");
  });

  it("removes the uploaded audio when the row insert fails", async () => {
    const upload = vi.fn(async () => ({ data: { path: "p" }, error: null }));
    const remove = vi.fn(async () => ({ data: null, error: null }));
    mockStorageFrom.mockReturnValue({ upload, remove });
    const builder = createQueryBuilder({
      data: null,
      error: new Error("rls violation"),
    });
    mockFrom.mockReturnValue(builder);

    await expect(
      saveVoiceEvidence("user-1", {
        file,
        originalText: "text",
        detectedLanguage: null,
        translatedText: "text",
        targetLanguage: "en",
      }),
    ).rejects.toThrow("rls violation");

    expect(remove).toHaveBeenCalledTimes(1);
    const [paths] = remove.mock.calls[0] as unknown as [string[]];
    expect(paths[0]).toMatch(/^user-1\//);
  });
});

describe("translateVoiceEvidence", () => {
  const entry = {
    id: "ve-1",
    originalText: "Ngicela usizo",
    detectedLanguage: "zu",
    translatedText: "Please help me",
    targetLanguage: "en",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the original transcript when it is already in the viewer language", async () => {
    const text = await translateVoiceEvidence("user-1", entry, "zu");
    expect(text).toBe("Ngicela usizo");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the stored translation when it matches the viewer language", async () => {
    const text = await translateVoiceEvidence("user-1", entry, "en");
    expect(text).toBe("Please help me");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("serves the shared per-language cache without calling the API", async () => {
    const builder = createQueryBuilder({
      data: { translated_text: "Aidez-moi s'il vous plaît" },
      error: null,
    });
    mockFrom.mockReturnValue(builder);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const text = await translateVoiceEvidence("user-1", entry, "fr");

    expect(text).toBe("Aidez-moi s'il vous plaît");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the translate API on cache miss and caches the result", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translatedText: "Aidez-moi s'il vous plaît" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const text = await translateVoiceEvidence("user-1", entry, "fr");

    expect(text).toBe("Aidez-moi s'il vous plaît");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toMatch(/\/ai\/translate$/);
    expect(JSON.parse(init.body)).toEqual({
      text: "Ngicela usizo",
      target: "fr",
    });
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_id: "ve-1",
        language: "fr",
        translated_text: "Aidez-moi s'il vous plaît",
        translated_by: "user-1",
      }),
    );
  });
});
