import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Copy, Trash2, Shield } from "lucide-react";
import {
  ROLE_DEFINITIONS,
  MODULE_ACCESS,
  FEATURE_FLAGS,
  PERMISSIONS,
  type UserRole,
} from "@/lib/roleConfig";
import { MODULE_METADATA, MODULE_LIST } from "@/data/aegisData";

/**
 * Roles & Permissions — a read-only matrix rendered from the real RBAC config
 * (roleConfig.ts). No fabricated permissions: every cell reflects MODULE_ACCESS
 * / FEATURE_FLAGS / PERMISSIONS exactly as the platform enforces them.
 */

const ROLES = Object.keys(ROLE_DEFINITIONS) as UserRole[];

const ACCESS_TONE: Record<string, string> = {
  full: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  limited: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  readonly: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  none: "bg-slate-700/20 text-slate-500 border-white/10",
};

// Capability flags worth surfacing (real keys from FEATURE_FLAGS).
const CAPABILITIES: { key: string; label: string }[] = [
  { key: "can_create_users", label: "Create Users" },
  { key: "can_manage_roles", label: "Manage Roles" },
  { key: "can_export_data", label: "Export Reports" },
  { key: "can_view_audit_logs", label: "View Audit Logs" },
  { key: "can_view_all_chats", label: "View All Chats" },
  { key: "can_modify_policies", label: "Modify Policies" },
];

const Dot = ({ on }: { on: boolean }) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-400" : "bg-slate-600"}`}
    aria-label={on ? "Allowed" : "Denied"}
  />
);

export default function RolesMatrix() {
  return (
    <div className="space-y-6">
      {/* Module access matrix */}
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl overflow-hidden">
        <div className="mb-5 flex items-center gap-3">
          <Shield className="h-5 w-5 text-violet-300" />
          <div>
            <h2 className="text-lg font-black text-white">Module access</h2>
            <p className="text-xs text-slate-400">
              Live from MODULE_ACCESS — full / limited / read-only / none per
              role.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2 font-bold">Feature</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-bold">
                    {ROLE_DEFINITIONS[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_LIST.map((mod) => (
                <tr key={mod} className="border-t border-white/5">
                  <td className="px-3 py-2.5 font-medium text-slate-200">
                    {MODULE_METADATA[mod].label}
                  </td>
                  {ROLES.map((r) => {
                    const level = MODULE_ACCESS[r]?.[mod] ?? "none";
                    return (
                      <td key={r} className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ACCESS_TONE[level]}`}
                        >
                          {level}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Capability flags */}
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl overflow-hidden">
        <h2 className="mb-1 text-lg font-black text-white">Capabilities</h2>
        <p className="mb-5 text-xs text-slate-400">
          Live from FEATURE_FLAGS — administrative capabilities per role.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2 font-bold">Capability</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-bold">
                    {ROLE_DEFINITIONS[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap.key} className="border-t border-white/5">
                  <td className="px-3 py-2.5 font-medium text-slate-200">
                    {cap.label}
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <Dot on={Boolean(FEATURE_FLAGS[r]?.[cap.key])} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Access policies + custom role controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-black text-white">
            Access policies
          </h2>
          <div className="space-y-3">
            {ROLES.map((r) => {
              const p = PERMISSIONS[r];
              const scope = p.canViewAllData
                ? "All platform data"
                : p.jurisdictionScoped
                  ? "Assigned jurisdiction only"
                  : p.organizationScoped
                    ? "Own organization only"
                    : p.canViewOwnData
                      ? "Own records only"
                      : "Restricted";
              return (
                <div
                  key={r}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-white">
                    {ROLE_DEFINITIONS[r].label}
                  </span>
                  <span className="text-xs text-slate-400">{scope}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
          <h2 className="mb-1 text-lg font-black text-white">Custom roles</h2>
          <p className="mb-4 text-xs text-slate-400">
            Create, edit, clone, or delete roles. Backend persistence for custom
            roles is pending — these controls are wired and disabled until the
            role store ships.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Create Role", icon: Plus },
              { label: "Edit Role", icon: Pencil },
              { label: "Clone Role", icon: Copy },
              { label: "Delete Role", icon: Trash2 },
            ].map((a) => (
              <Button
                key={a.label}
                variant="outline"
                disabled
                className="h-11 justify-start border-white/10 bg-white/5 text-slate-300"
              >
                <a.icon className="mr-2 h-4 w-4" />
                {a.label}
              </Button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            The seven core roles above are enforced live across the platform via
            row-level security and module access controls.
          </p>
        </Card>
      </div>
    </div>
  );
}
