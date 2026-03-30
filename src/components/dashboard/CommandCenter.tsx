import React, { useEffect, useMemo, useState } from 'react';
import HotspotHeatmap from "@/components/analytics/HotspotHeatmap";
import {
  useAlertsFeed,
  useContinentalStats,
  useIncidentTimeSeries,
  useRegions,
  useSystemMetrics,
  RISK_COLORS,
  RiskLevel
} from '@/data/aegisData';
import {
  ShieldIcon, AlertTriangleIcon, UsersIcon, MapPinIcon,
  ActivityIcon, GlobeIcon, TrendUpIcon, TrendDownIcon,
  DatabaseIcon, ZapIcon, LayersIcon,
  CheckCircleIcon
} from '@/components/ui/AegisIcons';
import { Skeleton } from "@/components/ui/skeleton";

const CommandCenter: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem('aegis_command_region');
    } catch {
      return null;
    }
  });
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>(() => {
    if (typeof window === 'undefined') {
      return '7d';
    }
    try {
      const stored = localStorage.getItem('aegis_command_range');
      if (stored === '24h' || stored === '7d' || stored === '30d' || stored === '90d') {
        return stored;
      }
      return '7d';
    } catch {
      return '7d';
    }
  });
  const [alertsPage, setAlertsPage] = useState(0);
  const alertsPerPage = 8;
  const { data: regions = [], isLoading: regionsLoading, error: regionsError } = useRegions({ staleTime: 60000 });
  const { data: systemMetricsData, isLoading: metricsLoading, error: metricsError } = useSystemMetrics({ staleTime: 10000, refetchInterval: 30000 });
  const { data: alertsFeed = [], isLoading: alertsLoading, error: alertsError } = useAlertsFeed({ staleTime: 5000, refetchInterval: 15000 });
  const { data: continentalStatsData, isLoading: statsLoading, error: statsError } = useContinentalStats({ staleTime: 60000 });
  const { data: incidentTimeSeries = [], isLoading: timelineLoading, error: timelineError } = useIncidentTimeSeries({ staleTime: 60000 });

  const systemMetrics = systemMetricsData ?? null;
  const continentalStats = continentalStatsData ?? {};
  const isLoadingData = regionsLoading || metricsLoading || alertsLoading || statsLoading || timelineLoading;
  const hasData = regions.length > 0 || alertsFeed.length > 0 || incidentTimeSeries.length > 0 || Object.keys(continentalStats).length > 0;
  const errorMessage = regionsError?.message || metricsError?.message || alertsError?.message || statsError?.message || timelineError?.message;
  const totalAlertPages = Math.max(1, Math.ceil(alertsFeed.length / alertsPerPage));
  const pagedAlerts = useMemo(
    () => alertsFeed.slice(alertsPage * alertsPerPage, alertsPage * alertsPerPage + alertsPerPage),
    [alertsFeed, alertsPage, alertsPerPage]
  );
  const filteredTimeline = useMemo(() => {
    const rangeDays = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    if (incidentTimeSeries.length === 0) return [];
    return incidentTimeSeries.slice(-rangeDays);
  }, [incidentTimeSeries, timeRange]);
  const commandHealthLabel = useMemo(() => {
    if (!systemMetrics) return 'Syncing telemetry';
    if (systemMetrics.activeAlerts > 20) return 'High alert pressure';
    if (systemMetrics.activeAlerts > 0) return 'Monitoring active alerts';
    return 'Operational baseline';
  }, [systemMetrics]);

  useEffect(() => {
    if (alertsPage > totalAlertPages - 1) {
      setAlertsPage(Math.max(0, totalAlertPages - 1));
    }
  }, [alertsPage, totalAlertPages]);

  useEffect(() => {
    if (selectedRegion && !regions.some((region) => region.id === selectedRegion)) {
      setSelectedRegion(null);
    }
  }, [selectedRegion, regions]);

  useEffect(() => {
    try {
      if (selectedRegion) {
        localStorage.setItem('aegis_command_region', selectedRegion);
      } else {
        localStorage.removeItem('aegis_command_region');
      }
    } catch {
      return;
    }
  }, [selectedRegion]);

  useEffect(() => {
    try {
      localStorage.setItem('aegis_command_range', timeRange);
    } catch {
      return;
    }
  }, [timeRange]);

  type MetricCardProps = {
    icon: React.FC<{ className?: string; size?: number }>;
    label: string;
    value: React.ReactNode;
    subValue?: React.ReactNode;
    color: string;
    trend?: number;
  };

  const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, label, value, subValue, color, trend }) => (
    <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all group">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="text-white" size={18} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {trend > 0 ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {subValue && <div className="text-[10px] text-slate-600 mt-1">{subValue}</div>}
      </div>
    </div>
  );

  const riskLevelBg = (level: RiskLevel) => {
    const colors = {
      low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return colors[level];
  };

  const handleExportReport = () => {
    if (alertsFeed.length === 0) {
      return;
    }
    const rows = alertsFeed.map((alert) => ({
      time: alert.time,
      type: alert.type,
      module: alert.module,
      message: alert.message,
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
    link.download = "command-center-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 p-4 lg:p-6 space-y-6 overflow-y-auto h-full relative">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/14 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-cyan-600/12 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>
      <div className="relative z-10 space-y-6">
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-200">
          {errorMessage}
        </div>
      )}
      {isLoadingData && !hasData && (
        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 text-xs text-slate-400">
          Loading live command center data...
        </div>
      )}
      {!isLoadingData && !hasData && (
        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 text-xs text-slate-400">
          No live data available yet. Connect Supabase tables to populate this view.
        </div>
      )}
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-slate-800/50 p-6 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 lg:right-8">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">{commandHealthLabel}</span>
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <ShieldIcon className="text-indigo-400" size={28} />
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">AEGIS-AI Command Center</h1>
          </div>
          <div className="text-slate-400 text-sm max-w-2xl">
            Continental-scale synthetic intelligence infrastructure monitoring {systemMetrics ? (
              <span>{systemMetrics.regionsMonitored} regions across {systemMetrics.countriesActive} countries</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Skeleton className="h-3 w-16 bg-slate-800/60" /><Skeleton className="h-3 w-16 bg-slate-800/60" /></span>
            )}. Real-time GBV prevention, protection, and justice optimization.
          </div>
          <div className="flex flex-wrap gap-4 mt-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <DatabaseIcon size={14} className="text-cyan-400" />
              {systemMetrics ? (
                <span>{systemMetrics.dataPointsProcessed} data points</span>
              ) : (
                <Skeleton className="h-3 w-20 bg-slate-800/60" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <LayersIcon size={14} className="text-purple-400" />
              {systemMetrics ? (
                <span>{systemMetrics.modelsDeployed} AI models deployed</span>
              ) : (
                <Skeleton className="h-3 w-20 bg-slate-800/60" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ZapIcon size={14} className="text-amber-400" />
              {systemMetrics ? (
                <span>{systemMetrics.avgResponseTime} avg response</span>
              ) : (
                <Skeleton className="h-3 w-16 bg-slate-800/60" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldIcon size={14} className="text-emerald-400" />
              {systemMetrics ? (
                <span>{systemMetrics.encryptionStatus} encryption</span>
              ) : (
                <Skeleton className="h-3 w-16 bg-slate-800/60" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          icon={AlertTriangleIcon}
          label="Active Incidents"
          value={systemMetrics ? systemMetrics.totalIncidents.toLocaleString() : <Skeleton className="h-7 w-16 bg-slate-800/60" />}
          color="from-red-500/20 to-red-600/20"
        />
        <MetricCard
          icon={ZapIcon}
          label="Active Alerts"
          value={systemMetrics ? systemMetrics.activeAlerts : <Skeleton className="h-7 w-12 bg-slate-800/60" />}
          color="from-amber-500/20 to-amber-600/20"
        />
        <MetricCard
          icon={UsersIcon}
          label="Survivors Supported"
          value={systemMetrics ? systemMetrics.survivorsSupported.toLocaleString() : <Skeleton className="h-7 w-16 bg-slate-800/60" />}
          color="from-pink-500/20 to-pink-600/20"
        />
        <MetricCard
          icon={GlobeIcon}
          label="Regions Monitored"
          value={systemMetrics ? systemMetrics.regionsMonitored : <Skeleton className="h-7 w-10 bg-slate-800/60" />}
          color="from-indigo-500/20 to-indigo-600/20"
        />
        <MetricCard
          icon={CheckCircleIcon}
          label="Cases Processed"
          value={systemMetrics ? systemMetrics.casesProcessed.toLocaleString() : <Skeleton className="h-7 w-16 bg-slate-800/60" />}
          color="from-emerald-500/20 to-emerald-600/20"
        />
        <MetricCard
          icon={ActivityIcon}
          label="System Uptime"
          value={systemMetrics ? `${systemMetrics.systemUptime}%` : <Skeleton className="h-7 w-12 bg-slate-800/60" />}
          color="from-cyan-500/20 to-cyan-600/20"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continental Risk Map */}
        <div className="lg:col-span-2 bg-slate-950/60 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Continental Risk Heatmap</h3>
              <p className="text-xs text-slate-500">Real-time risk distribution across Africa</p>
            </div>
            <div className="flex gap-1">
              {(['24h', '7d', '30d', '90d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-xs transition-all ${
                    timeRange === range
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {/* Simplified Africa map with risk indicators */}
            <div className="relative h-[400px] bg-slate-950/50 rounded-lg overflow-hidden">
              <svg viewBox="0 0 600 600" className="w-full h-full opacity-20">
                <path d="M300 50 Q350 80 380 120 Q420 180 430 250 Q440 320 420 380 Q400 440 380 480 Q360 520 340 540 Q320 560 300 570 Q280 560 260 540 Q240 520 220 480 Q200 440 180 380 Q160 320 170 250 Q180 180 220 120 Q250 80 300 50Z" fill="currentColor" className="text-slate-700" />
              </svg>
              {/* Region dots */}
              {regions.map((region) => {
                const x = ((region.lng + 20) / 60) * 100;
                const y = ((35 - region.lat) / 70) * 100;
                return (
                  <button
                    key={region.id}
                    onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${Math.max(5, Math.min(95, x))}%`, top: `${Math.max(5, Math.min(95, y))}%` }}
                  >
                    <div className={`w-3 h-3 rounded-full transition-all ${
                      selectedRegion === region.id ? 'scale-150' : 'group-hover:scale-125'
                    }`} style={{ backgroundColor: RISK_COLORS[region.riskLevel] }}>
                      {region.riskLevel === 'critical' && (
                        <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: RISK_COLORS[region.riskLevel], opacity: 0.4 }} />
                      )}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-slate-700">
                      <p className="font-medium">{region.name}</p>
                      <p className="text-slate-400">Risk: {(region.riskScore * 100).toFixed(0)}%</p>
                    </div>
                  </button>
                );
              })}
              {/* Legend */}
              <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-800/50">
                {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map(level => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
                    <span className="text-[10px] text-slate-400 capitalize">{level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Alert Feed */}
        <div className="bg-slate-950/60 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Live Alert Feed</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-red-400">LIVE</span>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[430px]">
            {pagedAlerts.length === 0 ? (
              <div className="px-4 py-6 text-xs text-slate-500">No live alerts in the current feed.</div>
            ) : pagedAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    alert.type === 'critical' ? 'bg-red-500 animate-pulse' :
                    alert.type === 'high' ? 'bg-orange-500' :
                    alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{alert.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/50 px-4 py-3 text-[10px] text-slate-500">
            <span>Page {alertsPage + 1} of {totalAlertPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAlertsPage((prev) => Math.max(0, prev - 1))}
                disabled={alertsPage === 0}
                className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-300 transition-colors disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setAlertsPage((prev) => Math.min(totalAlertPages - 1, prev + 1))}
                disabled={alertsPage >= totalAlertPages - 1}
                className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-300 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Breakdown */}
      <div className="bg-slate-950/60 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Regional Risk Assessment</h3>
          <button
            onClick={handleExportReport}
            disabled={alertsFeed.length === 0}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Region</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Country</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Risk Level</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Score</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Incidents</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Trend</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Shelters</th>
                <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider px-4 py-3">Agents</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
                  className={`border-b border-slate-800/30 cursor-pointer transition-colors ${
                    selectedRegion === region.id ? 'bg-indigo-500/5' : 'hover:bg-slate-800/20'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPinIcon size={14} className="text-slate-500" />
                      <span className="text-sm text-white font-medium">{region.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{region.country}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${riskLevelBg(region.riskLevel)}`}>
                      {region.riskLevel.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${region.riskScore * 100}%`, backgroundColor: RISK_COLORS[region.riskLevel] }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{(region.riskScore * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white font-mono">{region.incidents}</td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1 text-xs ${
                      region.trend === 'up' ? 'text-red-400' :
                      region.trend === 'down' ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {region.trend === 'up' ? <TrendUpIcon size={12} /> :
                       region.trend === 'down' ? <TrendDownIcon size={12} /> :
                       <span>-</span>}
                      {region.trendPercent}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{region.shelters}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{region.agents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Continental Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(continentalStats).length === 0 ? (
          <div className="md:col-span-2 lg:col-span-5 bg-slate-950/60 border border-white/10 rounded-xl p-4 text-xs text-slate-500">
            No continental summary rows available yet.
          </div>
        ) : Object.entries(continentalStats).map(([key, stats]) => {
          const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return (
            <div key={key} className="bg-slate-950/60 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
              <h4 className="text-sm text-white font-medium mb-3">{name}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Incidents</span>
                  <span className="text-white font-mono">{stats.incidents}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk Score</span>
                  <span className="text-white font-mono">{(stats.riskScore * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${stats.riskScore * 100}%`,
                      backgroundColor: stats.riskScore > 0.8 ? '#EF4444' : stats.riskScore > 0.65 ? '#F97316' : stats.riskScore > 0.5 ? '#F59E0B' : '#10B981'
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Trend</span>
                  <span className={stats.trend > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {stats.trend > 0 ? '+' : ''}{stats.trend}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Shelters / Agents</span>
                  <span className="text-slate-400">{stats.shelters} / {stats.agents}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Incident Timeline Chart */}
      <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-sm">Incident Volume Timeline</h3>
            <p className="text-xs text-slate-500">Daily reported incidents with 14-day forecast</p>
          </div>
        </div>
        <div className="mt-6">
          <HotspotHeatmap compact />
        </div>
        <div className="h-48 flex items-end gap-[2px]">
          {filteredTimeline.map((point, i) => {
            const maxVal = Math.max(...filteredTimeline.map(p => p.value), 1);
            const height = (point.value / maxVal) * 100;
            const isPredicted = point.predicted !== undefined;
            return (
              <div
                key={i}
                className="flex-1 rounded-t transition-all hover:opacity-80 cursor-pointer group relative"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPredicted ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.6)',
                  borderTop: isPredicted ? '2px dashed rgba(99, 102, 241, 0.8)' : 'none',
                }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 rounded text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {point.date}: {point.value} {isPredicted ? '(forecast)' : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-slate-600">
          <span>{timeRange} window start</span>
          <span className="text-indigo-400">Forecast zone</span>
          <span>Current window</span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CommandCenter;
