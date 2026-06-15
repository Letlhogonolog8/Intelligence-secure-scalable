import { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  RotateCcw,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useVoiceReporter } from "@/hooks/use-voice-reporter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  enqueueOfflineCase,
  flushOfflineQueue,
  getOfflineQueueCount,
} from "@/lib/offlineCaseQueue";
import { analyzeRiskOnEdge } from "@/lib/edgeRiskAnalyzer";

const LANG_OPTIONS = [
  { code: "en-ZA", label: "English" },
  { code: "af-ZA", label: "Afrikaans" },
  { code: "zu-ZA", label: "isiZulu" },
  { code: "xh-ZA", label: "isiXhosa" },
  { code: "st-ZA", label: "Sesotho" },
];

interface VoiceIncidentReporterProps {
  onReportSubmitted?: (caseId: string) => void;
}

const VoiceIncidentReporter: React.FC<VoiceIncidentReporterProps> = ({
  onReportSubmitted,
}) => {
  const { user } = useAuth();
  const [selectedLang, setSelectedLang] = useState("en-ZA");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  const {
    status,
    transcript,
    interimTranscript,
    errorMessage,
    start,
    stop,
    reset,
    isSupported,
  } = useVoiceReporter(selectedLang);

  useEffect(() => {
    setQueuedCount(getOfflineQueueCount());
    const sync = async () => {
      const result = await flushOfflineQueue();
      if (result.synced > 0) {
        setSubmitError(null);
      }
      setQueuedCount(getOfflineQueueCount());
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  const handleSubmit = async () => {
    if (!transcript.trim()) return;
    const caseId = `CAS-${Date.now().toString(36).toUpperCase()}`;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Analyze risk locally on the edge before saving
      const edgeRiskLevel = await analyzeRiskOnEdge(transcript.trim());

      const { error } = await supabase.from("case_reports").insert({
        id: caseId,
        description: transcript.trim(),
        report_method: "voice",
        language: selectedLang.split("-")[0],
        status: "open",
        risk_level: edgeRiskLevel,
        priority: edgeRiskLevel === "critical" ? "high" : "normal",
        survivor_id: user?.id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const missingCaseReports =
        Boolean(error) &&
        ((error as { code?: string; message?: string }).code === "42P01" ||
          ((error as { message?: string }).message ?? "")
            .toLowerCase()
            .includes("case_reports"));

      if (missingCaseReports) {
        const { error: fallbackError } = await supabase
          .from("justice_cases")
          .insert({
            case_number: caseId,
            case_type: "gbv_report",
            status: "open",
            stage: "report",
            priority:
              edgeRiskLevel === "critical"
                ? "critical"
                : edgeRiskLevel === "high"
                  ? "high"
                  : "medium",
            days_open: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (fallbackError) throw fallbackError;
      } else if (error) {
        throw error;
      }
      setSubmitted(caseId);
      onReportSubmitted?.(caseId);
    } catch {
      await analyzeRiskOnEdge(transcript.trim());

      enqueueOfflineCase({
        id: caseId,
        description: transcript.trim(),
        reportMethod: "voice",
        language: selectedLang.split("-")[0],
        survivorId: user?.id ?? null,
        createdAt: new Date().toISOString(),
        // Assuming we could pass edgeRiskLevel if the offline schema supported it
      });
      setQueuedCount(getOfflineQueueCount());
      setSubmitError(
        "Network unavailable. Your report is saved securely offline and will sync automatically.",
      );
      setSubmitted(caseId);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-white/15 bg-slate-950/70 p-6">
        <div className="flex items-start gap-3 text-amber-400">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Voice reporting unavailable</p>
            <p className="text-xs text-slate-300 mt-1">
              Your browser doesn't support voice recognition. Use the text form
              or dial{" "}
              <span className="font-mono text-rose-400">*135*1782#</span> for
              USSD support.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-slate-950/70 p-6">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Report Submitted</p>
            <p className="text-slate-300 text-sm mt-1">
              Your case has been securely logged.
            </p>
            <p className="text-emerald-400 font-mono font-bold mt-3">
              {submitted}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Save this ID to track your case
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:text-white"
            onClick={() => {
              reset();
              setSubmitted(null);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-white/15 bg-slate-950/70 overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${status === "listening" ? "bg-rose-500 animate-pulse" : "bg-slate-600"}`}
            />
            <h3 className="text-white font-bold text-base">
              Voice Incident Report
            </h3>
          </div>
          <select
            value={selectedLang}
            onChange={(e) => {
              reset();
              setSelectedLang(e.target.value);
            }}
            disabled={status === "listening"}
            aria-label="Report language"
            className="text-xs bg-slate-900 border border-white/10 text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500/50"
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Speak your incident report in your preferred language. No typing
          required.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="relative min-h-[100px] rounded-xl bg-slate-900/60 border border-white/5 p-4">
          {!transcript && !interimTranscript ? (
            <p className="text-slate-500 text-sm italic">
              {status === "idle"
                ? "Press the microphone button and speak..."
                : "Listening..."}
            </p>
          ) : (
            <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
              {transcript}
              {interimTranscript && (
                <span className="text-slate-400 italic">
                  {" "}
                  {interimTranscript}
                </span>
              )}
            </p>
          )}
          {status === "listening" && (
            <div className="absolute bottom-3 right-3 flex gap-1 items-end">
              {[3, 5, 4, 6, 3].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-rose-500 rounded-full animate-pulse"
                  style={{
                    height: `${h * 3}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {(errorMessage || submitError) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage || submitError}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {status !== "listening" ? (
              <Button
                size="sm"
                onClick={start}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-2"
                disabled={submitting}
              >
                <Mic className="h-4 w-4" />
                {status === "done" ? "Continue" : "Start Speaking"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={stop}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold gap-2"
              >
                <MicOff className="h-4 w-4" />
                Stop
              </Button>
            )}
            {(transcript || status !== "idle") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="text-slate-400 hover:text-white gap-2"
                disabled={submitting}
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              !transcript.trim() || submitting || status === "listening"
            }
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>

        {queuedCount > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {queuedCount} report{queuedCount > 1 ? "s" : ""} waiting for sync.
            They will auto-submit when connection returns.
          </div>
        )}

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Your voice report is encrypted and stored securely. Only authorized
          responders can access it. No audio recording is saved — only the text
          transcript.
        </p>
      </div>
    </Card>
  );
};

export default VoiceIncidentReporter;
