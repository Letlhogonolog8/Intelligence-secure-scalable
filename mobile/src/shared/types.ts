/**
 * Focused Supabase schema types for the survivor mobile app — the subset of
 * `src/lib/supabase.ts` (web) that the mobile app reads/writes.
 *
 * The row/table shapes themselves live in ../../../shared/database-types.ts,
 * the single source of truth both apps import from. Only redeclare
 * mobile-specific composition here (which tables/functions this app needs),
 * never the field shapes themselves.
 */

import type {
  ApprovalStatus,
  CaseReportRow,
  EscalationEventRow,
  Json,
  PeerSupportMessageInsert,
  PeerSupportMessageRow,
  SharedDatabaseFunctions,
  TableDefinition,
  UserProfileRow,
  UserRole,
} from "../../../shared/database-types";

export type {
  ApprovalStatus,
  CaseReportRow,
  EscalationEventRow,
  Json,
  PeerSupportMessageRow,
  UserProfileRow,
  UserRole,
};

export type Database = {
  public: {
    Tables: {
      user_profiles: TableDefinition<UserProfileRow>;
      escalation_events: TableDefinition<EscalationEventRow>;
      case_reports: TableDefinition<CaseReportRow>;
      peer_support_messages: TableDefinition<
        PeerSupportMessageRow,
        PeerSupportMessageInsert
      >;
    };
    Views: Record<string, never>;
    Functions: SharedDatabaseFunctions;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
