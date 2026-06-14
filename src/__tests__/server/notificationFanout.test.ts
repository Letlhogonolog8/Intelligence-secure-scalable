import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fanOut } from "../../../server/notifications/fanout";

type SelectData = Record<string, unknown[]>;

function makeSupabase(selectData: SelectData) {
  const inserted: Record<string, unknown[]> = {};

  const supabase = {
    from(table: string) {
      return {
        insert: async (rows: unknown) => {
          inserted[table] = (inserted[table] ?? []).concat(rows as unknown[]);
          return { error: null };
        },
        select() {
          const chain: Record<string, unknown> = {
            eq: () => chain,
            in: () => chain,
            not: () => chain,
            returns: async () => ({ data: selectData[table] ?? [] }),
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { supabase, inserted };
}

describe("fanOut", () => {
  it("writes an in-app alert and push rows for each responder device", async () => {
    const { supabase, inserted } = makeSupabase({
      push_tokens: [
        { token: "ExponentPushToken[a]", user_id: "u1" },
        { token: "ExponentPushToken[b]", user_id: "u2" },
      ],
    });

    const result = await fanOut(supabase, {
      eventType: "community_report",
      title: "New community report",
      message: "Witness statement (CR-ABCD2345): incident near the rank",
      module: "police",
      caseId: "CR-ABCD2345",
      channels: { inApp: true, pushResponders: true },
    });

    expect(result.inApp).toBe(true);
    expect(result.push).toBe(2);
    expect(result.email).toBe(0);

    expect(inserted.alerts_feed).toHaveLength(1);
    expect(inserted.notification_queue).toHaveLength(2);
    expect(
      (inserted.notification_queue as Array<{ recipient_type: string }>).every(
        (r) => r.recipient_type === "push",
      ),
    ).toBe(true);
  });

  it("enqueues email rows for responders with addresses", async () => {
    const { supabase, inserted } = makeSupabase({
      user_profiles: [
        { id: "u1", email: "officer@saps.gov.za" },
        { id: "u2", email: "ngo@shelter.org" },
      ],
    });

    const result = await fanOut(supabase, {
      eventType: "community_report",
      title: "New community report",
      message: "On behalf report",
      channels: { emailResponders: true },
    });

    expect(result.email).toBe(2);
    expect(result.inApp).toBe(false);
    expect(
      (inserted.notification_queue as Array<{ recipient_type: string }>).every(
        (r) => r.recipient_type === "email",
      ),
    ).toBe(true);
  });

  it("does nothing for channels that are not requested", async () => {
    const { supabase, inserted } = makeSupabase({});

    const result = await fanOut(supabase, {
      eventType: "community_report",
      title: "t",
      message: "concern only",
      channels: { inApp: true },
    });

    expect(result).toEqual({ inApp: true, push: 0, email: 0 });
    expect(inserted.notification_queue).toBeUndefined();
    expect(inserted.alerts_feed).toHaveLength(1);
  });
});
