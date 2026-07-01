import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "@/lib/env";

type Json = unknown;

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      audit_log: TableDefinition<{
        id: string;
        table_name: string | null;
        record_id: string | null;
        operation: string | null;
        old_values: Json | null;
        new_values: Json | null;
        changed_by: string | null;
        changed_at: string | null;
        notes: string | null;
      }>;
      audit_logs: TableDefinition<{
        id: string;
        user_id: string | null;
        action: string;
        module: string | null;
        description: string | null;
        severity: string | null;
        resource: string | null;
        resource_id: string | null;
        status: string | null;
        details: Json | null;
        ip_address: string | null;
        user_agent: string | null;
        timestamp: string | null;
        created_at: string | null;
      }>;
      alerts_feed: TableDefinition<{
        id: string;
        time: string | null;
        type: string | null;
        message: string | null;
        module: string | null;
        severity: string | null;
        status: string | null;
        acknowledged_at: string | null;
        acknowledged_by: string | null;
        created_at: string | null;
      }>;
      case_reports: TableDefinition<{
        id: string;
        survivor_id: string | null;
        source: string | null;
        report_method: string | null;
        language: string | null;
        category: string | null;
        status: string;
        risk_level: string;
        risk_score: number | null;
        priority: string;
        description: string | null;
        encrypted_location: string | null;
        location_iv: string | null;
        location: { address?: string } | null;
        is_anonymous: boolean | null;
        reported_by: string | null;
        public_reference: string | null;
        reporter_relationship: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      chat_messages: TableDefinition<{
        id: string;
        session_id: string;
        role: string | null;
        sender_id: string | null;
        sender_role: string | null;
        message_type: string | null;
        content: string;
        encrypted_content: string | null;
        is_encrypted: boolean | null;
        metadata: Json | null;
        emotion_detected: string | null;
        risk_score: number | null;
        language: string | null;
        created_at: string | null;
      }>;
      peer_support_messages: TableDefinition<
        {
          id: string;
          alias: string;
          content: string;
          flagged: boolean;
          created_at: string;
          expires_at: string;
        },
        {
          alias: string;
          content: string;
          flagged?: boolean;
          expires_at?: string;
        }
      >;
      evidence_vault: TableDefinition<{
        id: string;
        survivor_id: string | null;
        file_name: string;
        file_size: number;
        mime_type: string;
        storage_path: string;
        access_code: string;
        is_anonymous: boolean;
        uploaded_at: string;
      }>;
      voice_evidence: TableDefinition<
        {
          id: string;
          uploaded_by: string;
          case_reference: string | null;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          original_text: string;
          detected_language: string | null;
          translated_text: string | null;
          target_language: string | null;
          created_at: string;
          /** Generated full-text column — filter on it, never select it. */
          search_tsv: string | null;
        },
        {
          uploaded_by: string;
          case_reference?: string | null;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          original_text: string;
          detected_language?: string | null;
          translated_text?: string | null;
          target_language?: string | null;
        }
      >;
      voice_evidence_translations: TableDefinition<
        {
          id: string;
          evidence_id: string;
          language: string;
          translated_text: string;
          translated_by: string | null;
          created_at: string;
        },
        {
          evidence_id: string;
          language: string;
          translated_text: string;
          translated_by?: string | null;
        }
      >;
      case_evidence: TableDefinition<
        {
          id: string;
          case_reference: string | null;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          evidence_type: string | null;
          note: string | null;
          uploaded_by: string | null;
          created_at: string;
        },
        {
          case_reference?: string | null;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          evidence_type?: string | null;
          note?: string | null;
          uploaded_by: string;
        }
      >;
      evidence_consents: TableDefinition<
        {
          id: string;
          survivor_id: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          note: string | null;
          granted_at: string;
          revoked_at: string | null;
        },
        {
          survivor_id: string;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          note?: string | null;
          revoked_at?: string | null;
        }
      >;
      organization_coordination: TableDefinition<
        {
          id: string;
          from_organization_id: string | null;
          to_organization_id: string | null;
          case_id: string | null;
          referral_type: string;
          status: string;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
          completed_at: string | null;
        },
        {
          from_organization_id: string;
          to_organization_id: string;
          case_id: string;
          referral_type: string;
          status?: string;
          notes?: string | null;
        }
      >;
      escalation_events: TableDefinition<{
        id: string;
        case_id: string | null;
        user_id: string | null;
        escalation_type: string | null;
        severity: string;
        reason: string | null;
        location: Json | null;
        status: string;
        acknowledged_by: string | null;
        acknowledged_at: string | null;
        resolved_at: string | null;
        triggered_at: string | null;
        metadata: Json | null;
        created_at: string | null;
      }>;
      incidents: TableDefinition<{
        id: string;
        region_id: string;
        incident_type: string;
        description: string | null;
        severity: string;
        reported_by: string | null;
        anonymous: boolean | null;
        latitude: number | null;
        longitude: number | null;
        incident_date: string;
        created_at: string | null;
        updated_at: string | null;
      }>;
      justice_cases: TableDefinition<{
        id: string;
        case_number: string;
        case_type: string;
        region_id: string | null;
        status: string;
        stage: string | null;
        assigned_to: string | null;
        priority: string;
        days_open: number | null;
        created_at: string | null;
        updated_at: string | null;
        closed_at: string | null;
      }>;
      resource_capacity: TableDefinition<{
        id: string;
        current_occupancy: number | null;
      }>;
      ussd_messages: TableDefinition<{
        id: string;
        session_id: string;
        direction: string;
        content: string;
        menu_level: string;
        timestamp: string | null;
        status: string | null;
        error_message: string | null;
        created_at: string | null;
      }>;
      ussd_sessions: TableDefinition<{
        id: string | null;
        session_id: string;
        phone_number: string | null;
        state: string | null;
        current_menu: string | null;
        last_input: string | null;
        payload: Json | null;
        user_id: string | null;
        user_role: string | null;
        metadata: Json | null;
        created_at: string | null;
        updated_at: string | null;
        expires_at: string | null;
        is_active: boolean | null;
      }>;
      ussd_submissions: TableDefinition<{
        id: string;
        session_id: string;
        menu_level: string;
        menu_code: string;
        user_input: string | null;
        timestamp: string | null;
        status: string | null;
        processed_by: string | null;
        processed_at: string | null;
        response_message: string | null;
        created_at: string | null;
      }>;
      user_profiles: TableDefinition<{
        id: string;
        organization_id: string | null;
        role: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
        preferred_language: string | null;
        is_active: boolean | null;
        approval_status: ApprovalStatus | null;
        mfa_enabled: boolean | null;
        role_assigned_by: string | null;
        approved_by: string | null;
        approved_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      responder_settings: TableDefinition<
        {
          user_id: string;
          critical_push: boolean;
          case_assignment_push: boolean;
          audit_visibility: boolean;
          available: boolean;
          updated_at: string;
        },
        {
          user_id: string;
          critical_push?: boolean;
          case_assignment_push?: boolean;
          audit_visibility?: boolean;
          available?: boolean;
          updated_at?: string;
        }
      >;
      secure_conversations: TableDefinition<{
        id: string;
        subject: string | null;
        case_id: string | null;
        created_by: string | null;
        created_at: string;
        last_message_at: string;
      }>;
      secure_conversation_participants: TableDefinition<
        {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string | null;
          added_at: string;
          last_read_at: string;
        },
        {
          conversation_id: string;
          user_id: string;
          role?: string | null;
          last_read_at?: string;
        }
      >;
      secure_messages: TableDefinition<
        {
          id: string;
          conversation_id: string;
          sender_id: string;
          sender_role: string | null;
          body: string;
          created_at: string;
        },
        {
          conversation_id: string;
          sender_id: string;
          sender_role?: string | null;
          body: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      set_preferred_language: {
        Args: { lang: string };
        Returns: undefined;
      };
      start_secure_conversation: {
        Args: {
          p_subject: string | null;
          p_case_id: string | null;
          p_participants: string[];
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AppSupabaseClient = SupabaseClient<Database>;

type EmptyQueryResult<T> = { data: T | null; error: Error };

const createFallbackClient = (): AppSupabaseClient => {
  const error = new Error("Supabase is not configured");
  const createEmptyBuilder = <T>() => {
    const builder = {
      select: async () => ({ data: [] as T[], error }),
      order: () => builder,
      limit: () => builder,
      eq: () => builder,
      maybeSingle: async (): Promise<EmptyQueryResult<T>> => ({
        data: null,
        error,
      }),
      single: async (): Promise<EmptyQueryResult<T>> => ({ data: null, error }),
    };
    return builder;
  };
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  };
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithOtp: async () => ({
        data: { user: null, session: null },
        error: error as never,
      }),
      signOut: async () => ({ error: error as never }),
    },
    functions: {
      invoke: async () => ({ data: null, error: error as never }),
    },
    from: () => createEmptyBuilder(),
    channel: () => channel,
    removeChannel: async () => "ok",
  } as unknown as AppSupabaseClient;
};

const supabase: AppSupabaseClient = hasSupabase
  ? createClient<Database>(
      env.VITE_SUPABASE_URL as string,
      env.VITE_SUPABASE_KEY as string,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    )
  : createFallbackClient();

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export type AccessProfile = {
  id: string;
  role: string;
  is_active: boolean | null;
  approval_status: ApprovalStatus | null;
  mfa_enabled: boolean | null;
  organization_id: string | null;
};

export type CreateUsernameUserPayload = {
  username: string;
  password: string;
  full_name?: string | null;
  profile?: {
    role: string;
    full_name?: string | null;
    is_active?: boolean;
    organization_id?: string | null;
    approval_status?: ApprovalStatus;
    mfa_enabled?: boolean;
    role_assigned_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
  };
  survivor?: {
    phone_number?: string | null;
    emergency_contact?: string | null;
    consent?: boolean;
    location: {
      province: string;
      city_town: string;
      physical_address?: string | null;
      gps_coordinates?: string | null;
    };
  };
};

export type CreateUsernameUserResponse = {
  success: boolean;
  user_id?: string;
  email?: string;
  survivor_id?: string;
  survivor_code?: string;
  risk_level?: string;
  risk_score?: number;
  error?: string;
};

export type UpdatePrivilegedAccountPayload = {
  target_user_id: string;
  username?: string;
  password?: string;
  profile?: {
    full_name?: string | null;
    role?: "counselor" | "ngo" | "police" | "analyst";
    organization_id?: string | null;
    is_active?: boolean;
    approval_status?: ApprovalStatus;
  };
};

export type UpdatePrivilegedAccountResponse = {
  success: boolean;
  user_id?: string;
  error?: string;
};

const invokeEdgeFunction = async <TResponse, TPayload = unknown>(
  name: string,
  payload: TPayload,
  errorMessage: string,
  accessToken?: string | null,
  accessTokenHeaderName?: string,
): Promise<{ data: TResponse | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    if (accessTokenHeaderName) {
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/functions/v1/${name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.VITE_SUPABASE_KEY as string,
            Authorization: `Bearer ${accessToken ?? (env.VITE_SUPABASE_KEY as string)}`,
            ...(accessToken ? { [accessTokenHeaderName]: accessToken } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const rawBody = await response.text();
      const data = rawBody ? (JSON.parse(rawBody) as TResponse) : null;

      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : `${errorMessage} (${response.status})`;

        return { data, error: new Error(message) };
      }

      return { data, error: null };
    }

    const { data, error } = await supabase.functions.invoke(name, {
      body: payload as BodyInit | Record<string, unknown> | undefined,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });

    if (error) {
      return {
        data: (data as TResponse | null) ?? null,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }

    return { data: (data as TResponse | null) ?? null, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(errorMessage),
    };
  }
};

export const createUsernameUser = async (
  payload: CreateUsernameUserPayload,
  accessToken?: string | null,
): Promise<{
  data: CreateUsernameUserResponse | null;
  error: Error | null;
}> => {
  return invokeEdgeFunction<CreateUsernameUserResponse>(
    "create_username_user",
    payload,
    "Failed to invoke create_username_user",
    accessToken,
    "x-admin-access-token",
  );
};

export const updatePrivilegedAccount = async (
  payload: UpdatePrivilegedAccountPayload,
  accessToken?: string | null,
): Promise<{
  data: UpdatePrivilegedAccountResponse | null;
  error: Error | null;
}> => {
  return invokeEdgeFunction<UpdatePrivilegedAccountResponse>(
    "update_privileged_account",
    payload,
    "Failed to invoke update_privileged_account",
    accessToken,
    "x-admin-access-token",
  );
};

export const fetchAccessProfile = async (
  userId: string,
): Promise<{ data: AccessProfile | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,role,is_active,approval_status,mfa_enabled,organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: (data as AccessProfile | null) ?? null, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to fetch access profile"),
    };
  }
};

export type MfaAssuranceLevel = "aal1" | "aal2" | null;

export type MfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type: "totp" | "phone" | "webauthn";
  status: "verified" | "unverified";
};

