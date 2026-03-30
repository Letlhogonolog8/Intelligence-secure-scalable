import React, { useMemo, useState } from 'react';
import {
  useRegions,
  useRiskTrendData,
  useRegionForecasts,
  useRegionIncidentTypes,
  useGovernanceModels,
  useAnomalyAlerts,
  RISK_COLORS,
  RiskLevel
} from '@/data/aegisData';
import {
  MapPinIcon, TrendUpIcon, TrendDownIcon,
  DownloadIcon, RefreshIcon,
  SearchIcon
} from '@/components/ui/AegisIcons';
import { useQueryClient } from '@tanstack/react-query';

const RiskPrediction: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');
  const [forecastDays, setForecastDays] = useState<7 | 14 | 30 | 90>(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnomalies, setShowAnomalies] = useState(true);
  const queryClient = useQueryClient();
  const { data: regions = [], isLoading: regionsLoading, error: regionsError } = useRegions({ staleTime: 60000 });
  const { data: riskTrendData = [], isLoading: trendLoading, error: trendError } = useRiskTrendData({ staleTime: 60000 });
  const { data: incidentTypes = [], isLoading: incidentTypesLoading, error: incidentTypesError } = useRegionIncidentTypes(selectedRegion, { staleTime: 60000 });
  const { data: regionForecasts = [], isLoading: forecastsLoading, error: forecastsError } = useRegionForecasts(selectedRegion, { staleTime: 60000 });
  const { data: governanceModels = [], isLoading: modelsLoading, error: modelsError } = useGovernanceModels({ staleTime: 60000 });
  const { data: anomalyAlerts = [], isLoading: anomalyLoading, error: anomalyError } = useAnomalyAlerts({ staleTime: 15000, refetchInterval: 30000 });

  const isLoadingData = regionsLoading || trendLoading || modelsLoading || anomalyLoading || incidentTypesLoading || forecastsLoading;
  const hasData = regions.length > 0 || riskTrendData.length > 0 || anomalyAlerts.length > 0;
  const errorMessage = regionsError?.message || trendError?.message || incidentTypesError?.message || forecastsError?.message || modelsError?.message || anomalyError?.message;

  const predictionModels = governanceModels.filter((model) => model.module.toLowerCase().includes('prediction'));
  const visibleAnomalies = showAnomalies ? anomalyAlerts : [];

  const filteredRegions = regions.filter(r => {
    if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false;
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.country.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedRegions = [...filteredRegions].sort((a, b) => b.riskScore - a.riskScore);

  const riskDistribution = {
    critical: regions.filter(r => r.riskLevel === 'critical').length,
    high: regions.filter(r => r.riskLevel === 'high').length,
    medium: regions.filter(r => r.riskLevel === 'medium').length,
    low: regions.filter(r => r.riskLevel === 'low').length,
  };

  const selectedRegionData = selectedRegion ? regions.find(r => r.id === selectedRegion) : null;
  const latestTelemetrySync = useMemo(() => {
    const timestamps = [
      ...riskTrendData.map((entry) => entry.date),
      ...anomalyAlerts.map((entry) => entry.time),
    ];
    const latest = timestamps
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => right - left)[0];
    return typeof latest === 'number' ? new Date(latest).toLocaleTimeString() : null;
  }, [anomalyAlerts, riskTrendData]);

  const handleRefreshModels = () => {
    void queryClient.invalidateQueries({ queryKey: ['aegis', 'regions'] });
    void queryClient.invalidateQueries({ queryKey: ['aegis', 'riskTrendData'] });
    void queryClient.invalidateQueries({ queryKey: ['aegis', 'regionForecasts'] });
    void queryClient.invalidateQueries({ queryKey: ['aegis', 'governanceModels'] });
    void queryClient.invalidateQueries({ queryKey: ['aegis', 'anomalyAlerts'] });
  };

  const handleExport = () => {
    if (sortedRegions.length === 0) {
      return;
    }
    const rows = sortedRegions.map((region) => ({
      name: region.name,
      country: region.country,
      riskLevel: region.riskLevel,
      riskScore: region.riskScore,
      incidents: region.incidents,
      trend: region.trend,
      trendPercent: region.trendPercent,
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
    link.download = "risk-prediction-regions.csv";
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
          Loading risk intelligence...
        </div>
      )}
      {!isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          No risk data available yet. Connect Supabase tables to populate this view.
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Spatio-Temporal Risk Intelligence</h2>
          <p className="text-sm text-slate-500">Predictive analytics across {regions.length} monitored regions</p>
          <p className="text-[11px] text-slate-600 mt-1">{latestTelemetrySync ? `Live sync: ${latestTelemetrySync}` : 'Awaiting first telemetry sync'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search regions..."
              className="bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/30 w-48"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={sortedRegions.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <DownloadIcon size={14} />
            Export
          </button>
          <button
            onClick={handleRefreshModels}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 hover:bg-amber-500/20 transition-all"
          >
            <RefreshIcon size={14} />
            Refresh Models
          </button>
        </div>
      </div>

      {/* Risk Distribution Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(riskDistribution) as [RiskLevel, number][]).map(([level, count]) => (
          <button
            key={level}
            onClick={() => setFilterRisk(filterRisk === level ? 'all' : level)}
            className={`p-4 rounded-xl border transition-all ${
              filterRisk === level
                ? 'border-opacity-50 scale-[1.02]'
                : 'border-slate-800/50 hover:border-slate-700/50'
            }`}
            style={{
              backgroundColor: filterRisk === level ? `${RISK_COLORS[level]}10` : 'rgb(15 23 42 / 0.5)',
              borderColor: filterRisk === level ? `${RISK_COLORS[level]}50` : undefined,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
              <span className="text-2xl font-bold text-white">{count}</span>
            </div>
            <p className="text-xs text-slate-400 capitalize text-left">{level} Risk Regions</p>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Heatmap / Region List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Forecast Timeline */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-sm">Risk Trend Forecast</h3>
                <p className="text-xs text-slate-500">Aggregated continental risk score with prediction interval</p>
              </div>
              <div className="flex gap-1">
                {([7, 14, 30, 90] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setForecastDays(d)}
                    className={`px-2.5 py-1 rounded text-xs transition-all ${
                      forecastDays === d ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {/* Chart */}
            <div className="h-40 flex items-end gap-[3px]">
              {riskTrendData.map((point, i) => {
                const height = (point.value / 1) * 100;
                const color = point.value > 0.8 ? RISK_COLORS.critical :
                              point.value > 0.65 ? RISK_COLORS.high :
                              point.value > 0.5 ? RISK_COLORS.medium : RISK_COLORS.low;
                return (
                  <div key={i} className="flex-1 relative group cursor-pointer">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{ height: `${height}%`, backgroundColor: `${color}80` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 rounded text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
                      {point.date}: {(point.value * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-600">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Region Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedRegions.map((region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  selectedRegion === region.id
                    ? 'bg-slate-800/50 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                    : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm text-white font-medium">{region.name}</h4>
                    <p className="text-xs text-slate-500">{region.country}</p>
                  </div>
                  <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border`}
                    style={{ color: RISK_COLORS[region.riskLevel], borderColor: `${RISK_COLORS[region.riskLevel]}40`, backgroundColor: `${RISK_COLORS[region.riskLevel]}10` }}>
                    {region.riskLevel}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Risk Score</span>
                    <span className="text-xs text-white font-mono">{(region.riskScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${region.riskScore * 100}%`, backgroundColor: RISK_COLORS[region.riskLevel] }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{region.incidents} incidents</span>
                    <div className={`flex items-center gap-1 ${region.trend === 'up' ? 'text-red-400' : region.trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {region.trend === 'up' ? <TrendUpIcon size={10} /> : region.trend === 'down' ? <TrendDownIcon size={10} /> : null}
                      {region.trendPercent}%
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Selected Region Detail */}
          {selectedRegionData ? (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800/50" style={{ borderLeftColor: RISK_COLORS[selectedRegionData.riskLevel], borderLeftWidth: '3px' }}>
                <h3 className="text-white font-semibold text-sm">{selectedRegionData.name}</h3>
                <p className="text-xs text-slate-500">{selectedRegionData.country} | Pop: {(selectedRegionData.population / 1000000).toFixed(1)}M</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Risk Score', value: `${(selectedRegionData.riskScore * 100).toFixed(0)}%`, color: RISK_COLORS[selectedRegionData.riskLevel] },
                    { label: 'Incidents', value: selectedRegionData.incidents.toString(), color: '#fff' },
                    { label: 'Shelters', value: selectedRegionData.shelters.toString(), color: '#10B981' },
                    { label: 'Agents', value: selectedRegionData.agents.toString(), color: '#6366F1' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-800/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-500">{item.label}</p>
                      <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-2">Incident Type Distribution</p>
                  {incidentTypes.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-slate-400 w-24 truncate">{item.type}</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${item.pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 w-8 text-right">{item.pct}%</span>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-2">Model Predictions</p>
                  <div className="space-y-2">
                    {regionForecasts.map((forecast, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{forecast.label}</span>
                        <span className={forecast.riskChange > 0 ? 'text-red-400' : forecast.riskChange < 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {forecast.riskChange > 0 ? '+' : ''}{forecast.riskChange}%
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Anomaly detected</span>
                      <span className={showAnomalies ? 'text-red-400' : 'text-emerald-400'}>{showAnomalies ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-8 text-center">
              <MapPinIcon className="text-slate-600 mx-auto mb-3" size={32} />
              <p className="text-sm text-slate-500">Select a region to view detailed risk intelligence</p>
            </div>
          )}

          {/* Model Performance */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Prediction Models</h4>
            <div className="space-y-3">
              {predictionModels.length === 0 ? (
                <div className="bg-slate-800/20 rounded-lg p-3 text-xs text-slate-500">
                  No prediction models found in live governance feed.
                </div>
              ) : predictionModels.map((model, i) => (
                <div key={i} className="bg-slate-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white font-medium">{model.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      model.status === 'deployed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{model.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{model.version}</span>
                    <span>Accuracy: {model.accuracy}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${model.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Anomaly Alerts */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold text-sm">Anomaly Detection</h4>
              <button
                onClick={() => setShowAnomalies(!showAnomalies)}
                className={`text-[10px] px-2 py-1 rounded ${showAnomalies ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}
              >
                {showAnomalies ? 'Active' : 'Paused'}
              </button>
            </div>
            <div className="space-y-2">
              {visibleAnomalies.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-800/20 rounded-lg p-3">No live anomalies detected for current filter.</div>
              ) : visibleAnomalies.map((anomaly, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-slate-800/20 rounded-lg">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    anomaly.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                    anomaly.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{anomaly.region}: {anomaly.type}</p>
                    <p className="text-[10px] text-slate-500">{anomaly.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskPrediction;
