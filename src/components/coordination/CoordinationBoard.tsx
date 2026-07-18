import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  Loader2,
  Plus,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GlassPanel,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import {
  useOrganizationCoordination,
  useOrganizations,
} from "@/data/aegisData";
import { useLiveJusticeCases } from "@/data/liveDashboardData";
import {
  createHandoff,
  updateHandoffStatus,
  nextHandoffStatus,
  HANDOFF_REFERRAL_TYPES,
  HANDOFF_STATUS_TONE,
  type HandoffStatus,
} from "@/data/coordination";
import { formatRelativeDateTime } from "@/lib/dashboardMetrics";

/**
 * Multi-agency coordination center — a shared, realtime cross-org handoff board
 * (police ↔ NGO ↔ counselor). Lists handoffs the responder's organisation is a
 * party to (incoming / outgoing), lets them refer a case to another
 * organisation, and lets either party advance a handoff's status. Realtime via
 * organization_coordination; RLS keeps it to party organisations.
 */

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const CoordinationBoard: React.FC<{
  organizationId?: string | null;
  className?: string;
}> = ({ organizationId, className }) => {
  const queryClient = useQueryClient();
  const { data: handoffs = [], isLoading } = useOrganizationCoordination({
    limit: 100,
  });
  const { data: organizations = [] } = useOrganizations();
  const { data: cases = [] } = useLiveJusticeCases({ limit: 50 });

  const [showForm, setShowForm] = useState(false);
  const [toOrg, setToOrg] = useState("");
  const [caseId, setCaseId] = useState("");
  const [referralType, setReferralType] = useState<string>(
    HANDOFF_REFERRAL_TYPES[0],
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orgName = useMemo(() => {
    const map = new Map(organizations.map((o) => [o.id, o.name]));
    return (id: string) => map.get(id) || (id ? `Org ${id.slice(0, 8)}` : "—");
  }, [organizations]);

  const targetOrgs = useMemo(
    () => organizations.filter((o) => o.id !== organizationId),
    [organizations, organizationId],
  );

  const { incoming, outgoing } = useMemo(() => {
    const inc = handoffs.filter((h) => h.toOrganizationId === organizationId);
    const out = handoffs.filter((h) => h.fromOrganizationId === organizationId);
    return { incoming: inc, outgoing: out };
  }, [handoffs, organizationId]);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["aegis", "organizationCoordination"],
    });

  const submit = async () => {
    if (!organizationId || !toOrg || !caseId) {
      setError("Choose a destination organisation and a case.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createHandoff({
        fromOrganizationId: organizationId,
        toOrganizationId: toOrg,
        caseId,
        referralType,
        notes,
      });
      setToOrg("");
      setCaseId("");
      setNotes("");
      setReferralType(HANDOFF_REFERRAL_TYPES[0]);
      setShowForm(false);
      await refresh();
    } catch {
      setError("Couldn't send that handoff. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (id: string, next: HandoffStatus) => {
    setActingId(id);
    setError(null);
    try {
      await updateHandoffStatus(id, next);
      await refresh();
    } catch {
      setError("Couldn't update that handoff. Please try again.");
    } finally {
      setActingId(null);
    }
  };

  const renderRow = (h: (typeof handoffs)[number], direction: "in" | "out") => {
    const next = nextHandoffStatus(h.status);
    return (
      <li
        key={h.id}
        className="rounded-lg border border-white/10 bg-slate-950/50 p-3"
      >
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white">
            <span className="text-slate-300">
              {orgName(h.fromOrganizationId)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-slate-300">
              {orgName(h.toOrganizationId)}
            </span>
          </p>
          <StatusPill tone={HANDOFF_STATUS_TONE[h.status] ?? "slate"}>
            {titleCase(h.status)}
          </StatusPill>
        </div>
        <p className="text-[11px] text-slate-400">
          {titleCase(h.referralType || "referral")}
          {h.caseId ? ` · case ${h.caseId.slice(0, 12)}` : ""} ·{" "}
          {formatRelativeDateTime(h.createdAt)}
        </p>
        {h.notes ? (
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            {h.notes}
          </p>
        ) : null}
        {next ? (
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void advance(h.id, next)}
              disabled={actingId === h.id}
              className="h-8 border-purple-500/25 bg-purple-500/10 text-[11px] font-bold text-purple-200 hover:bg-purple-500/20"
            >
              {actingId === h.id ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {direction === "in" && h.status === "pending"
                ? "Acknowledge"
                : `Mark ${titleCase(next)}`}
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <GlassPanel
      className={className}
      icon={<ArrowLeftRight className="h-4 w-4 text-purple-400" />}
      title="Multi-agency coordination"
      subtitle="Refer cases between police, NGOs and counsellors — shared, in real time"
      action={
        organizationId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm((v) => !v)}
            className="h-8 border-white/10 bg-white/5 text-[11px] font-bold"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New handoff
          </Button>
        ) : undefined
      }
    >
      {!organizationId ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-xs text-slate-400">
          Your account isn't linked to an organisation, so formal org-to-org
          case handoffs aren't available here. The referral board below — NGO,
          shelter, hospital and legal-support requests — doesn't require an
          organisation link and works as normal.
        </div>
      ) : (
        <>
          {showForm && (
            <div className="mb-4 space-y-3 rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Refer to
                  <select
                    value={toOrg}
                    onChange={(e) => setToOrg(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-2 text-xs font-semibold text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    <option value="">Select organisation…</option>
                    {targetOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Case
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-2 text-xs font-semibold text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    <option value="">Select case…</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber || c.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Referral type
                  <select
                    value={referralType}
                    onChange={(e) => setReferralType(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-2 text-xs font-semibold text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    {HANDOFF_REFERRAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {titleCase(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Notes (optional)
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Context for the receiving team"
                    className="mt-1 h-10 border-white/10 bg-slate-950/70 text-xs text-white"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="h-9 border-white/10 bg-white/5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void submit()}
                  disabled={busy}
                  className="h-9 bg-purple-600 text-xs font-bold hover:bg-purple-500"
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send handoff
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="mb-3 text-xs font-medium text-rose-400">{error}</p>
          )}

          {isLoading ? (
            <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading handoffs…
            </p>
          ) : incoming.length === 0 && outgoing.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-xs text-slate-400">
              No active handoffs. Use “New handoff” to refer a case to another
              agency.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Incoming ({incoming.length})
                </p>
                {incoming.length === 0 ? (
                  <p className="text-xs text-slate-500">None.</p>
                ) : (
                  <ul className="space-y-2">
                    {incoming.map((h) => renderRow(h, "in"))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Outgoing ({outgoing.length})
                </p>
                {outgoing.length === 0 ? (
                  <p className="text-xs text-slate-500">None.</p>
                ) : (
                  <ul className="space-y-2">
                    {outgoing.map((h) => renderRow(h, "out"))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </GlassPanel>
  );
};

export default CoordinationBoard;
