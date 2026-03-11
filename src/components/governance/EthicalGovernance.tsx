import React, { useState } from 'react';
import {
  useAuditLogs,
  useBiasReports,
  useDeletionRequests,
  useEscalationReviews,
  useEthicalConstraints,
  useFairnessMetrics,
  useGovernanceModels,
  useUserProfile,
} from '@/data/aegisData';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
  XCircleIcon,
} from '@/components/ui/AegisIcons';
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";

const EthicalGovernance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fairness' | 'privacy' | 'audit' | 'models' | 'escalations' | 'deletions' | 'monitoring'>('fairness');
  const [privacyEpsilon, setPrivacyEpsilon] = useState(1.0);
  const [federatedEnabled, setFederatedEnabled] = useState(true);
  const [updatingEscalationId, setUpdatingEscalationId] = useState<string | null>(null);
  const [updatingDeletionId, setUpdatingDeletionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { data: fairnessMetrics = [], isLoading: fairnessLoading, error: fairnessError } = useFairnessMetrics({ staleTime: 60000 });
  const { data: models = [], isLoading: modelsLoading, error: modelsError } = useGovernanceModels({ staleTime: 60000 });
  const { data: auditLogs = [], isLoading: auditLoading, error: auditError } = useAuditLogs({ staleTime: 30000, refetchInterval: 60000 });
  const { data: biasReports = [], isLoading: biasLoading, error: biasError } = useBiasReports({ staleTime: 60000 });
  const { data: ethicalConstraints = [], isLoading: constraintsLoading, error: constraintsError } = useEthicalConstraints({ staleTime: 60000 });
  const { data: escalationReviews = [], isLoading: escalationLoading, error: escalationError } = useEscalationReviews({ staleTime: 30000, refetchInterval: 60000 });
  const { data: deletionRequests = [], isLoading: deletionLoading, error: deletionError } = useDeletionRequests({ staleTime: 30000, refetchInterval: 60000 });
  const isLoadingData = fairnessLoading || modelsLoading || auditLoading || biasLoading || constraintsLoading || escalationLoading || deletionLoading;
  const hasData = fairnessMetrics.length > 0 || models.length > 0 || auditLogs.length > 0 || biasReports.length > 0 || ethicalConstraints.length > 0 || escalationReviews.length > 0 || deletionRequests.length > 0;
  const errorMessage = fairnessError?.message || modelsError?.message || auditError?.message || biasError?.message || constraintsError?.message || escalationError?.message || deletionError?.message;
  const canReviewEscalations = profile?.role === "admin" || profile?.role === "counselor";
  const isAdmin = profile?.role === "admin";
  const roleLabel = profile?.role ?? "unknown";

  const tabs = [
    { id: 'fairness' as const, label: 'Fairness & Bias', icon: ShieldIcon },
    { id: 'privacy' as const, label: 'Privacy Controls', icon: LockIcon },
    { id: 'audit' as const, label: 'Audit Trail', icon: FileTextIcon },
    { id: 'models' as const, label: 'Model Registry', icon: DatabaseIcon },
    { id: 'escalations' as const, label: 'Escalation Review', icon: AlertTriangleIcon },
    { id: 'deletions' as const, label: 'Deletion Requests', icon: XCircleIcon },
    { id: 'monitoring' as const, label: 'Monitoring', icon: ActivityIcon },
  ];

  const formatTimestamp = (value: string) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const escalationStatusClass = (status: string) => {
    if (status === "resolved") {
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    }
    if (status === "in_review") {
      return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    }
    return "bg-red-500/10 border-red-500/20 text-red-400";
  };

  const deletionStatusClass = (status: string) => {
    if (status === "processed") {
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    }
    if (status === "approved") {
      return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    }
    if (status === "rejected") {
      return "bg-slate-500/10 border-slate-500/20 text-slate-300";
    }
    return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  };

  const handleAuditExport = () => {
    if (auditLogs.length === 0) {
      return;
    }
    const rows = auditLogs.map((log) => ({
      time: log.time,
      action: log.action,
      module: log.module,
      user: log.user,
      severity: log.severity,
    }));
    const headers = Object.keys(rows[0]);
    const escapeValue = (value: unknown) => {
      const stringValue = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    };
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeValue(row[header as keyof typeof row])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEscalationUpdate = async (id: string, updates: Record<string, unknown>) => {
    setUpdatingEscalationId(id);
    const { error } = await supabase
      .from("escalation_reviews")
      .update(updates as never)
      .eq("id", id);
    if (error) {
      logError(error, { source: "escalation_review" });
      setUpdatingEscalationId(null);
      return;
    }
    logInfo("Escalation review updated", { escalationId: id });
    const { error: notifyError } = await supabase.functions.invoke("notify_counselor_assignment", {
      body: { review_id: id, updates },
    });
    if (notifyError) {
      logError(notifyError, { source: "escalation_notification" });
    }
    setUpdatingEscalationId(null);
  };

  const handleDeletionUpdate = async (id: string, updates: Record<string, unknown>) => {
    setUpdatingDeletionId(id);
    const { error } = await supabase
      .from("data_deletion_requests")
      .update(updates as never)
      .eq("id", id);
    if (error) {
      logError(error, { source: "deletion_request" });
    } else {
      logInfo("Deletion request updated", { deletionId: id });
    }
    setUpdatingDeletionId(null);
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-6">
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-200">
          {errorMessage}
        </div>
      )}
      {isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          Loading governance metrics...
        </div>
      )}
      {!isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          No governance data available yet. Connect Supabase tables to populate this view.
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Ethical AI & Governance Core</h2>
          <p className="text-sm text-slate-500">Fairness evaluation, differential privacy, federated learning, and compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircleIcon size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">GDPR/POPIA Compliant</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Fairness Tab */}
      {activeTab === 'fairness' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Fairness Metrics Grid */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Fairness Evaluation Metrics</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  <RefreshIcon size={12} />
                  Run Audit
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fairnessMetrics.map((metric, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${
                    metric.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-amber-500/5 border-amber-500/10'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-medium">{metric.metric}</span>
                      {metric.status === 'pass' ? (
                        <CheckCircleIcon size={16} className="text-emerald-400" />
                      ) : (
                        <AlertTriangleIcon size={16} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={`text-2xl font-bold ${metric.status === 'pass' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {metric.metric === 'Gender Bias Index' ? metric.score.toFixed(2) : (metric.score * 100).toFixed(1)}
                        {metric.metric !== 'Gender Bias Index' && '%'}
                      </span>
                      <span className="text-[10px] text-slate-500 mb-1">
                        threshold: {metric.metric === 'Gender Bias Index' ? `< ${metric.threshold}` : `> ${(metric.threshold * 100).toFixed(0)}%`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${metric.status === 'pass' ? 'bg-emerald-500/60' : 'bg-amber-500/60'}`}
                        style={{ width: `${metric.metric === 'Gender Bias Index' ? (1 - metric.score / metric.threshold) * 100 : (metric.score / 1) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bias Detection Report */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Bias Detection Report</h3>
              <div className="space-y-3">
                {biasReports.map((item, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    item.severity === 'pass' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-amber-500/5 border-amber-500/10'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {item.severity === 'pass' ? <CheckCircleIcon size={14} className="text-emerald-400" /> : <AlertTriangleIcon size={14} className="text-amber-400" />}
                      <span className="text-xs text-white font-medium">{item.model}</span>
                    </div>
                    <p className="text-xs text-slate-400 ml-6">{item.finding}</p>
                    <p className="text-[10px] text-slate-500 ml-6 mt-1">Recommendation: {item.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl p-6 text-center">
              <h4 className="text-sm text-slate-400 mb-2">Overall Fairness Score</h4>
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(30 41 59)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#10B981" strokeWidth="8" strokeDasharray={`${(fairnessMetrics.length ? fairnessMetrics.filter((metric) => metric.status === 'pass').length / fairnessMetrics.length : 0) * 264} 264`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-emerald-400">
                    {Math.round((fairnessMetrics.length ? fairnessMetrics.filter((metric) => metric.status === 'pass').length / fairnessMetrics.length : 0) * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {fairnessMetrics.filter((metric) => metric.status === 'pass').length}/{fairnessMetrics.length || 0} metrics passing threshold
              </p>
              <p className="text-[10px] text-amber-400 mt-1">
                {fairnessMetrics.filter((metric) => metric.status !== 'pass').length} metrics require attention
              </p>
            </div>

            {/* Ethical Constraints */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="text-white font-semibold text-sm mb-3">Ethical Constraints</h4>
              <div className="space-y-2">
                {ethicalConstraints.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className={item.active ? 'text-emerald-400' : 'text-slate-600'} />
                    <span className="text-xs text-slate-400">{item.constraint}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Differential Privacy */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-4">Differential Privacy Controls</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Privacy Budget (Epsilon)</span>
                    <span className="text-sm text-white font-mono">{privacyEpsilon.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={privacyEpsilon}
                    onChange={(e) => setPrivacyEpsilon(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Maximum Privacy (0.1)</span>
                    <span>Maximum Utility (10.0)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Current setting: {privacyEpsilon <= 1 ? 'Strong privacy guarantee' : privacyEpsilon <= 5 ? 'Moderate privacy' : 'Weak privacy, high utility'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Noise Mechanism', value: 'Gaussian' },
                    { label: 'Delta', value: '1e-5' },
                    { label: 'Composition', value: 'Advanced' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-800/30 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500">{item.label}</p>
                      <p className="text-sm text-white font-mono">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Federated Learning */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Federated Learning Architecture</h3>
                <button
                  onClick={() => setFederatedEnabled(!federatedEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-all ${federatedEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${federatedEnabled ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              {federatedEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Active Nodes', value: '18' },
                      { label: 'Last Round', value: '12 min ago' },
                      { label: 'Aggregation', value: 'FedAvg' },
                      { label: 'Rounds Complete', value: '847' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-800/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-slate-500">{item.label}</p>
                        <p className="text-sm text-white font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-2">Country Node Status</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['South Africa', 'Kenya', 'Nigeria', 'Ghana', 'Egypt', 'DRC', 'Tanzania', 'Ethiopia', 'Morocco'].map((country, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${i < 7 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="text-[10px] text-slate-400">{country}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data Anonymization */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Data Anonymization Pipeline</h3>
              <div className="space-y-2">
                {[
                  { step: 'PII Removal', status: 'active', description: 'Names, addresses, phone numbers stripped' },
                  { step: 'K-Anonymity (k=5)', status: 'active', description: 'Quasi-identifiers generalized' },
                  { step: 'L-Diversity (l=3)', status: 'active', description: 'Sensitive attribute diversity ensured' },
                  { step: 'T-Closeness', status: 'active', description: 'Distribution distance maintained' },
                  { step: 'Synthetic Data Generation', status: 'active', description: 'Differentially private synthetic records' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-800/20 rounded-lg">
                    <CheckCircleIcon size={14} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium">{item.step}</p>
                      <p className="text-[10px] text-slate-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="text-white font-semibold text-sm mb-3">Encryption Status</h4>
              <div className="space-y-2">
                {[
                  { label: 'Data at Rest', value: 'AES-256-GCM', status: 'active' },
                  { label: 'Data in Transit', value: 'TLS 1.3', status: 'active' },
                  { label: 'Key Management', value: 'AWS KMS', status: 'active' },
                  { label: 'Certificate', value: 'Valid (342 days)', status: 'active' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-800/20 rounded-lg">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 font-mono">{item.value}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="text-white font-semibold text-sm mb-3">Consent Management</h4>
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-white">98.4%</p>
                  <p className="text-xs text-slate-500">Active consent rate</p>
                </div>
                <div className="space-y-1">
                  {[
                    { label: 'Active consents', value: '12,634' },
                    { label: 'Revoked (30d)', value: '204' },
                    { label: 'Pending review', value: '13' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-white font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Audit Trail (5-Year Retention)</h3>
            <button
              onClick={handleAuditExport}
              disabled={auditLogs.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <DownloadIcon size={12} />
              Export Logs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/50">
                  {['Time', 'Action', 'Module', 'User', 'Severity'].map(h => (
                    <th key={h} className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{log.time}</td>
                    <td className="px-4 py-2.5 text-xs text-white">{log.action}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{log.module}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{log.user}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        log.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                        log.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>{log.severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/50">
              <h3 className="text-white font-semibold text-sm">Versioned Model Registry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    {['Model', 'Version', 'Module', 'Status', 'Accuracy', 'Fairness', 'Drift', 'Actions'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {models.map((model, i) => (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-white font-medium">{model.name}</td>
                      <td className="px-4 py-3 text-xs text-indigo-400 font-mono">{model.version}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{model.module}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          model.status === 'deployed' ? 'bg-emerald-500/10 text-emerald-400' :
                          model.status === 'validating' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>{model.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white font-mono">{model.accuracy}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${model.fairness >= 0.85 ? 'bg-emerald-500/60' : 'bg-amber-500/60'}`}
                              style={{ width: `${model.fairness * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{(model.fairness * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${model.drift > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {model.drift.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="text-indigo-400 hover:text-indigo-300 transition-colors" title="View model card">
                            <EyeIcon size={14} />
                          </button>
                          <button className="text-slate-500 hover:text-white transition-colors" title="Download">
                            <DownloadIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'escalations' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold text-sm">Counselor Escalation Queue</h3>
              <p className="text-xs text-slate-500">Role: {roleLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Access</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${canReviewEscalations ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {canReviewEscalations ? 'Counselor/Admin' : 'Restricted'}
              </span>
            </div>
          </div>
          {!canReviewEscalations && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-200">
              Escalation reviews require counselor or admin access.
            </div>
          )}
          {canReviewEscalations && escalationReviews.length === 0 && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
              No escalation reviews in the queue.
            </div>
          )}
          {canReviewEscalations && escalationReviews.length > 0 && (
            <div className="space-y-3">
              {escalationReviews.map((review) => {
                const isUpdating = updatingEscalationId === review.id;
                return (
                  <div key={review.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Session</span>
                          <span className="text-xs text-white font-mono">{review.sessionId}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>Risk: <span className="text-white">{review.riskLevel || 'unknown'}</span></span>
                          <span>Emotion: <span className="text-white">{review.emotionDetected || 'unknown'}</span></span>
                          <span>Assigned: <span className="text-white">{review.assignedTo || 'unassigned'}</span></span>
                        </div>
                        <div className="text-[10px] text-slate-500">Opened {formatTimestamp(review.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${escalationStatusClass(review.status || 'pending')}`}>
                          {review.status || 'pending'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {user?.id && !review.assignedTo && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleEscalationUpdate(review.id, { assigned_to: user.id, status: review.status || 'pending', updated_at: new Date().toISOString() })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500/60 disabled:opacity-50"
                        >
                          Assign to me
                        </button>
                      )}
                      {review.status !== 'in_review' && review.status !== 'resolved' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleEscalationUpdate(review.id, { status: 'in_review', updated_at: new Date().toISOString() })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 text-amber-300 hover:text-white hover:border-amber-400/60 disabled:opacity-50"
                        >
                          Mark in review
                        </button>
                      )}
                      {review.status !== 'resolved' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleEscalationUpdate(review.id, { status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-300 hover:text-white hover:border-emerald-400/60 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deletions' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold text-sm">Data Deletion Requests</h3>
              <p className="text-xs text-slate-500">Role: {roleLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Access</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${isAdmin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {isAdmin ? 'Admin' : 'Read-only'}
              </span>
            </div>
          </div>
          {deletionRequests.length === 0 && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
              No deletion requests submitted.
            </div>
          )}
          {deletionRequests.length > 0 && (
            <div className="space-y-3">
              {deletionRequests.map((request) => {
                const isUpdating = updatingDeletionId === request.id;
                return (
                  <div key={request.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400">Request ID</div>
                        <div className="text-xs text-white font-mono">{request.id}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>User: <span className="text-white">{request.userId || 'anonymous'}</span></span>
                          <span>Survivor: <span className="text-white">{request.survivorId || 'n/a'}</span></span>
                        </div>
                        <div className="text-[10px] text-slate-500">Requested {formatTimestamp(request.requestedAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${deletionStatusClass(request.status || 'pending')}`}>
                          {request.status || 'pending'}
                        </span>
                      </div>
                    </div>
                    {request.reason && (
                      <div className="text-xs text-slate-500 mt-3">Reason: {request.reason}</div>
                    )}
                    {isAdmin && request.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleDeletionUpdate(request.id, { status: 'approved', processed_by: user?.id ?? null, processed_at: new Date().toISOString() })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-300 hover:text-white hover:border-emerald-400/60 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleDeletionUpdate(request.id, { status: 'rejected', processed_by: user?.id ?? null, processed_at: new Date().toISOString() })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-300 hover:text-white hover:border-red-400/60 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold text-sm">Observability Status</h3>
              <p className="text-xs text-slate-500">Datadog and client log pipeline</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${env.VITE_DATADOG_LOGS_ENDPOINT ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {env.VITE_DATADOG_LOGS_ENDPOINT ? 'Datadog connected' : 'Datadog not configured'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Datadog Logs Endpoint</p>
              <p className="text-xs text-white break-all mt-1">{env.VITE_DATADOG_LOGS_ENDPOINT ?? 'Not configured'}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Client Log Endpoint</p>
              <p className="text-xs text-white break-all mt-1">{env.VITE_LOG_ENDPOINT ?? 'Not configured'}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Sample Rate</p>
              <p className="text-2xl text-white font-bold mt-1">{((env.VITE_LOG_SAMPLE_RATE ?? 1) * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-slate-500 mt-1">Service: {env.VITE_DATADOG_SERVICE ?? 'aegis-web'}</p>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
            Monitoring events are emitted from the client logger for auth, query, and runtime errors.
          </div>
        </div>
      )}
    </div>
  );
};

export default EthicalGovernance;
