import {
  fetchSharedEvidence,
  sharedEvidenceKind,
  createSharedEvidenceUrl,
} from "@/data/sharedEvidence";

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
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  builder.select.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

const sampleRow = {
  id: "ec-1",
  survivor_id: "11111111-2222-3333-4444-555555555555",
  storage_path: "11111111-2222-3333-4444-555555555555/1700000000-photo.jpg",
  file_name: "1700000000-photo.jpg",
  mime_type: null,
  note: "Bruising from last night",
  granted_at: "2026-06-14T08:00:00Z",
};

beforeEach(() => {
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
});

describe("fetchSharedEvidence", () => {
  it("returns only active consents mapped to camelCase", async () => {
    const builder = createQueryBuilder({ data: [sampleRow], error: null });
    mockFrom.mockReturnValue(builder);

    const entries = await fetchSharedEvidence();

    expect(mockFrom).toHaveBeenCalledWith("evidence_consents");
    // Active-only filter: revoked_at IS NULL.
    expect(builder.is).toHaveBeenCalledWith("revoked_at", null);
    expect(entries).toEqual([
      {
        id: "ec-1",
        survivorId: "11111111-2222-3333-4444-555555555555",
        storagePath:
          "11111111-2222-3333-4444-555555555555/1700000000-photo.jpg",
        fileName: "1700000000-photo.jpg",
        mimeType: null,
        note: "Bruising from last night",
        grantedAt: "2026-06-14T08:00:00Z",
      },
    ]);
  });

  it("throws when the query fails", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: new Error("permission denied"),
    });
    mockFrom.mockReturnValue(builder);

    await expect(fetchSharedEvidence()).rejects.toThrow("permission denied");
  });
});

describe("createSharedEvidenceUrl", () => {
  it("returns a signed URL from the evidence bucket", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed/url" },
      error: null,
    }));
    mockStorageFrom.mockReturnValue({ createSignedUrl });

    const url = await createSharedEvidenceUrl("uid/file.jpg");

    expect(mockStorageFrom).toHaveBeenCalledWith("evidence");
    expect(createSignedUrl).toHaveBeenCalledWith("uid/file.jpg", 3600);
    expect(url).toBe("https://signed/url");
  });

  it("returns null when signing fails", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: null,
      error: new Error("not found"),
    }));
    mockStorageFrom.mockReturnValue({ createSignedUrl });

    expect(await createSharedEvidenceUrl("uid/missing.jpg")).toBeNull();
  });
});

describe("sharedEvidenceKind", () => {
  it("classifies by mime type first", () => {
    expect(
      sharedEvidenceKind({ fileName: "x.bin", mimeType: "image/png" }),
    ).toBe("image");
    expect(
      sharedEvidenceKind({ fileName: "x.bin", mimeType: "audio/mpeg" }),
    ).toBe("audio");
  });

  it("falls back to the file extension", () => {
    expect(sharedEvidenceKind({ fileName: "photo.JPG", mimeType: null })).toBe(
      "image",
    );
    expect(sharedEvidenceKind({ fileName: "note.m4a", mimeType: null })).toBe(
      "audio",
    );
    expect(
      sharedEvidenceKind({ fileName: "statement.pdf", mimeType: null }),
    ).toBe("document");
    expect(sharedEvidenceKind({ fileName: null, mimeType: null })).toBe(
      "document",
    );
  });
});
