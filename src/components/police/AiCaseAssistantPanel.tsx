import { useState } from "react";
import { Loader2, Sparkles, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GlassPanel,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import {
  summarizeCase,
  SEVERITY_TONE,
  type CaseSummaryResult,
} from "@/data/caseSummary";
import {
  RELATIONSHIP_LABEL,
  useCommunityReports,
} from "@/data/communityReports";

/**
 * AI case assistant for responders: paste or pick case material and get a
 * neutral summary, a severity classification, and recommended next actions
 * (backend /api/ai/case-summary). Live community reports can prefill the input
 * for one-click triage; the panel degrades gracefully when AI is unavailable.
 */

const AiCaseAssistantPanel: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { data: reports = [] } = useCommunityReports();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaseSummaryResult | null>(null);

  const prefillFrom = (id: string) => {
    const report = reports.find((entry) => entry.id === id);
    if (!report) return;
    const label = report.relationship
      ? RELATIONSHIP_LABEL[report.relationship]
      : "Community report";
    setText(
      `${label}${report.category ? ` · ${report.category}` : ""}${report.locationText ? ` · ${report.locationText}` : ""}\n\n${report.description}`,
    );
    setResult(null);
    setError(null);
  };

  const run = async () => {
    if (text.trim().length < 10) {
      setError("Add a bit more case detail to summarize.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await summarizeCase(text.trim()));
    } catch {
      setError(
        "AI summary is unavailable right now. Please try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassPanel
      className={className}
      icon={<Sparkles className="h-4 w-4 text-purple-400" />}
      title="AI case assistant"
      subtitle="Summarize, classify severity, and get recommended actions for a case"
      action={
        reports.length > 0 ? (
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) prefillFrom(event.target.value);
              event.target.value = "";
            }}
            aria-label="Prefill from a community report"
            className="rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs font-semibold text-white focus:border-purple-500/50 focus:outline-none"
          >
            <option value="">Prefill from report…</option>
            {reports.slice(0, 20).map((report) => (
              <option key={report.id} value={report.id}>
                {report.reference ?? report.id.slice(0, 8)} ·{" "}
                {report.description.slice(0, 40)}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={6000}
        placeholder="Paste case notes, an incident report, or pick a community report above…"
        className="w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
      />

      <Button
        onClick={() => void run()}
        disabled={busy}
        className="mt-3 h-10 w-full bg-purple-600 text-xs font-black uppercase tracking-widest hover:bg-purple-500"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" /> Summarize &amp; classify
          </>
        )}
      </Button>

      {error && (
        <p className="mt-3 text-xs font-medium text-rose-400">{error}</p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Summary
              </p>
              <StatusPill tone={SEVERITY_TONE[result.severity]}>
                {result.severity}
              </StatusPill>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">
              {result.summary}
            </p>
          </div>

          {result.recommendedActions.length > 0 && (
            <div className="rounded-lg border border-purple-500/25 bg-purple-500/10 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-purple-300">
                <ListChecks className="h-3.5 w-3.5" /> Recommended actions
              </p>
              <ul className="space-y-1.5">
                {result.recommendedActions.map((action, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-sm leading-relaxed text-white"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            AI-generated triage aid — verify against the source material before
            acting. Not a substitute for professional judgment.
          </p>
        </div>
      )}
    </GlassPanel>
  );
};

export default AiCaseAssistantPanel;
