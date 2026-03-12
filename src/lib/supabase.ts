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
  profile?: {
    role: string
    full_name?: string | null
    is_active?: boolean
    organization_id?: string | null
  }
  survivor?: {
    phone_number?: string | null
    emergency_contact?: string | null
    consent?: boolean
    location: {
      province: string
      city_town: string
      physical_address?: string | null
      gps_coordinates?: string | null
    }
  }
}

export type CreateUsernameUserResponse = {
  success: boolean
  user_id?: string
  email?: string
  survivor_id?: string
  survivor_code?: string
  risk_level?: string
  risk_score?: number
  error?: string
}

const invokeEdgeFunction = async <TResponse, TPayload = unknown>(
  name: string,
  payload: TPayload,
  errorMessage: string,
  accessToken?: string | null
): Promise<{ data: TResponse | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_KEY as string,
      Authorization: `Bearer ${accessToken ?? env.VITE_SUPABASE_KEY}`,
    }

    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) as TResponse : null

    if (!response.ok) {
      const error = data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error ?? "")
        : ""
      return {
        data,
        error: new Error(error || `Edge function request failed with status ${response.status}`),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(errorMessage),
    }
  }
}

export const createUsernameUser = async (
  payload: CreateUsernameUserPayload
): Promise<{ data: CreateUsernameUserResponse | null; error: Error | null }> => {
  return invokeEdgeFunction<CreateUsernameUserResponse>(
    "create_username_user",
    payload,
    "Failed to invoke create_username_user"
  )
}

type RegisterSurvivorPayload = {
  user_id: string
  full_name: string
  email?: string | null
  phone_number?: string | null
  emergency_contact?: string | null
  consent?: boolean
  location: {
    province: string
    city_town: string
    physical_address?: string | null
    gps_coordinates?: string | null
  }
}

type RegisterSurvivorResponse = {
  success: boolean
  survivor_id?: string
  survivor_code?: string
  risk_level?: string
  risk_score?: number
  error?: string
}

export const registerSurvivor = async (
  payload: RegisterSurvivorPayload,
  accessToken?: string | null
): Promise<{ data: RegisterSurvivorResponse | null; error: Error | null }> => {
  return invokeEdgeFunction<RegisterSurvivorResponse>(
    "register_survivor",
    payload,
    "Failed to invoke register_survivor",
    accessToken
  )
}

export { supabase }
