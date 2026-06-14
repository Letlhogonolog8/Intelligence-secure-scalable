import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/dashboard/DashboardPrimitives";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import {
  createSharedEvidenceUrl,
  sharedEvidenceKind,
  SHARED_EVIDENCE_QUERY_KEY,
  useSharedEvidence,
  type SharedEvidenceEntry,
} from "@/data/sharedEvidence";
import { formatRelativeDateTime } from "@/lib/dashboardMetrics";

/**
 * Shared survivor evidence inbox for responder dashboards.
 *
 * Lists evidence-vault items a survivor has explicitly consented to share with
 * their case team. Opening an item mints a short-lived signed URL; the moment a
 * survivor revokes consent the row disappears (realtime) and the URL stops
 * working. Responders never get blanket access to the vault — only the specific
 * files a survivor chose to share.
 */

const KIND_ICON = {
  image: ImageIcon,
  audio: Volume2,
  document: FileText,
} as const;

const SharedEvidencePanel: React.FC<{ className?: string }> = ({
  className,
}) => {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading, isError } = useSharedEvidence();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Realtime: a survivor sharing or revoking updates the inbox instantly.
  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("shared-evidence-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evidence_consents" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: SHARED_EVIDENCE_QUERY_KEY,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const openEntry = async (entry: SharedEvidenceEntry) => {
    setActionError(null);
    setOpeningId(entry.id);
    try {
      const url = await createSharedEvidenceUrl(entry.storagePath);
      if (!url) throw new Error("no signed url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setActionError(
        "Couldn't open that file. The survivor may have stopped sharing it.",
      );
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <GlassPanel
      className={className}
      icon={<ShieldCheck className="h-4 w-4 text-purple-400" />}
      title="Shared survivor evidence"
      subtitle="Vault items survivors have consented to share with their case team"
    >
      {actionError && (
        <p className="mb-3 text-xs font-medium text-rose-400">{actionError}</p>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading shared evidence…
        </p>
      ) : isError ? (
        <p className="py-6 text-xs font-medium text-rose-400">
          Couldn't load shared evidence. Please refresh shortly.
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-xs text-slate-400">
          No survivor has shared evidence yet. When a survivor shares a vault
          item from the mobile app, it appears here for their case team.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const Icon = KIND_ICON[sharedEvidenceKind(entry)];
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/50 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/15">
                  <Icon className="h-4 w-4 text-purple-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {entry.fileName ?? "Shared evidence"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Survivor {entry.survivorId.slice(0, 8)} ·{" "}
                    {formatRelativeDateTime(entry.grantedAt)}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      “{entry.note}”
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void openEntry(entry)}
                  disabled={openingId === entry.id}
                  className="h-8 shrink-0 border-white/10 bg-white/5 text-[11px] font-bold"
                >
                  {openingId === entry.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Open
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
};

export default SharedEvidencePanel;
