import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Live staff presence via Supabase Realtime Presence.
 *
 * Every signed-in staff member joins a shared presence channel and tracks a
 * small public profile (name, role). The hook returns the live roster of who's
 * online — powering presence indicators and "who else is here" collaboration
 * cues. No extra dependency or server work: it rides the Supabase realtime
 * connection the dashboards already use.
 */

export interface PresenceMember {
  userId: string;
  name: string;
  role: string;
  onlineAt: string;
}

interface PresenceSelf {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
}

const PRESENCE_CHANNEL = "presence:aegis-staff";

export function usePresence(self: PresenceSelf): PresenceMember[] {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const userId = self.userId ?? null;
  const name = self.name ?? "Staff";
  const role = self.role ?? "responder";

  useEffect(() => {
    if (!hasSupabase || !userId) {
      setMembers([]);
      return;
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    const syncMembers = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<Partial<PresenceMember>>
      >;
      const list: PresenceMember[] = [];
      for (const key of Object.keys(state)) {
        const entry = state[key]?.[0];
        if (entry?.userId) {
          list.push({
            userId: entry.userId,
            name: entry.name ?? "Staff",
            role: entry.role ?? "responder",
            onlineAt: entry.onlineAt ?? new Date().toISOString(),
          });
        }
      }
      // Stable order: most-recently-online first.
      list.sort((a, b) => b.onlineAt.localeCompare(a.onlineAt));
      setMembers(list);
    };

    channel
      .on("presence", { event: "sync" }, syncMembers)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            userId,
            name,
            role,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, name, role]);

  return members;
}
