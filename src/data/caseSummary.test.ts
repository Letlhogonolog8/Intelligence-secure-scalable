import { summarizeCase, SEVERITY_TONE } from "@/data/caseSummary";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("summarizeCase", () => {
  it("posts case text to the endpoint and returns the parsed result", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        summary: "A survivor reports repeated threats from an ex-partner.",
        severity: "high",
        recommendedActions: ["Assign an officer", "Arrange a safety plan"],
      }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await summarizeCase(
      "Ex-partner threatened her again",
      "ctx",
    );

    expect(result.severity).toBe("high");
    expect(result.recommendedActions).toHaveLength(2);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toMatch(/\/ai\/case-summary$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      text: "Ex-partner threatened her again",
      context: "ctx",
    });
  });

  it("defaults severity to medium and actions to [] when omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ summary: "Brief incident note." }),
      })),
    );

    const result = await summarizeCase("Something happened");
    expect(result.severity).toBe("medium");
    expect(result.recommendedActions).toEqual([]);
  });

  it("throws when the endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(summarizeCase("x y z text")).rejects.toThrow(
      "case_summary_failed_503",
    );
  });

  it("throws when the summary is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ severity: "low" }),
      })),
    );
    await expect(summarizeCase("x y z text")).rejects.toThrow(
      "case_summary_empty",
    );
  });

  it("maps severities to status-pill tones", () => {
    expect(SEVERITY_TONE.low).toBe("emerald");
    expect(SEVERITY_TONE.medium).toBe("amber");
    expect(SEVERITY_TONE.high).toBe("rose");
    expect(SEVERITY_TONE.critical).toBe("rose");
  });
});