export type MfaAssurance = {
  currentLevel: MfaAssuranceLevel;
  nextLevel: MfaAssuranceLevel;
};

export type TotpEnrollment = {
  id: string;
  friendlyName?: string;
  qrCode: string;
  secret: string;
  uri: string;
};

const toBase64Utf8 = (value: string): string => {
  const utf8Value = encodeURIComponent(value).replace(
    /%([0-9A-F]{2})/g,
    (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)),
  );

  return btoa(utf8Value);
};

const toSvgDataUri = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  return `data:image/svg+xml;base64,${toBase64Utf8(trimmed)}`;
};

const getMfaApi = () => supabase.auth.mfa;

const mapMfaFactor = (value: unknown): MfaFactor | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const factor = value as Record<string, unknown>;
  const id = typeof factor.id === "string" ? factor.id : null;
  const factorType = factor.factor_type;
  const status = factor.status;

  if (
    !id ||
    (factorType !== "totp" &&
      factorType !== "phone" &&
      factorType !== "webauthn") ||
    (status !== "verified" && status !== "unverified")
  ) {
    return null;
  }

  return {
    id,
    friendly_name:
      typeof factor.friendly_name === "string"
        ? factor.friendly_name
        : undefined,
    factor_type: factorType,
    status,
  };
};

