import {
  fetchSecureConversations,
  fetchSecureMessages,
  isConversationUnread,
  sendSecureMessage,
  startSecureConversation,
  type SecureConversation,
} from "@/data/secureMessages";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/env", () => ({ hasSupabase: true }));

type QueryResult = { data: unknown; error: unknown };

const listBuilder = (result: QueryResult) => {
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
  mockRpc.mockReset();
});

describe("fetchSecureConversations", () => {
  it("stitches participants onto their conversations", async () => {
    const conversationBuilder = listBuilder({
      data: [
        {
          id: "conv-1",
          subject: "Case handoff",
          case_id: "AEG-123",
          created_by: "user-a",
          created_at: "2026-07-01T09:00:00Z",
          last_message_at: "2026-07-01T10:00:00Z",
        },
      ],
      error: null,
    });
    const participantBuilder = listBuilder({
      data: [
        {
          conversation_id: "conv-1",
          user_id: "user-a",
          role: "police",
          last_read_at: "2026-07-01T09:30:00Z",
        },
        {
          conversation_id: "conv-1",
          user_id: "user-b",
          role: "ngo",
          last_read_at: "2026-07-01T09:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(conversationBuilder)
      .mockReturnValueOnce(participantBuilder);

    const result = await fetchSecureConversations();

    expect(mockFrom).toHaveBeenNthCalledWith(1, "secure_conversations");
    expect(mockFrom).toHaveBeenNthCalledWith(
      2,
      "secure_conversation_participants",
    );
    expect(participantBuilder.in).toHaveBeenCalledWith("conversation_id", [
      "conv-1",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "conv-1",
      subject: "Case handoff",
      caseId: "AEG-123",
      lastMessageAt: "2026-07-01T10:00:00Z",
    });
    expect(result[0].participants).toEqual([
      { userId: "user-a", role: "police", lastReadAt: "2026-07-01T09:30:00Z" },
      { userId: "user-b", role: "ngo", lastReadAt: "2026-07-01T09:00:00Z" },
    ]);
  });

  it("returns an empty list without a second query when there are no conversations", async () => {
    mockFrom.mockReturnValueOnce(listBuilder({ data: [], error: null }));
    const result = await fetchSecureConversations();
    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("fetchSecureMessages", () => {
  it("filters to the conversation and maps rows in order", async () => {
    const builder = listBuilder({
      data: [
        {
          id: "m-1",
          conversation_id: "conv-1",
          sender_id: "user-a",
          sender_role: "police",
          body: "On my way",
          created_at: "2026-07-01T10:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const result = await fetchSecureMessages("conv-1");

    expect(mockFrom).toHaveBeenCalledWith("secure_messages");
    expect(builder.eq).toHaveBeenCalledWith("conversation_id", "conv-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(result).toEqual([
      {
        id: "m-1",
        conversationId: "conv-1",
        senderId: "user-a",
        senderRole: "police",
        body: "On my way",
        createdAt: "2026-07-01T10:00:00Z",
      },
    ]);
  });
});

describe("sendSecureMessage", () => {
  it("rejects an empty body before touching the network", async () => {
    await expect(
      sendSecureMessage({ conversationId: "c", senderId: "u", body: "   " }),
    ).rejects.toThrow("Message is empty");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("startSecureConversation", () => {
  it("calls the RPC with subject, case and participants", async () => {
    mockRpc.mockResolvedValue({ data: "conv-new", error: null });

    const id = await startSecureConversation({
      subject: "Welfare check",
      caseId: "AEG-9",
      participantIds: ["user-b", "user-c"],
    });

    expect(mockRpc).toHaveBeenCalledWith("start_secure_conversation", {
      p_subject: "Welfare check",
      p_case_id: "AEG-9",
      p_participants: ["user-b", "user-c"],
    });
    expect(id).toBe("conv-new");
  });
});

describe("isConversationUnread", () => {
  const base: SecureConversation = {
    id: "c",
    subject: null,
    caseId: null,
    createdBy: "user-a",
    createdAt: "2026-07-01T09:00:00Z",
    lastMessageAt: "2026-07-01T10:00:00Z",
    participants: [
      { userId: "user-a", role: "police", lastReadAt: "2026-07-01T09:30:00Z" },
    ],
  };

  it("is unread when the last message is newer than the viewer's last read", () => {
    expect(isConversationUnread(base, "user-a")).toBe(true);
  });

  it("is read when the viewer has read past the last message", () => {
    const read = {
      ...base,
      participants: [
        {
          userId: "user-a",
          role: "police",
          lastReadAt: "2026-07-01T10:30:00Z",
        },
      ],
    };
    expect(isConversationUnread(read, "user-a")).toBe(false);
  });

  it("is not unread for a non-participant", () => {
    expect(isConversationUnread(base, "stranger")).toBe(false);
  });
});
