import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  HeartHandshake,
  Loader2,
  Megaphone,
  TriangleAlert,
} from "lucide-react";
import {
  GlassPanel,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import {
  COMMUNITY_REPORTS_QUERY_KEY,
  RELATIONSHIP_LABEL,
  useCommunityReports,
  type CommunityReportEntry,
} from "@/data/communityReports";
import { formatRelativeDateTime } from "@/lib/dashboardMetrics";

/**
 * Community & witness reports inbox for responder dashboards.
 *
 * Lists account-free reports filed via the public Community Reporting page
 * (report_method = 'community_web'). Updates live via the case_reports realtime
 * publication; survivor-filed reports stay private to their author.
 */

const RELATIONSHIP_ICON = {
  on_behalf: HeartHandshake,
  witness: Eye,
  concern: TriangleAlert,
} as const;

const relationshipIcon = (entry: CommunityReportEntry) =>
  entry.relationship ? RELATIONSHIP_ICON[entry.relationship] : Megaphone;

const priorityTone = (priority: string | null) =>
  priority === "critical" || priority === "high"
    ? "rose"
    : priority === "low"
      ? "slate"
      : "amber";

const CommunityReportsPanel: React.FC<{ className?: string }> = ({
  className,
}) => {
  const queryClient = useQueryClient();
  const { data: reports = [], isLoading, isError } = useCommunityReports();

  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("community-reports-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_reports" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: COMMUNITY_REPORTS_QUERY_KEY,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <GlassPanel
      className={className}
      icon={<Megaphone className="h-4 w-4 text-purple-400" />}
      title="Community & witness reports"
      subtitle="Account-free reports from community members, witnesses, and bystanders"
    >
      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading community
          reports…
        </p>
      ) : isError ? (
        <p className="py-6 text-xs font-medium text-rose-400">
          Couldn't load community reports. Please refresh shortly.
        </p>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-xs text-slate-400">
          No community reports yet. Reports filed from the public Community
          Reporting page appear here in real time.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const Icon = relationshipIcon(report);
            return (
              <li
                key={report.id}
                className="rounded-lg border border-white/10 bg-slate-950/50 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-purple-400" />
                    {report.relationship
                      ? RELATIONSHIP_LABEL[report.relationship]
                      : "Community report"}
                    {report.reference ? (
                      <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold normal-case tracking-normal text-purple-300">
                        {report.reference}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-2">
                    {report.priority ? (
                      <StatusPill tone={priorityTone(report.priority)}>
                        {report.priority}
                      </StatusPill>
                    ) : null}
                    <StatusPill tone="sky">{report.status}</StatusPill>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {report.description}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {report.category ?? "Uncategorized"}
                  {report.locationText
                    ? ` · ${report.locationText}`
                    : ""} · {formatRelativeDateTime(report.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
};

export default CommunityReportsPanel;