export const fetchMfaAssurance = async (): Promise<{
  data: MfaAssurance | null;
  error: Error | null;
}> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    const { data, error } = await getMfaApi().getAuthenticatorAssuranceLevel();
    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        currentLevel: data.currentLevel ?? null,
        nextLevel: data.nextLevel ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to fetch MFA assurance level"),
    };
  }
};

export const listMfaFactors = async (): Promise<{
  data: {
    all: MfaFactor[];
    verifiedTotp: MfaFactor[];
    unverifiedTotp: MfaFactor[];
  } | null;
  error: Error | null;
}> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    const { data, error } = await getMfaApi().listFactors();
    if (error) {
      return { data: null, error };
    }

    const all = Array.isArray(data.all)
      ? data.all
          .map(mapMfaFactor)
          .filter((factor): factor is MfaFactor => Boolean(factor))
      : [];

    const verifiedTotp = all.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );
    const unverifiedTotp = all.filter(
      (factor) =>
        factor.factor_type === "totp" && factor.status === "unverified",
    );

    return { data: { all, verifiedTotp, unverifiedTotp }, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to list MFA factors"),
    };
  }
};

export const enrollTotpFactor = async (
  friendlyName: string,
): Promise<{ data: TotpEnrollment | null; error: Error | null }> => {
  if (!hasSupabase) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    const { data, error } = await getMfaApi().enroll({
      factorType: "totp",
      friendlyName,
    });

    if (error) {
      return { data: null, error };
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
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to enroll MFA factor"),
    };
  }
};

