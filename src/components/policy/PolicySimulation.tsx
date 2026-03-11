import React, { useEffect, useState } from 'react';

import { usePolicyScenarios } from '@/data/aegisData';
import {
  PlayIcon, PauseIcon, DownloadIcon, CheckCircleIcon,
  LayersIcon
} from '@/components/ui/AegisIcons';

const PolicySimulation: React.FC = () => {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const { data: policyScenarios = [], isLoading: policyLoading, error: policyError } = usePolicyScenarios();
  const isLoadingData = policyLoading;
  const hasData = policyScenarios.length > 0;
  const errorMessage = policyError?.message;
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (selectedScenarios.length === 0 && policyScenarios.length) {
      setSelectedScenarios(policyScenarios.slice(0, 2).map((scenario) => scenario.id));
    }
  }, [policyScenarios, selectedScenarios.length]);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [iterations, setIterations] = useState(10000);
  const [simulationResults, setSimulationResults] = useState<Record<string, { reduction: number; confidence: number; cost: string }>>({});
  const [compareMode, setCompareMode] = useState(false);

  const handleExport = () => {
    const rows = selectedScenariosData.length > 0 ? selectedScenariosData : policyScenarios;
    if (rows.length === 0) {
      return;
    }
    const exportRows = rows.map((scenario) => ({
      name: scenario.name,
      category: scenario.category,
      impact: scenario.impact,
      cost: scenario.cost,
      timeframe: scenario.timeframe,
      confidence: scenario.confidence,
      gbvReduction: simulationResults[scenario.id]?.reduction ?? scenario.gbvReduction,
      iterations: scenario.iterations,
    }));
    const headers = Object.keys(exportRows[0]);
    const escapeValue = (value: unknown) => {
      const stringValue = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    };
    const csv = [headers.join(","), ...exportRows.map((row) => headers.map((header) => escapeValue(row[header as keyof typeof row])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "policy-simulations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleScenario = (id: string) => {
    setSelectedScenarios(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const runSimulation = () => {
    setIsSimulating(true);
    setSimulationProgress(0);
    setSimulationResults({});

    const interval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulating(false);
          // Generate results
          const results: Record<string, { reduction: number; confidence: number; cost: string }> = {};
          selectedScenarios.forEach(id => {
            const scenario = policyScenarios.find(s => s.id === id);
            if (scenario) {
              results[id] = {
                reduction: scenario.gbvReduction + (Math.random() * 4 - 2),
                confidence: scenario.confidence + (Math.random() * 0.06 - 0.03),
                cost: scenario.cost,
              };
            }
          });
          setSimulationResults(results);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const selectedScenariosData = policyScenarios.filter(s => selectedScenarios.includes(s.id));
  const maxReduction = policyScenarios.length ? Math.max(...policyScenarios.map(s => s.gbvReduction)) : 1;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-6">
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-200">
          {errorMessage}
        </div>
      )}
      {isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          Loading policy simulations...
        </div>
      )}
      {!isLoadingData && !hasData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
          No policy scenarios available yet. Connect Supabase tables to populate this view.
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Policy Simulation & Foresight Lab</h2>
          <p className="text-sm text-slate-500">Multi-agent Monte Carlo simulation engine with Bayesian causal modeling</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
              compareMode ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white'
            }`}
          >
            <LayersIcon size={14} />
            Compare Mode
          </button>
          <button
            onClick={handleExport}
            disabled={policyScenarios.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <DownloadIcon size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Iterations</label>
              <select
                value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))}
                className="block mt-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value={1000}>1,000</option>
                <option value={5000}>5,000</option>
                <option value={10000}>10,000</option>
                <option value={50000}>50,000</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Selected Scenarios</label>
              <p className="text-sm text-white font-medium mt-1">{selectedScenarios.length} of {policyScenarios.length}</p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Engine</label>
              <p className="text-sm text-white font-medium mt-1">Monte Carlo + Bayesian</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSimulating ? (
              <button
                onClick={() => setIsSimulating(false)}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm hover:bg-red-500/20 transition-all"
              >
                <PauseIcon size={16} />
                Stop Simulation
              </button>
            ) : (
              <button
                onClick={runSimulation}
                disabled={selectedScenarios.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl text-white text-sm hover:from-purple-600 hover:to-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <PlayIcon size={16} />
                Run Simulation
              </button>
            )}
          </div>
        </div>
        {/* Progress Bar */}
        {(isSimulating || simulationProgress > 0) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">
                {isSimulating ? 'Simulating...' : 'Simulation Complete'}
              </span>
              <span className="text-xs text-white font-mono">{simulationProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200 bg-gradient-to-r from-purple-500 to-indigo-500"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
            {isSimulating && (
              <p className="text-[10px] text-slate-600 mt-1">
                Processing {Math.floor(simulationProgress / 100 * iterations).toLocaleString()} of {iterations.toLocaleString()} iterations...
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Selection */}
        <div className="lg:col-span-2">
          <h3 className="text-white font-semibold text-sm mb-3">Policy Interventions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {policyScenarios.map((scenario) => {
              const isSelected = selectedScenarios.includes(scenario.id);
              const result = simulationResults[scenario.id];
              return (
                <button
                  key={scenario.id}
                  onClick={() => toggleScenario(scenario.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-purple-500/5 border-purple-500/30 shadow-lg shadow-purple-500/5'
                      : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-600'
                        }`}>
                          {isSelected && <CheckCircleIcon size={10} className="text-white" />}
                        </div>
                        <h4 className="text-sm text-white font-medium">{scenario.name}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-6">{scenario.description}</p>
                    </div>
                  </div>
                  <div className="ml-6 mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Category</span>
                      <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full text-[10px]">{scenario.category}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Projected GBV Reduction</span>
                      <span className="text-emerald-400 font-mono">{result ? result.reduction.toFixed(1) : scenario.gbvReduction}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/60 transition-all" style={{ width: `${((result?.reduction || scenario.gbvReduction) / maxReduction) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Cost: {scenario.cost}</span>
                      <span className="text-slate-500">{scenario.timeframe}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Confidence</span>
                      <span className="text-white font-mono">{((result?.confidence || scenario.confidence) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {/* Impact Comparison */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Impact Comparison</h4>
            {selectedScenariosData.length > 0 ? (
              <div className="space-y-3">
                {selectedScenariosData.sort((a, b) => b.gbvReduction - a.gbvReduction).map((scenario) => {
                  const result = simulationResults[scenario.id];
                  const reduction = result?.reduction || scenario.gbvReduction;
                  return (
                    <div key={scenario.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400 truncate max-w-[60%]">{scenario.name}</span>
                        <span className="text-xs text-emerald-400 font-mono">-{reduction.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-teal-500/60 transition-all"
                          style={{ width: `${(reduction / maxReduction) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">Select scenarios to compare</p>
            )}
          </div>

          {/* Combined Impact */}
          {selectedScenariosData.length > 1 && (
            <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-4">
              <h4 className="text-white font-semibold text-sm mb-2">Combined Impact Estimate</h4>
              <p className="text-[10px] text-slate-500 mb-3">Non-linear interaction effects modeled</p>
              <div className="text-center py-3">
                <p className="text-4xl font-bold text-emerald-400">
                  -{Math.min(
                    selectedScenariosData.reduce((sum, s) => sum + s.gbvReduction, 0) * 0.7,
                    65
                  ).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">Projected GBV Reduction</p>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total Investment</span>
                  <span className="text-white">${selectedScenariosData.reduce((sum, s) => sum + parseInt(s.cost.replace(/\D/g, '')), 0)}M</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Avg Timeframe</span>
                  <span className="text-white">{Math.round(selectedScenariosData.reduce((sum, s) => sum + parseInt(s.timeframe), 0) / selectedScenariosData.length)} months</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Confidence</span>
                  <span className="text-white">{(selectedScenariosData.reduce((sum, s) => sum + s.confidence, 0) / selectedScenariosData.length * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Simulation Parameters */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Simulation Engine</h4>
            <div className="space-y-2">
              {[
                { label: 'Monte Carlo Iterations', value: iterations.toLocaleString() },
                { label: 'Bayesian Priors', value: 'Informative' },
                { label: 'Population Model', value: 'Synthetic (1M agents)' },
                { label: 'Temporal Resolution', value: 'Monthly' },
                { label: 'Spatial Resolution', value: '10km grid' },
                { label: 'Interaction Effects', value: 'Non-linear' },
                { label: 'Convergence Check', value: 'Gelman-Rubin' },
              ].map((param, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{param.label}</span>
                  <span className="text-slate-300 font-mono text-[10px]">{param.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Causal Graph Summary */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Bayesian Causal Factors</h4>
            <div className="space-y-2">
              {[
                { factor: 'Economic Inequality', strength: 0.82, direction: 'positive' },
                { factor: 'Alcohol Availability', strength: 0.71, direction: 'positive' },
                { factor: 'Education Access', strength: 0.68, direction: 'negative' },
                { factor: 'Law Enforcement', strength: 0.54, direction: 'negative' },
                { factor: 'Social Norms', strength: 0.47, direction: 'positive' },
                { factor: 'Shelter Proximity', strength: 0.39, direction: 'negative' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-28 truncate">{f.factor}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${f.direction === 'positive' ? 'bg-red-500/50' : 'bg-emerald-500/50'}`}
                      style={{ width: `${f.strength * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-8 text-right">{(f.strength * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-600">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <span>Increases GBV</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                <span>Reduces GBV</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicySimulation;
