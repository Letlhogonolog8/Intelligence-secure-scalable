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

export type CreateUsernameUserPayload = {
  username: string
  password: string
  full_name?: string | null
}

export type CreateUsernameUserResponse = {
  success: boolean
  user_id?: string
  email?: string
  error?: string
}

export const createUsernameUser = async (
  payload: CreateUsernameUserPayload
): Promise<{ data: CreateUsernameUserResponse | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/create_username_user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.VITE_SUPABASE_KEY as string,
        Authorization: `Bearer ${env.VITE_SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) as CreateUsernameUserResponse : null

    if (!response.ok) {
      return {
        data,
        error: new Error(data?.error || `Edge function request failed with status ${response.status}`),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to invoke create_username_user"),
    }
  }
}

export { supabase }