export const unenrollMfaFactor = async (
  factorId: string,
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") };
  }

  try {
    const { error } = await getMfaApi().unenroll({ factorId });
    return { error: error ?? null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Failed to unenroll MFA factor"),
    };
  }
};

export const challengeAndVerifyTotp = async (
  factorId: string,
  code: string,
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") };
  }

  try {
    const { error } = await getMfaApi().challengeAndVerify({ factorId, code });
    return { error: error ?? null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Failed to verify MFA challenge"),
    };
  }
};

export const verifyMfaFactor = async (
  factorId: string,
  code: string,
  challengeId?: string,
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") };
  }

  try {
    const { error } = challengeId
      ? await getMfaApi().verify({ factorId, challengeId, code })
      : await getMfaApi().challengeAndVerify({ factorId, code });
    return { error: error ?? null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Failed to verify MFA factor"),
    };
  }
};

export const updateOwnMfaEnabled = async (
  userId: string,
  enabled: boolean,
): Promise<{ error: Error | null }> => {
  if (!hasSupabase) {
    return { error: new Error("Supabase is not configured") };
  }

  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ mfa_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return { error: error ?? null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Failed to update MFA profile state"),
    };
  }
};

type RegisterSurvivorPayload = {
  user_id: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  emergency_contact?: string | null;
  consent?: boolean;
  location: {
    province: string;
    city_town: string;
    physical_address?: string | null;
    gps_coordinates?: string | null;
  };
};

type RegisterSurvivorResponse = {
  success: boolean;
  survivor_id?: string;
  survivor_code?: string;
  risk_level?: string;
  risk_score?: number;
  error?: string;
};

export const registerSurvivor = async (
  payload: RegisterSurvivorPayload,
  accessToken?: string | null,
): Promise<{ data: RegisterSurvivorResponse | null; error: Error | null }> => {
  return invokeEdgeFunction<RegisterSurvivorResponse>(
    "register_survivor",
    payload,
    "Failed to invoke register_survivor",
    accessToken,
  );
};

export { supabase };
