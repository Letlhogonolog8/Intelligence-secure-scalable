/**
 * AI case summary + classification.
 *
 * Sends raw case/report material to the backend /api/ai/case-summary endpoint
 * (LLM triage) and returns a neutral summary, a severity classification, and
 * recommended next actions — the responder-facing "AI Case Summaries /
 * Incident Classification / Response Recommendations" capability.
 */

export type CaseSeverity = "low" | "medium" | "high" | "critical";

export interface CaseSummaryResult {
  summary: string;
  severity: CaseSeverity;
  recommendedActions: string[];
}

const apiBaseUrl = () =>
  (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(
    /\/+$/,
    "",
  );

export async function summarizeCase(
  text: string,
  context?: string,
): Promise<CaseSummaryResult> {
  const response = await fetch(`${apiBaseUrl()}/ai/case-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context: context ?? null }),
  });
  if (!response.ok) throw new Error(`case_summary_failed_${response.status}`);
  const data = (await response.json()) as Partial<CaseSummaryResult>;
  if (!data.summary) throw new Error("case_summary_empty");
  return {
    summary: data.summary,
    severity: (data.severity as CaseSeverity) ?? "medium",
    recommendedActions: Array.isArray(data.recommendedActions)
      ? data.recommendedActions
      : [],
  };
}

export const SEVERITY_TONE: Record<
  CaseSeverity,
  "emerald" | "amber" | "rose" | "slate"
> = {
  low: "emerald",
  medium: "amber",
  high: "rose",
  critical: "rose",
};
