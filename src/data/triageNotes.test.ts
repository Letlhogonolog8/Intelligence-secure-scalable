import { addTriageNote, fetchTriageNotes } from "@/data/triageNotes";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

beforeEach(() => mockFrom.mockReset());

describe("fetchTriageNotes", () => {
  it("maps rows newest-first to camelCase", async () => {
    const builder = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "n1",
              note: "Survivor safe with neighbour",
              author_id: "u1",
              author_name: "Baleseng Matlaela",
              created_at: "2026-07-02T09:30:00Z",
            },
          ],
          error: null,
        }),
      ),
    };
    builder.select.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    mockFrom.mockReturnValue(builder);

    const notes = await fetchTriageNotes();
    expect(mockFrom).toHaveBeenCalledWith("triage_notes");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(notes[0]).toEqual({
      id: "n1",
      note: "Survivor safe with neighbour",
      authorId: "u1",
      authorName: "Baleseng Matlaela",
      createdAt: "2026-07-02T09:30:00Z",
    });
  });
});

describe("addTriageNote", () => {
  it("rejects an empty note before any network call", async () => {
    await expect(
      addTriageNote({ note: "   ", authorId: "u1" }),
    ).rejects.toThrow("Triage note is empty");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects without an author", async () => {
    await expect(addTriageNote({ note: "hi", authorId: "" })).rejects.toThrow(
      "Not signed in",
    );
  });

  it("inserts a trimmed note", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue({ insert });
    await addTriageNote({
      note: "  on scene  ",
      authorId: "u1",
      authorName: "B",
    });
    expect(insert).toHaveBeenCalledWith({
      note: "on scene",
      author_id: "u1",
      author_name: "B",
    });
  });
});
