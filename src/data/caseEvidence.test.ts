import {
  fetchCaseEvidence,
  caseEvidenceKind,
  createCaseEvidenceUrl,
} from "@/data/caseEvidence";

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
    then: (onFulfilled: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

beforeEach(() => {
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
});

describe("fetchCaseEvidence", () => {
  it("maps rows to camelCase, newest first", async () => {
    const builder = createQueryBuilder({
      data: [
        {
          id: "ce-1",
          case_reference: "AEG-1234",
          storage_path: "uid/171-photo.jpg",
          file_name: "photo.jpg",
          mime_type: "image/jpeg",
          evidence_type: "image",
          note: "scene photo",
          uploaded_by: "uid",
          created_at: "2026-07-01T10:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const entries = await fetchCaseEvidence();

    expect(mockFrom).toHaveBeenCalledWith("case_evidence");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(entries).toEqual([
      {
        id: "ce-1",
        caseReference: "AEG-1234",
        storagePath: "uid/171-photo.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        evidenceType: "image",
        note: "scene photo",
        uploadedBy: "uid",
        createdAt: "2026-07-01T10:00:00Z",
      },
    ]);
  });

  it("throws when the query fails", async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error("denied") }),
    );
    await expect(fetchCaseEvidence()).rejects.toThrow("denied");
  });
});

describe("createCaseEvidenceUrl", () => {
  it("signs from the case-evidence bucket", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed/x" },
      error: null,
    }));
    mockStorageFrom.mockReturnValue({ createSignedUrl });

    const url = await createCaseEvidenceUrl("uid/file.pdf");

    expect(mockStorageFrom).toHaveBeenCalledWith("case-evidence");
    expect(createSignedUrl).toHaveBeenCalledWith("uid/file.pdf", 3600);
    expect(url).toBe("https://signed/x");
  });

  it("returns null on signing failure", async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: vi.fn(async () => ({
        data: null,
        error: new Error("nope"),
      })),
    });
    expect(await createCaseEvidenceUrl("uid/missing.pdf")).toBeNull();
  });
});

describe("caseEvidenceKind", () => {
  it("classifies by mime first, then extension", () => {
    expect(caseEvidenceKind({ fileName: "x", mimeType: "image/png" })).toBe(
      "image",
    );
    expect(caseEvidenceKind({ fileName: "x", mimeType: "video/mp4" })).toBe(
      "video",
    );
    expect(caseEvidenceKind({ fileName: "clip.m4a", mimeType: null })).toBe(
      "audio",
    );
    expect(caseEvidenceKind({ fileName: "report.pdf", mimeType: null })).toBe(
      "document",
    );
    expect(caseEvidenceKind({ fileName: null, mimeType: null })).toBe(
      "document",
    );
  });
});
