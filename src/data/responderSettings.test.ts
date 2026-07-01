import {
  DEFAULT_RESPONDER_SETTINGS,
  fetchResponderSettings,
  saveResponderSettings,
} from "@/data/responderSettings";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

const selectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
};

beforeEach(() => mockFrom.mockReset());

describe("fetchResponderSettings", () => {
  it("maps a saved row to camelCase", async () => {
    mockFrom.mockReturnValue(
      selectBuilder({
        data: {
          critical_push: false,
          case_assignment_push: true,
          audit_visibility: true,
          available: false,
        },
        error: null,
      }),
    );
    const settings = await fetchResponderSettings("user-1");
    expect(mockFrom).toHaveBeenCalledWith("responder_settings");
    expect(settings).toEqual({
      criticalPush: false,
      caseAssignmentPush: true,
      auditVisibility: true,
      available: false,
    });
  });

  it("returns defaults when no row exists", async () => {
    mockFrom.mockReturnValue(selectBuilder({ data: null, error: null }));
    expect(await fetchResponderSettings("user-1")).toEqual(
      DEFAULT_RESPONDER_SETTINGS,
    );
  });
});

describe("saveResponderSettings", () => {
  it("upserts the row keyed by user_id", async () => {
    const upsert = vi.fn((_payload: unknown, _opts: unknown) =>
      Promise.resolve({ error: null }),
    );
    mockFrom.mockReturnValue({ upsert });

    await saveResponderSettings("user-1", {
      criticalPush: true,
      caseAssignmentPush: false,
      auditVisibility: true,
      available: false,
    });

    expect(mockFrom).toHaveBeenCalledWith("responder_settings");
    const [payload, opts] = upsert.mock.calls[0];
    expect(payload).toMatchObject({
      user_id: "user-1",
      critical_push: true,
      case_assignment_push: false,
      available: false,
    });
    expect(opts).toEqual({ onConflict: "user_id" });
  });

  it("rejects without a user id", async () => {
    await expect(
      saveResponderSettings("", DEFAULT_RESPONDER_SETTINGS),
    ).rejects.toThrow("Not signed in");
  });
});
