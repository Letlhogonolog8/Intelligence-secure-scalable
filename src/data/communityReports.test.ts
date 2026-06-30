import {
  fetchCommunityReports,
  submitCommunityReport,
  trackCommunityReport,
} from "@/data/communityReports";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

type QueryResult = { data: unknown; error: unknown };

const createQueryBuilder = (result: QueryResult) => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

beforeEach(() => {
  mockFrom.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCommunityReports", () => {
  it("filters to community reports and maps rows", async () => {
    const builder = createQueryBuilder({
      data: [
        {
          id: "cr-1",
          public_reference: "CR-ABCD2345",
          description: "Saw an assault near the taxi rank",
          reporter_relationship: "witness",
          category: "Physical violence",
          status: "submitted",
          priority: "medium",
          location: { address: "Soweto" },
          created_at: "2026-06-14T10:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const reports = await fetchCommunityReports();

    expect(mockFrom).toHaveBeenCalledWith("case_reports");
    expect(builder.in).toHaveBeenCalledWith("report_method", [
      "community_web",
      "community_mobile",
    ]);
    expect(reports).toEqual([
      {
        id: "cr-1",
        reference: "CR-ABCD2345",
        description: "Saw an assault near the taxi rank",
        relationship: "witness",
        category: "Physical violence",
        status: "submitted",
        priority: "medium",
        locationText: "Soweto",
        createdAt: "2026-06-14T10:00:00Z",
      },
    ]);
  });

  it("throws on query error", async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error("rls") }),
    );
    await expect(fetchCommunityReports()).rejects.toThrow("rls");
  });
});

describe("submitCommunityReport", () => {
  it("posts to the community endpoint and returns the reference", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ reference: "CR-7Q2K9F4M" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const ref = await submitCommunityReport({
      relationship: "on_behalf",
      description: "My neighbour needs help",
      category: "Other",
      location: "Tembisa",
    });

    expect(ref).toBe("CR-7Q2K9F4M");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toMatch(/\/community\/report$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      relationship: "on_behalf",
      description: "My neighbour needs help",
    });
  });

  it("throws when the server rejects the report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 })),
    );
    await expect(
      submitCommunityReport({ relationship: "witness", description: "x" }),
    ).rejects.toThrow("submit_failed_400");
  });
});

describe("trackCommunityReport", () => {
  it("returns the status payload on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          reference: "CR-7Q2K9F4M",
          status: "submitted",
          category: "Other",
          createdAt: "2026-06-14T10:00:00Z",
          updatedAt: "2026-06-14T10:00:00Z",
        }),
      })),
    );

    const result = await trackCommunityReport("cr-7q2k9f4m");
    expect(result?.reference).toBe("CR-7Q2K9F4M");
    expect(result?.status).toBe("submitted");
  });

  it("returns null when the reference is not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    expect(await trackCommunityReport("CR-NOPE0000")).toBeNull();
  });
});
