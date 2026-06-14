import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  HeartHandshake,
  Loader2,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AegisLogo } from "@/components/AegisLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  RELATIONSHIP_LABEL,
  submitCommunityReport,
  trackCommunityReport,
  type CommunityReportStatus,
  type ReporterRelationship,
} from "@/data/communityReports";

/**
 * Public, account-free reporting for community members and witnesses.
 * Anyone can report on behalf of a victim, file a witness statement, or raise
 * a safety concern, then track it later by reference — no sign-in, anonymous
 * by default. Submission/tracking go through the rate-limited server endpoints.
 */

const RELATIONSHIPS: Array<{
  id: ReporterRelationship;
  icon: typeof HeartHandshake;
  blurb: string;
}> = [
  {
    id: "on_behalf",
    icon: HeartHandshake,
    blurb: "Report an incident affecting someone else who needs help.",
  },
  {
    id: "witness",
    icon: Eye,
    blurb: "Share what you saw or heard as a witness.",
  },
  {
    id: "concern",
    icon: TriangleAlert,
    blurb: "Raise a safety concern about your community.",
  },
];

const CATEGORIES = [
  "Physical violence",
  "Sexual violence",
  "Emotional / psychological abuse",
  "Economic abuse",
  "Stalking / harassment",
  "Child safety",
  "Other",
];

const CommunityReport: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"file" | "track">("file");

  // File state
  const [relationship, setRelationship] =
    useState<ReporterRelationship>("on_behalf");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Track state
  const [trackRef, setTrackRef] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<CommunityReportStatus | null>(
    null,
  );
  const [trackError, setTrackError] = useState<string | null>(null);

  const submit = async () => {
    if (description.trim().length < 10) {
      setError("Please describe what happened in a little more detail.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ref = await submitCommunityReport({
        relationship,
        description: description.trim(),
        category,
        location: location.trim() || null,
      });
      setReference(ref);
    } catch {
      setError(
        "Couldn't submit the report right now. Please try again shortly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const track = async () => {
    const trimmed = trackRef.trim().toUpperCase();
    if (!trimmed) return;
    setTracking(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const result = await trackCommunityReport(trimmed);
      if (!result) {
        setTrackError("No report found with that reference. Check and retry.");
        return;
      }
      setTrackResult(result);
    } catch {
      setTrackError(
        "Couldn't check that reference right now. Try again shortly.",
      );
    } finally {
      setTracking(false);
    }
  };

  const copyReference = () => {
    if (!reference) return;
    void navigator.clipboard?.writeText(reference).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetForm = () => {
    setReference(null);
    setDescription("");
    setLocation("");
    setCategory(CATEGORIES[0]);
    setRelationship("on_behalf");
  };

  return (
    <main className="min-h-screen bg-[#0B0614] text-white">
      <header className="border-b border-white/5 bg-[#120A1E]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <AegisLogo size={36} />
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-purple-200/70">
                AEGIS-AI
              </p>
              <h1 className="text-base font-semibold">
                Community &amp; Witness Reporting
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="compact" />
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Home
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-purple-500/25 bg-purple-500/10 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
          <p className="text-sm leading-relaxed text-slate-200">
            Your report is anonymous — you don&apos;t need an account and we
            don&apos;t ask who you are. You&apos;ll get a reference to check on
            it later. If someone is in immediate danger, call your local
            emergency number first.
          </p>
        </div>

        <div
          className="mb-6 flex gap-1 border-b border-white/10 pb-1"
          role="tablist"
        >
          {(["file", "track"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={mode === tab}
              onClick={() => setMode(tab)}
              className={`rounded-t px-4 py-2 text-sm font-bold transition-all ${
                mode === tab
                  ? "border-b-2 border-purple-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "file" ? "File a report" : "Track a report"}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          reference ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
              <h2 className="text-lg font-bold">Report submitted</h2>
              <p className="mt-2 text-sm text-slate-200">
                Thank you. Your report has reached the response team. Keep this
                reference to check its status:
              </p>
              <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3">
                <span className="font-mono text-lg font-bold tracking-widest text-white">
                  {reference}
                </span>
                <button
                  onClick={copyReference}
                  aria-label="Copy reference"
                  className="text-slate-400 hover:text-white"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  onClick={() => {
                    setTrackRef(reference);
                    setMode("track");
                  }}
                  variant="outline"
                  className="border-white/15 bg-white/5"
                >
                  Track this report
                </Button>
                <Button
                  onClick={resetForm}
                  className="bg-purple-600 hover:bg-purple-500"
                >
                  File another report
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  This report is…
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {RELATIONSHIPS.map((entry) => {
                    const Icon = entry.icon;
                    const active = relationship === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setRelationship(entry.id)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          active
                            ? "border-purple-500/50 bg-purple-500/15"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <Icon
                          className={`mb-1.5 h-4 w-4 ${active ? "text-purple-300" : "text-slate-400"}`}
                        />
                        <p className="text-xs font-bold text-white">
                          {RELATIONSHIP_LABEL[entry.id]}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">
                          {entry.blurb}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="cr-description"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400"
                >
                  What happened?
                </label>
                <textarea
                  id="cr-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Describe the incident or concern. Include anything that could help responders — but only what you're comfortable sharing."
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cr-category"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400"
                  >
                    Category
                  </label>
                  <select
                    id="cr-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    {CATEGORIES.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="cr-location"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400"
                  >
                    Area / location (optional)
                  </label>
                  <Input
                    id="cr-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="e.g. Soweto, Zone 4"
                    className="h-11 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm font-medium text-rose-400">{error}</p>
              )}

              <Button
                onClick={() => void submit()}
                disabled={submitting}
                className="h-12 w-full bg-purple-600 text-sm font-bold hover:bg-purple-500"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Submitting…
                  </>
                ) : (
                  "Submit report"
                )}
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div>
              <label
                htmlFor="cr-track"
                className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400"
              >
                Your report reference
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="cr-track"
                  value={trackRef}
                  onChange={(event) => setTrackRef(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !tracking) void track();
                  }}
                  placeholder="CR-XXXXXXXX"
                  className="h-12 border-white/10 bg-slate-950/70 font-mono uppercase tracking-widest text-white"
                />
                <Button
                  onClick={() => void track()}
                  disabled={tracking}
                  className="h-12 min-w-[140px] bg-purple-600 font-bold hover:bg-purple-500"
                >
                  {tracking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="mr-1.5 h-4 w-4" /> Check status
                    </>
                  )}
                </Button>
              </div>
            </div>

            {trackError && (
              <p className="text-sm font-medium text-rose-400">{trackError}</p>
            )}

            {trackResult && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                <p className="font-mono text-sm font-bold tracking-widest text-purple-300">
                  {trackResult.reference}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 font-semibold capitalize text-white">
                      {trackResult.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      Category
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {trackResult.category ?? "—"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  A responder reviews every report. Status updates as the team
                  acts on it — check back anytime with this reference.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

export default CommunityReport;
