import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StatTile,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { formatRelativeDateTime } from "@/lib/dashboardMetrics";

type LookupResult = {
  id: string;
  status: string;
  risk_level: string;
  priority: string;
  updated_at: string | null;
  created_at: string | null;
};

export const CaseStatusLookup = ({
  title = "Case Status Lookup",
  description = "Use a secure case reference to retrieve live status updates.",
  placeholder = "Enter case ID",
  emptyHint = "Enter a case reference to load the latest official record.",
}: {
  title?: string;
  description?: string;
  placeholder?: string;
  emptyHint?: string;
}) => {
  const [caseId, setCaseId] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    const trimmed = caseId.trim();
    if (!trimmed) {
      setError("Enter a case ID to check status.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: lookupError } = await supabase
      .from("case_reports")
      .select("id,status,risk_level,priority,updated_at,created_at")
      .eq("id", trimmed)
      .maybeSingle();

    if (!lookupError && data) {
      setResult(data);
      setLoading(false);
      return;
    }

    const missingCaseReports =
      Boolean(lookupError) &&
      ((lookupError as { code?: string; message?: string }).code === "42P01" ||
        ((lookupError as { message?: string }).message ?? "")
          .toLowerCase()
          .includes("case_reports"));

    if (!missingCaseReports) {
      setResult(null);
      setError("Case not found. Please verify the ID.");
      setLoading(false);
      return;
    }

    const fallback = await supabase
      .from("justice_cases")
      .select("id,case_number,status,priority,updated_at,created_at")
      .eq("case_number", trimmed)
      .maybeSingle();

    if (fallback.error || !fallback.data) {
      setResult(null);
      setError("Case not found. Please verify the ID.");
      setLoading(false);
      return;
    }

    setResult({
      id: fallback.data.case_number ?? fallback.data.id,
      status: fallback.data.status,
      risk_level: fallback.data.priority ?? "medium",
      priority: fallback.data.priority ?? "medium",
      updated_at: fallback.data.updated_at,
      created_at: fallback.data.created_at,
    });
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input
          value={caseId}
          onChange={(event) => {
            setCaseId(event.target.value);
            setError(null);
            setResult(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !loading) {
              void handleLookup();
            }
          }}
          placeholder={placeholder}
          className="h-12 border-white/10 bg-slate-950/70 text-white"
        />
        <Button
          className="h-12 min-w-[180px]"
          disabled={loading}
          onClick={() => void handleLookup()}
        >
          {loading ? "Checking..." : "Check Status"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Status"
            value={<StatusPill tone="emerald">{result.status}</StatusPill>}
          />
          <StatTile label="Priority" value={result.priority} />
          <StatTile
            label="Risk level"
            value={<span className="text-rose-300">{result.risk_level}</span>}
          />
          <StatTile
            label="Last update"
            value={
              <span className="text-sm font-medium text-slate-100">
                {formatRelativeDateTime(result.updated_at)}
              </span>
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-slate-300">
          {emptyHint}
        </div>
      )}
    </div>
  );
};
