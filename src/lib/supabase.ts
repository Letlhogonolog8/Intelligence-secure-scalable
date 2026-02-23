import { createClient } from "@supabase/supabase-js"
import { env, hasSupabase } from "@/lib/env"

type SupabaseClient = ReturnType<typeof createClient>

type SupabaseFallback = Pick<SupabaseClient, "auth" | "functions" | "from" | "channel" | "removeChannel">

type EmptyQueryResult<T> = { data: T | null; error: Error }

const createFallbackClient = (): SupabaseFallback => {
  const error = new Error("Supabase is not configured")
  const createEmptyBuilder = <T,>() => {
    const builder = {
      select: async () => ({ data: [] as T[], error }),
      order: () => builder,
      limit: () => builder,
      eq: () => builder,
      maybeSingle: async (): Promise<EmptyQueryResult<T>> => ({ data: null, error }),
      single: async (): Promise<EmptyQueryResult<T>> => ({ data: null, error }),
    }
    return builder
  }
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  }
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithOtp: async () => ({ data: null, error }),
      signOut: async () => ({ error }),
    },
    functions: {
      invoke: async () => ({ data: null, error }),
    },
    from: () => createEmptyBuilder(),
    channel: () => channel,
    removeChannel: () => undefined,
  }
}

const supabase: SupabaseFallback = hasSupabase
  ? createClient(env.VITE_SUPABASE_URL as string, env.VITE_SUPABASE_KEY as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createFallbackClient()

export { supabase }
