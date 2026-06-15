import { renderHook, act } from "@testing-library/react";
import { usePresence } from "@/hooks/usePresence";

let syncHandler: (() => void) | null = null;
let presenceData: Record<string, Array<Record<string, unknown>>> = {};
const track = vi.fn(async () => undefined);
const removeChannel = vi.fn();

const channel = {
  on: (_type: string, _opts: unknown, cb: () => void) => {
    syncHandler = cb;
    return channel;
  },
  subscribe: (cb: (status: string) => void) => {
    cb("SUBSCRIBED");
    return channel;
  },
  track,
  presenceState: () => presenceData,
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: () => channel,
    removeChannel: () => removeChannel(),
  },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

beforeEach(() => {
  syncHandler = null;
  presenceData = {};
  track.mockClear();
  removeChannel.mockClear();
});

describe("usePresence", () => {
  it("tracks the current user on subscribe", () => {
    renderHook(() =>
      usePresence({ userId: "u1", name: "Alice", role: "police" }),
    );
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", name: "Alice", role: "police" }),
    );
  });

  it("maps synced presence state to members, most-recent first", () => {
    presenceData = {
      u1: [
        {
          userId: "u1",
          name: "Alice",
          role: "police",
          onlineAt: "2026-06-15T10:00:00Z",
        },
      ],
      u2: [
        {
          userId: "u2",
          name: "Bob",
          role: "ngo",
          onlineAt: "2026-06-15T11:00:00Z",
        },
      ],
    };
    const { result } = renderHook(() =>
      usePresence({ userId: "u1", name: "Alice", role: "police" }),
    );

    act(() => {
      syncHandler?.();
    });

    expect(result.current.map((m) => m.userId)).toEqual(["u2", "u1"]);
    expect(result.current[0]).toMatchObject({ name: "Bob", role: "ngo" });
  });

  it("stays empty and does not subscribe when there is no user", () => {
    const { result } = renderHook(() => usePresence({ userId: null }));
    expect(result.current).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it("leaves the channel on unmount", () => {
    const { unmount } = renderHook(() =>
      usePresence({ userId: "u1", name: "Alice", role: "police" }),
    );
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});
