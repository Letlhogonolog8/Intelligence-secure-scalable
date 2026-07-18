/**
 * Canonical Supabase row/table types for the entities both the web app
 * (src/lib/supabase.ts) and the mobile app (mobile/src/shared/types.ts)
 * read or write.
 *
 * Before this file existed, each app hand-maintained its own copy of these
 * types, and they drifted — e.g. mobile referenced a column
 * (`escalation_id`) that had never existed on the web side (fixed in
 * afc7fde), web's `escalation_events` type was missing the real, NOT NULL
 * `triggered_by` column mobile had, and web's `case_reports` type had six
 * real columns (category, location, is_anonymous, reported_by,
 * public_reference, reporter_relationship) that mobile's copy lacked
 * entirely. Both apps now import from here instead of redeclaring these
 * shapes, so a schema change only needs a compiler-checked edit in one
 * place.
 *
 * Keep this file dependency-free (no imports from '@/...' or 'src/...') —
 * the mobile app's Metro bundler resolves it via a relative path outside its
 * own project root (see mobile/metro.config.js's `watchFolders`), and it
 * must stay a plain, self-contained .ts module for that to work reliably.
 *
 * Row types are plain object type aliases, not `interface`s — Supabase's
 * generated client generics constrain each table's Row/Insert/Update against
 * a Record<string, unknown>-shaped bound, which a bare `interface` (no index
 * signature) doesn't structurally satisfy and silently collapses query
 * builder types to `never`. Keep it that way.
 *
 * Only entities genuinely shared between both apps belong here. Web-only
 * tables stay declared directly in src/lib/supabase.ts.
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

export type TableDefinition<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Insert>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type UserProfileRow = {
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
};

export type EscalationEventRow = {
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
};

export type CaseReportRow = {
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
};

export type PeerSupportMessageRow = {
  id: string;
  alias: string;
  content: string;
  flagged: boolean;
  created_at: string;
  expires_at: string;
};

export type PeerSupportMessageInsert = {
  alias: string;
  content: string;
  flagged?: boolean;
  expires_at?: string;
};

/** Shared Postgres RPC function signatures (both apps call these). */
export type SharedDatabaseFunctions = {
  flag_peer_support_message: {
    Args: { p_message_id: string };
    Returns: boolean | null;
  };
  set_preferred_language: {
    Args: { lang: string };
    Returns: undefined;
  };
};
