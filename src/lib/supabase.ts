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

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended"

export type AccessProfile = {
  id: string
  role: string
  is_active: boolean | null
  approval_status: ApprovalStatus | null
  mfa_enabled: boolean | null
  organization_id: string | null
}

export type CreateUsernameUserPayload = {
  username: string
  password: string
  full_name?: string | null
  profile?: {
    role: string
    full_name?: string | null
    is_active?: boolean
    organization_id?: string | null
    approval_status?: ApprovalStatus
    mfa_enabled?: boolean
    role_assigned_by?: string | null
    approved_by?: string | null
    approved_at?: string | null
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

export type UpdatePrivilegedAccountPayload = {
  target_user_id: string
  username?: string
  password?: string
  profile?: {
    full_name?: string | null
    role?: "counselor" | "ngo" | "police" | "analyst"
    organization_id?: string | null
    is_active?: boolean
    approval_status?: ApprovalStatus
  }
}

export type UpdatePrivilegedAccountResponse = {
  success: boolean
  user_id?: string
  error?: string
}

const invokeEdgeFunction = async <TResponse, TPayload = unknown>(
  name: string,
  payload: TPayload,
  errorMessage: string,
  accessToken?: string | null,
  accessTokenHeaderName?: string
): Promise<{ data: TResponse | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    if (accessTokenHeaderName) {
      const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.VITE_SUPABASE_KEY as string,
          Authorization: `Bearer ${accessToken ?? (env.VITE_SUPABASE_KEY as string)}`,
          ...(accessToken ? { [accessTokenHeaderName]: accessToken } : {}),
        },
        body: JSON.stringify(payload),
      })

      const rawBody = await response.text()
      const data = rawBody ? JSON.parse(rawBody) as TResponse : null

      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `${errorMessage} (${response.status})`

        return { data, error: new Error(message) }
      }

      return { data, error: null }
    }

    const { data, error } = await supabase.functions.invoke(name, {
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

    if (error) {
      return {
        data: (data as TResponse | null) ?? null,
        error: error instanceof Error ? error : new Error(errorMessage),
      }
    }

    return { data: (data as TResponse | null) ?? null, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(errorMessage),
    }
  }
}

export const createUsernameUser = async (
  payload: CreateUsernameUserPayload,
  accessToken?: string | null
): Promise<{ data: CreateUsernameUserResponse | null; error: Error | null }> => {
  return invokeEdgeFunction<CreateUsernameUserResponse>(
    "create_username_user",
    payload,
    "Failed to invoke create_username_user",
    accessToken,
    "x-admin-access-token"
  )
}

export const updatePrivilegedAccount = async (
  payload: UpdatePrivilegedAccountPayload,
  accessToken?: string | null
): Promise<{ data: UpdatePrivilegedAccountResponse | null; error: Error | null }> => {
  return invokeEdgeFunction<UpdatePrivilegedAccountResponse>(
    "update_privileged_account",
    payload,
    "Failed to invoke update_privileged_account",
    accessToken,
    "x-admin-access-token"
  )
}

export const fetchAccessProfile = async (
  userId: string
): Promise<{ data: AccessProfile | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,role,is_active,approval_status,mfa_enabled,organization_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      return { data: null, error }
    }

    return { data: (data as AccessProfile | null) ?? null, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to fetch access profile"),
    }
  }
}

export type MfaAssuranceLevel = "aal1" | "aal2" | null

export type MfaFactor = {
  id: string
  friendly_name?: string
  factor_type: "totp" | "phone" | "webauthn"
  status: "verified" | "unverified"
}

export type MfaAssurance = {
  currentLevel: MfaAssuranceLevel
  nextLevel: MfaAssuranceLevel
}

export type TotpEnrollment = {
  id: string
  friendlyName?: string
  qrCode: string
  secret: string
  uri: string
}

const toBase64Utf8 = (value: string): string => {
  const utf8Value = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  )

  return btoa(utf8Value)
}

const toSvgDataUri = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.startsWith("data:")) {
    return trimmed
  }

  return `data:image/svg+xml;base64,${toBase64Utf8(trimmed)}`
}

const getMfaApi = () => (supabase as SupabaseClient).auth.mfa

const mapMfaFactor = (value: unknown): MfaFactor | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const factor = value as Record<string, unknown>
  const id = typeof factor.id === "string" ? factor.id : null
  const factorType = factor.factor_type
  const status = factor.status

  if (
    !id
    || (factorType !== "totp" && factorType !== "phone" && factorType !== "webauthn")
    || (status !== "verified" && status !== "unverified")
  ) {
    return null
  }

  return {
    id,
    friendly_name: typeof factor.friendly_name === "string" ? factor.friendly_name : undefined,
    factor_type: factorType,
    status,
  }
}

export const fetchMfaAssurance = async (): Promise<{ data: MfaAssurance | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const { data, error } = await getMfaApi().getAuthenticatorAssuranceLevel()
    if (error) {
      return { data: null, error }
    }

    return {
      data: {
        currentLevel: data.currentLevel ?? null,
        nextLevel: data.nextLevel ?? null,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to fetch MFA assurance level"),
    }
  }
}

export const listMfaFactors = async (): Promise<{
  data: { all: MfaFactor[]; verifiedTotp: MfaFactor[]; unverifiedTotp: MfaFactor[] } | null
  error: Error | null
}> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const { data, error } = await getMfaApi().listFactors()
    if (error) {
      return { data: null, error }
    }

    const all = Array.isArray(data.all)
      ? data.all.map(mapMfaFactor).filter((factor): factor is MfaFactor => Boolean(factor))
      : []

    const verifiedTotp = all.filter((factor) => factor.factor_type === "totp" && factor.status === "verified")
    const unverifiedTotp = all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")

    return { data: { all, verifiedTotp, unverifiedTotp }, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to list MFA factors"),
    }
  }
}

export const enrollTotpFactor = async (
  friendlyName: string
): Promise<{ data: TotpEnrollment | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") }
  }

  try {
    const { data, error } = await getMfaApi().enroll({
      factorType: "totp",
      friendlyName,
    })

    if (error) {
      return { data: null, error }
    }

    return {
      data: {
        id: data.id,
        friendlyName: data.friendly_name,
        qrCode: toSvgDataUri(data.totp.qr_code),
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to enroll MFA factor"),
    }
  }
}

export const unenrollMfaFactor = async (
  factorId: string
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") }
  }

  try {
    const { error } = await getMfaApi().unenroll({ factorId })
    return { error: error ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to unenroll MFA factor"),
    }
  }
}

export const challengeAndVerifyTotp = async (
  factorId: string,
  code: string
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") }
  }

  try {
    const { error } = await getMfaApi().challengeAndVerify({ factorId, code })
    return { error: error ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to verify MFA challenge"),
    }
  }
}

export const verifyMfaFactor = async (
  factorId: string,
  code: string,
  challengeId?: string
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") }
  }

  try {
    const { error } = await getMfaApi().verify({ factorId, code, challengeId })
    return { error: error ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to verify MFA factor"),
    }
  }
}

export const updateOwnMfaEnabled = async (
  userId: string,
  enabled: boolean
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") }
  }

  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ mfa_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", userId)

    return { error: error ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to update MFA profile state"),
    }
  }
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
