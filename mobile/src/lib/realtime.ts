import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

type PgEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

/**
 * Subscribe to Postgres change events on one or more tables and invalidate the
 * given React Query key whenever a row changes — giving the survivor app the
 * same live updates the web portals get via `useRealtimeQuery`
 * (src/data/aegisData.ts). The mobile and web apps share one Supabase project,
 * so a status change written by a counsellor/officer/NGO on the web portal
 * streams to the survivor's device instead of waiting for the next poll.
 *
 * RLS still applies to Realtime, so a survivor only receives events for rows
 * they are permitted to SELECT. When Supabase isn't configured (or the channel
 * fails) the underlying query simply keeps its normal refetch behaviour.
 */
export function useRealtimeSync(
  tables: string | string[],
  queryKey: QueryKey,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const list = Array.isArray(tables) ? tables : [tables];
  const tableKey = list.join(",");
  // Stable primitive deps so the effect only re-subscribes when the target
  // tables or query key actually change (not on every render).
  const keyStr = JSON.stringify(queryKey);

  useEffect(() => {
    if (!hasSupabase || !enabled) return;

    const channels = tableKey
      .split(",")
      .filter(Boolean)
      .map((table) =>
        supabase
          .channel(`rt:${table}:${keyStr}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            () => {
              queryClient.invalidateQueries({ queryKey });
            },
          )
          .subscribe(),
      );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
    // queryKey is captured via keyStr; tables via tableKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tableKey, keyStr, enabled]);
}

/**
 * Callback variant of {@link useRealtimeSync} for screens that load data
 * imperatively (e.g. via a `load()` function) instead of through React Query.
 * Runs `handler` whenever a matching row changes. The handler is held in a ref
 * so the subscription is not torn down and rebuilt every render.
 */
export function useRealtimeCallback(
  tables: string | string[],
  handler: () => void,
  options?: { enabled?: boolean; event?: PgEvent },
) {
  const enabled = options?.enabled ?? true;
  const event = options?.event ?? "*";
  const list = Array.isArray(tables) ? tables : [tables];
  const tableKey = list.join(",");

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  // One stable id per hook instance so concurrent subscribers to the same
  // table don't share a channel topic.
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = Math.random().toString(36).slice(2, 9);

  useEffect(() => {
    if (!hasSupabase || !enabled) return;

    const channels = tableKey
      .split(",")
      .filter(Boolean)
      .map((table) =>
        supabase
          .channel(`rt-cb:${table}:${idRef.current}`)
          .on("postgres_changes", { event, schema: "public", table }, () => {
            handlerRef.current();
          })
          .subscribe(),
      );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [tableKey, enabled, event]);
}
