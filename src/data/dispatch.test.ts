import {
  createDispatch,
  fetchDispatchUnits,
  nextDispatchStatus,
  updateDispatchStatus,
} from "@/data/dispatch";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

beforeEach(() => mockFrom.mockReset());

describe("nextDispatchStatus", () => {
  it("advances through the lifecycle and stops at completed", () => {
    expect(nextDispatchStatus("assigned")).toBe("en_route");
    expect(nextDispatchStatus("en_route")).toBe("on_scene");
    expect(nextDispatchStatus("on_scene")).toBe("completed");
    expect(nextDispatchStatus("completed")).toBeNull();
    expect(nextDispatchStatus("bogus")).toBeNull();
  });
});

describe("fetchDispatchUnits", () => {
  it("maps unit rows to camelCase", async () => {
    const builder = {
      select: vi.fn(),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "u1",
              unit_code: "G47",
              label: "Unit G47",
              status: "available",
              region: "Gauteng",
              active_officers: 2,
            },
          ],
          error: null,
        }),
      ),
    };
    builder.select.mockReturnValue(builder);
    mockFrom.mockReturnValue(builder);

    const units = await fetchDispatchUnits();
    expect(mockFrom).toHaveBeenCalledWith("dispatch_units");
    expect(units[0]).toEqual({
      id: "u1",
      unitCode: "G47",
      label: "Unit G47",
      status: "available",
      region: "Gauteng",
      activeOfficers: 2,
    });
  });
});

describe("createDispatch", () => {
  it("inserts a dispatch and marks the unit en route", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const update = vi.fn(() => ({ eq }));
    mockFrom.mockImplementation((table: string) =>
      table === "dispatches" ? { insert } : { update },
    );

    await createDispatch({
      createdBy: "officer-1",
      unitId: "u1",
      caseReference: "AEG-9",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: "officer-1",
        unit_id: "u1",
        case_reference: "AEG-9",
        status: "assigned",
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "en_route" }),
    );
  });

  it("rejects without a creator", async () => {
    await expect(createDispatch({ createdBy: "" })).rejects.toThrow(
      "Not signed in",
    );
  });
});

describe("updateDispatchStatus", () => {
  it("frees the unit when completed", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const update = vi.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ update });

    await updateDispatchStatus("d1", "completed", "u1");

    // once for the dispatch, once to free the unit
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "available" }),
    );
  });
});
