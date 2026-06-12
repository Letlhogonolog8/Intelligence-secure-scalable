/**
 * Focused Supabase schema types for the survivor mobile app. Mirrors the
 * subset of `src/lib/supabase.ts` (web) that the mobile app reads/writes.
 * Promote to a shared workspace package when the web app is migrated too.
 */

export type Json = unknown;

export type UserRole =
  | "admin"
  | "counselor"
  | "survivor"
  | "ngo"
  | "police"
  | "analyst"
  | "chw";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface UserProfileRow {
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
  created_at: string | null;
  updated_at: string | null;
}

export interface EscalationEventRow {
  id: string;
  case_id: string | null;
  triggered_by: string | null;
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
}

export interface CaseReportRow {
  id: string;
  survivor_id: string | null;
  source: string | null;
  report_method: string | null;
  language: string | null;
  status: string;
  risk_level: string;
  risk_score: number | null;
  priority: string;
  description: string | null;
  encrypted_location: string | null;
  location_iv: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PeerSupportMessageRow {
  id: string;
  alias: string;
  content: string;
  flagged: boolean;
  created_at: string;
  expires_at: string;
}

export type Database = {
  public: {
    Tables: {
      user_profiles: TableDefinition<UserProfileRow>;
      escalation_events: TableDefinition<EscalationEventRow>;
      case_reports: TableDefinition<CaseReportRow>;
      peer_support_messages: TableDefinition<
        PeerSupportMessageRow,
        {
          alias: string;
          content: string;
          flagged?: boolean;
          expires_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      flag_peer_support_message: {
        Args: { p_message_id: string };
        Returns: boolean | null;
      };
      set_preferred_language: {
        Args: { lang: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
