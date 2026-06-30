import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Community & witness reporting.
 *
 * Public submission/tracking go through the account-free server endpoints
 * (/api/community/report) so no anon RLS is needed. The responder list reads
 * case_reports directly (RLS: responders_read_community_reports) and updates
 * live via the case_reports realtime publication.
 */

export type ReporterRelationship = "on_behalf" | "witness" | "concern";

export interface CommunityReportEntry {
  id: string;
  reference: string | null;
  description: string;
  relationship: ReporterRelationship | null;
  category: string | null;
  status: string;
  priority: string | null;
  locationText: string | null;
  createdAt: string | null;
}

export const COMMUNITY_REPORTS_QUERY_KEY = [
  "aegis",
  "communityReports",
] as const;

const COMMUNITY_REPORT_COLUMNS =
  "id,public_reference,description,reporter_relationship,category,status,priority,location,created_at";

type CommunityReportRow = {
  id: string;
  public_reference: string | null;
  description: string | null;
  reporter_relationship: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  location: { address?: string } | null;
  created_at: string | null;
};

const mapRow = (row: CommunityReportRow): CommunityReportEntry => ({
  id: row.id,
  reference: row.public_reference,
  description: row.description ?? "",
  relationship: (row.reporter_relationship as ReporterRelationship) ?? null,
  category: row.category,
  status: row.status,
  priority: row.priority,
  locationText: row.location?.address ?? null,
  createdAt: row.created_at,
});

export async function fetchCommunityReports(
  limit = 100,
): Promise<CommunityReportEntry[]> {
  const { data, error } = await supabase
    .from("case_reports")
    .select(COMMUNITY_REPORT_COLUMNS)
    .in("report_method", ["community_web", "community_mobile"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export const useCommunityReports = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: COMMUNITY_REPORTS_QUERY_KEY,
    queryFn: () => fetchCommunityReports(),
    enabled: hasSupabase && (options?.enabled ?? true),
    staleTime: 15000,
  });

const apiBaseUrl = () =>
  (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(
    /\/+$/,
    "",
  );

export interface SubmitCommunityReportInput {
  relationship: ReporterRelationship;
  description: string;
  category?: string | null;
  location?: string | null;
  language?: string | null;
}

/** Submit a community/witness report; returns the public tracking reference. */
export async function submitCommunityReport(
  input: SubmitCommunityReportInput,
): Promise<string> {
  const response = await fetch(`${apiBaseUrl()}/community/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`submit_failed_${response.status}`);
  const data = (await response.json()) as { reference?: string };
  if (!data.reference) throw new Error("submit_empty");
  return data.reference;
}

export interface CommunityReportStatus {
  reference: string;
  status: string;
  category: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Look up a community report's status by its public reference (or null). */
export async function trackCommunityReport(
  reference: string,
): Promise<CommunityReportStatus | null> {
  const response = await fetch(
    `${apiBaseUrl()}/community/report/${encodeURIComponent(reference.trim())}`,
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`lookup_failed_${response.status}`);
  return (await response.json()) as CommunityReportStatus;
}

export const RELATIONSHIP_LABEL: Record<ReporterRelationship, string> = {
  on_behalf: "On behalf of someone",
  witness: "Witness statement",
  concern: "Community safety concern",
};
