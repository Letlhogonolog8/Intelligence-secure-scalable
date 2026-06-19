import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, Printer } from "lucide-react";
import type { UserProfile, Organization } from "@/data/aegisData";

/**
 * Reports — generates real exports from the live admin datasets. CSV is a true
 * export; "Excel" emits CSV (opens in Excel); "PDF" uses the browser print
 * dialog (Save as PDF) until a document service is added.
 */

type AuditRow = Record<string, unknown>;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports({
  users,
  organizations,
  auditLogs,
  pendingApprovals,
}: {
  users: UserProfile[];
  organizations: Organization[];
  auditLogs: AuditRow[];
  pendingApprovals: number;
}) {
  const stamp = new Date().toISOString().slice(0, 10);

  const datasetFor = (category: string): Record<string, unknown>[] => {
    switch (category) {
      case "User Reports":
        return users.map((u) => ({
          id: u.id,
          name: u.fullName,
          role: u.role,
          organizationId: u.organizationId ?? "",
          active: u.isActive,
          approvalStatus: u.approvalStatus ?? "",
        }));
      case "NGO Reports":
        return organizations
          .filter(
            (o) => /ngo/i.test(o.type) || /ngo/i.test(o.organizationSubtype),
          )
          .map((o) => ({
            id: o.id,
            name: o.name,
            country: o.country,
            type: o.type,
            verified: o.isVerified,
          }));
      case "Operational Reports":
        return organizations.map((o) => ({
          id: o.id,
          name: o.name,
          country: o.country,
          type: o.type,
          verified: o.isVerified,
        }));
      case "System Reports":
      case "Compliance Reports":
      case "Incident Reports":
      case "Police Reports":
      case "Counselor Reports":
      default:
        return (auditLogs as Record<string, unknown>[]).slice(0, 500);
    }
  };

  const exportAs = (category: string, fmt: "csv" | "excel" | "pdf") => {
    const rows = datasetFor(category);
    if (fmt === "pdf") {
      window.print();
      return;
    }
    const csv = toCsv(rows);
    const ext = fmt === "excel" ? "xls" : "csv";
    download(
      `aegis-${category.toLowerCase().replace(/\s+/g, "-")}-${stamp}.${ext}`,
      csv || "No data available",
      fmt === "excel" ? "application/vnd.ms-excel" : "text/csv",
    );
  };

  const categories = [
    "Operational Reports",
    "User Reports",
    "Incident Reports",
    "NGO Reports",
    "Police Reports",
    "Counselor Reports",
    "System Reports",
    "Compliance Reports",
  ];

  const widgets = [
    { label: "Registered users", value: users.length },
    { label: "Active users", value: users.filter((u) => u.isActive).length },
    { label: "Organizations", value: organizations.length },
    { label: "Pending approvals", value: pendingApprovals },
    { label: "Audit events", value: auditLogs.length },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <h2 className="mb-1 text-lg font-black text-white">
          Dashboard widgets
        </h2>
        <p className="mb-5 text-xs text-slate-400">
          Live counts across the platform.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {widgets.map((w) => (
            <div
              key={w.label}
              className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <p className="text-2xl font-black text-white">{w.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{w.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <div className="mb-1 flex items-center gap-2">
          <FileText className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-black text-white">Report categories</h2>
        </div>
        <p className="mb-5 text-xs text-slate-400">
          Export the live dataset. CSV is a true export; Excel opens CSV in
          spreadsheets; PDF uses your browser's print/save dialog.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {categories.map((cat) => (
            <div
              key={cat}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-semibold text-white">{cat}</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200"
                  onClick={() => exportAs(cat, "csv")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200"
                  onClick={() => exportAs(cat, "excel")}
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200"
                  onClick={() => exportAs(cat, "pdf")}
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
