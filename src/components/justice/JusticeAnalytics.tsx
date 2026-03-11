import React, { useEffect, useMemo, useState } from 'react';
import { useJusticeBottlenecks, useJusticeCases, useJusticeConvictions, RISK_COLORS, RiskLevel } from '@/data/aegisData';
import {
  SearchIcon, DownloadIcon, EyeIcon,
  AlertTriangleIcon, XIcon
} from '@/components/ui/AegisIcons';

const JusticeAnalytics: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    try {
      const stored = localStorage.getItem('aegis_justice_status');
      return stored ?? 'all';
    } catch {
      return 'all';
    }
  });
  const [filterPriority, setFilterPriority] = useState<RiskLevel | 'all'>(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    try {
      const stored = localStorage.getItem('aegis_justice_priority');
      if (stored === 'critical' || stored === 'high' || stored === 'medium' || stored === 'low' || stored === 'all') {
        return stored;
      }
      return 'all';
    } catch {
      return 'all';
    }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    try {
      return localStorage.getItem('aegis_justice_search') ?? '';
    } catch {
      return '';
    }
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);

  const handlePriorityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as RiskLevel | 'all';
    setFilterPriority(value);
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(event.target.value);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('aegis_justice_status', filterStatus);
      localStorage.setItem('aegis_justice_priority', filterPriority);
      localStorage.setItem('aegis_justice_search', searchQuery);
    } catch {
      return;
    }
  }, [filterStatus, filterPriority, searchQuery]);

  const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();
  const { data: justiceCases = [], isLoading: casesLoading, error: casesError } = useJusticeCases({ staleTime: 60000 });
  const { data: convictionData = [], isLoading: convictionLoading, error: convictionError } = useJusticeConvictions({ staleTime: 60000 });
  const { data: bottlenecks = [], isLoading: bottlenecksLoading, error: bottlenecksError } = useJusticeBottlenecks({ staleTime: 60000 });
  const isLoadingData = casesLoading || convictionLoading || bottlenecksLoading;
  const hasData = justiceCases.length > 0 || convictionData.length > 0 || bottlenecks.length > 0;
  const errorMessage = casesError?.message || convictionError?.message || bottlenecksError?.message;

  const statusOptions = useMemo(
    () => Array.from(new Set(justiceCases.map((item) => item.status))).sort(),
    [justiceCases]
  );

  const highlightText = (value: string) => {
    if (!normalizedQuery) {
      return value;
    }
    const index = value.toLowerCase().indexOf(normalizedQuery);
    if (index === -1) {
      return value;
    }
    return (
      <>
        <span>{value.slice(0, index)}</span>
        <span className="text-indigo-300">{value.slice(index, index + normalizedQuery.length)}</span>
        <span>{value.slice(index + normalizedQuery.length)}</span>
      </>
    );
  };

  const filteredCases = useMemo(() => (
    justiceCases.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
      if (normalizedQuery && !c.caseNumber.toLowerCase().includes(normalizedQuery) && !c.type.toLowerCase().includes(normalizedQuery) && !c.region.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    })
  ), [filterStatus, filterPriority, normalizedQuery, justiceCases]);

  const caseStats = {
    total: justiceCases.length,
    investigation: justiceCases.filter(c => c.stage === 'investigation').length,
    preTrial: justiceCases.filter(c => c.stage === 'pre-trial').length,
    prosecution: justiceCases.filter(c => c.stage === 'prosecution').length,
    resolved: justiceCases.filter(c => c.stage === 'sentencing' || c.stage === 'mediation').length,
    avgDays: justiceCases.length ? Math.round(justiceCases.reduce((sum, c) => sum + c.daysOpen, 0) / justiceCases.length) : 0,
  };

  const selectedCaseData = selectedCase ? justiceCases.find(c => c.id === selectedCase) : null;

  const stageColors: Record<string, string> = {
    investigation: '#F59E0B',
    'pre-trial': '#F97316',
    prosecution: '#3B82F6',
    sentencing: '#8B5CF6',
    mediation: '#10B981',
  };

  const handleExport = () => {
    if (filteredCases.length === 0) {
      return;
    }
    const rows = filteredCases.map((caseItem) => ({
      caseNumber: caseItem.caseNumber,
      type: caseItem.type,
      region: caseItem.region,
      status: caseItem.status,
      stage: caseItem.stage,
      priority: caseItem.priority,
      daysOpen: caseItem.daysOpen,
      assignedTo: caseItem.assignedTo,
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
    link.download = "justice-cases.csv";
    link.click();
    URL.revokeObjectURL(url);
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
          Loading justice analytics...
        </div>
      )}
      {!isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          No justice data available yet. Connect Supabase tables to populate this view.
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Justice & Institutional Analytics</h2>
          <p className="text-sm text-slate-500">Case workflow optimization with SHAP explainability</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={filteredCases.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <DownloadIcon size={14} />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Cases', value: caseStats.total, color: 'text-white', bg: 'from-slate-500/20 to-slate-600/20' },
          { label: 'Investigation', value: caseStats.investigation, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/20' },
          { label: 'Pre-Trial', value: caseStats.preTrial, color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/20' },
          { label: 'In Prosecution', value: caseStats.prosecution, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/20' },
          { label: 'Resolved', value: caseStats.resolved, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-600/20' },
          { label: 'Avg Duration', value: `${caseStats.avgDays}d`, color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-600/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Pipeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Case Flow Visualization */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-4">Case Pipeline Flow</h3>
            <div className="flex items-center gap-2">
              {[
                { stage: 'Investigation', count: caseStats.investigation, color: '#F59E0B' },
                { stage: 'Pre-Trial', count: caseStats.preTrial, color: '#F97316' },
                { stage: 'Prosecution', count: caseStats.prosecution, color: '#3B82F6' },
                { stage: 'Resolution', count: caseStats.resolved, color: '#10B981' },
              ].map((stage, i) => (
                <React.Fragment key={i}>
                  <div className="flex-1 text-center">
                    <div className="h-16 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: `${stage.color}15`, border: `1px solid ${stage.color}30` }}>
                      <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${stage.color}20, transparent)` }} />
                      <div className="relative">
                        <p className="text-xl font-bold text-white">{stage.count}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">{stage.stage}</p>
                  </div>
                  {i < 3 && (
                    <div className="text-slate-600 flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Case Table */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-white font-semibold text-sm">Active Cases</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cases..."
                    aria-label="Search cases"
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30 w-40"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={handleStatusChange}
                  aria-label="Filter by status"
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={filterPriority}
                  onChange={handlePriorityChange}
                  aria-label="Filter by priority"
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
                >
                  <option value="all">All Priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    {['Case #', 'Type', 'Region', 'Status', 'Stage', 'Days Open', 'Priority', 'Action'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-indigo-400 font-mono">{highlightText(c.caseNumber)}</td>
                      <td className="px-4 py-2.5 text-xs text-white">{highlightText(c.type)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{highlightText(c.region)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{c.status}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          backgroundColor: `${stageColors[c.stage] || '#6366F1'}15`,
                          color: stageColors[c.stage] || '#6366F1',
                        }}>{c.stage}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white font-mono">{c.daysOpen}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border"
                          style={{ color: RISK_COLORS[c.priority], borderColor: `${RISK_COLORS[c.priority]}40`, backgroundColor: `${RISK_COLORS[c.priority]}10` }}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => { setSelectedCase(c.id); setShowCaseDetail(true); }}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <EyeIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Conviction Rate Analysis */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Conviction Rate by Region</h4>
            <div className="space-y-3">
              {convictionData.map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{item.region}</span>
                    <span className="text-xs text-white font-mono">{item.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${item.rate}%`,
                      backgroundColor: item.rate > 60 ? '#10B981' : item.rate > 45 ? '#F59E0B' : '#EF4444',
                    }} />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">{item.cases} cases analyzed</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottleneck Detection */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangleIcon size={16} className="text-amber-400" />
              <h4 className="text-white font-semibold text-sm">Bottleneck Detection</h4>
            </div>
            <div className="space-y-2">
              {bottlenecks.map((b, i) => (
                <div key={i} className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white font-medium">{b.stage}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      b.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                      b.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>{b.avgDelay}d avg delay</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{b.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SHAP Explainability */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">SHAP Feature Importance</h4>
            <p className="text-[10px] text-slate-500 mb-3">Key factors affecting case outcomes</p>
            <div className="space-y-2">
              {[
                { feature: 'Evidence Quality', importance: 0.34, direction: 'positive' },
                { feature: 'Time to Report', importance: 0.22, direction: 'negative' },
                { feature: 'Legal Representation', importance: 0.18, direction: 'positive' },
                { feature: 'Witness Availability', importance: 0.14, direction: 'positive' },
                { feature: 'Court Backlog', importance: 0.08, direction: 'negative' },
                { feature: 'Region', importance: 0.04, direction: 'neutral' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-28 truncate">{f.feature}</span>
                  <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full ${
                      f.direction === 'positive' ? 'bg-blue-500/60' :
                      f.direction === 'negative' ? 'bg-red-500/60' : 'bg-slate-500/60'
                    }`} style={{ width: `${f.importance * 100 * 2.5}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-8 text-right">{(f.importance * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Case Detail Modal */}
      {showCaseDetail && selectedCaseData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">{selectedCaseData.caseNumber}</h3>
                <p className="text-xs text-slate-500">{selectedCaseData.type} | {selectedCaseData.region}</p>
              </div>
              <button onClick={() => setShowCaseDetail(false)} className="text-slate-500 hover:text-white transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">Status</p>
                  <p className="text-sm text-white font-medium">{selectedCaseData.status}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">Stage</p>
                  <p className="text-sm text-white font-medium capitalize">{selectedCaseData.stage}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">Days Open</p>
                  <p className="text-sm text-white font-medium">{selectedCaseData.daysOpen}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">Assigned To</p>
                  <p className="text-sm text-white font-medium">{selectedCaseData.assignedTo}</p>
                </div>
              </div>
              {/* Timeline */}
              <div>
                <h4 className="text-sm text-white font-medium mb-3">Case Timeline</h4>
                <div className="space-y-3">
                  {[
                    { date: '2026-01-15', event: 'Incident Reported', status: 'complete' },
                    { date: '2026-01-16', event: 'Case Filed', status: 'complete' },
                    { date: '2026-01-20', event: 'Investigation Opened', status: 'complete' },
                    { date: '2026-02-01', event: 'Evidence Collected', status: 'complete' },
                    { date: '2026-02-10', event: 'Awaiting Court Date', status: 'current' },
                    { date: 'TBD', event: 'Trial', status: 'pending' },
                    { date: 'TBD', event: 'Resolution', status: 'pending' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          item.status === 'complete' ? 'bg-emerald-500 border-emerald-500' :
                          item.status === 'current' ? 'bg-blue-500 border-blue-500 animate-pulse' :
                          'bg-transparent border-slate-600'
                        }`} />
                        {i < 6 && <div className="w-px h-6 bg-slate-700" />}
                      </div>
                      <div className="-mt-0.5">
                        <p className={`text-xs ${item.status === 'pending' ? 'text-slate-600' : 'text-white'}`}>{item.event}</p>
                        <p className="text-[10px] text-slate-500">{item.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm hover:bg-blue-500/20 transition-all">
                  Generate Legal Draft
                </button>
                <button className="flex-1 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 text-sm hover:bg-purple-500/20 transition-all">
                  SHAP Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JusticeAnalytics;
