import {
  createHandoff,
  updateHandoffStatus,
  nextHandoffStatus,
  HANDOFF_STATUS_TONE,
} from "@/data/coordination";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

type Result = { error: unknown };

function makeInsertBuilder(result: Result) {
  return { insert: vi.fn(async () => result) };
}

function makeUpdateBuilder(result: Result) {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(async () => result),
    _patch: null as unknown,
  };
  builder.update = vi.fn((patch: unknown) => {
    builder._patch = patch;
    return builder;
  });
  return builder;
}

beforeEach(() => mockFrom.mockReset());

describe("createHandoff", () => {
  it("inserts a pending handoff with mapped columns", async () => {
    const builder = makeInsertBuilder({ error: null });
    mockFrom.mockReturnValue(builder);

    await createHandoff({
      fromOrganizationId: "org-a",
      toOrganizationId: "org-b",
      caseId: " case-1 ",
      referralType: "shelter",
      notes: "  needs a bed tonight ",
    });

    expect(mockFrom).toHaveBeenCalledWith("organization_coordination");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        from_organization_id: "org-a",
        to_organization_id: "org-b",
        case_id: "case-1",
        referral_type: "shelter",
        notes: "needs a bed tonight",
        status: "pending",
      }),
    );
  });

  it("throws when the insert fails", async () => {
    mockFrom.mockReturnValue(makeInsertBuilder({ error: new Error("rls") }));
    await expect(
      createHandoff({
        fromOrganizationId: "a",
        toOrganizationId: "b",
        caseId: "c",
        referralType: "legal",
      }),
    ).rejects.toThrow("rls");
  });
});

describe("updateHandoffStatus", () => {
  it("sets completed_at when completing", async () => {
    const builder = makeUpdateBuilder({ error: null });
    mockFrom.mockReturnValue(builder);

    await updateHandoffStatus("h1", "completed");

    const patch = builder._patch as Record<string, unknown>;
    expect(patch.status).toBe("completed");
    expect(patch.completed_at).toBeDefined();
    expect(builder.eq).toHaveBeenCalledWith("id", "h1");
  });

  it("does not set completed_at for non-terminal status", async () => {
    const builder = makeUpdateBuilder({ error: null });
    mockFrom.mockReturnValue(builder);

    await updateHandoffStatus("h1", "acknowledged");

    const patch = builder._patch as Record<string, unknown>;
    expect(patch.status).toBe("acknowledged");
    expect(patch.completed_at).toBeUndefined();
  });
});

describe("nextHandoffStatus", () => {
  it("advances through the lifecycle and stops at terminal states", () => {
    expect(nextHandoffStatus("pending")).toBe("acknowledged");
    expect(nextHandoffStatus("acknowledged")).toBe("in_progress");
    expect(nextHandoffStatus("in_progress")).toBe("completed");
    expect(nextHandoffStatus("completed")).toBeNull();
    expect(nextHandoffStatus("declined")).toBeNull();
  });

  it("exposes a tone for each status", () => {
    expect(HANDOFF_STATUS_TONE.pending).toBe("amber");
    expect(HANDOFF_STATUS_TONE.completed).toBe("emerald");
  });
});
