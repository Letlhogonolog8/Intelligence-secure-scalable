import {
  acknowledgeEscalation,
  deleteEscalation,
  dispatchEscalation,
  escalateEscalation,
  updateEscalationEvent,
} from "@/data/escalationActions";

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockUpdate.mockReset();
  mockEq.mockReset();
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
});

describe("updateEscalationEvent", () => {
  it("only sends provided columns and targets the row by id", async () => {
    await updateEscalationEvent("esc-1", { status: "dispatched" });
    expect(mockFrom).toHaveBeenCalledWith("escalation_events");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "dispatched" });
    expect(mockEq).toHaveBeenCalledWith("id", "esc-1");
  });

  it("throws when the update fails", async () => {
    mockEq.mockResolvedValue({ error: new Error("denied") });
    await expect(
      updateEscalationEvent("esc-1", { status: "escalated" }),
    ).rejects.toThrow("denied");
  });
});

describe("action helpers", () => {
  it("acknowledge stamps status, actor and timestamp", async () => {
    await acknowledgeEscalation("esc-2", "user-9");
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.status).toBe("acknowledged");
    expect(payload.acknowledged_by).toBe("user-9");
    expect(typeof payload.acknowledged_at).toBe("string");
  });

  it("dispatch sets status and owner", async () => {
    await dispatchEscalation("esc-3", "user-1");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "dispatched",
      acknowledged_by: "user-1",
    });
  });

  it("escalate sets only status", async () => {
    await escalateEscalation("esc-4");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "escalated" });
  });
});

describe("deleteEscalation", () => {
  it("deletes the row by id", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ delete: del });
    await deleteEscalation("esc-5");
    expect(mockFrom).toHaveBeenCalledWith("escalation_events");
    expect(eq).toHaveBeenCalledWith("id", "esc-5");
  });
});
