import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { AlertTriangle, Download, CheckCircle2 } from 'lucide-react';

const fairnessData = [
  { demographic: 'Age 18-25', passRate: 94, bias: 2 },
  { demographic: 'Age 26-35', passRate: 96, bias: 1.5 },
  { demographic: 'Age 36-50', passRate: 95, bias: 2.2 },
  { demographic: 'Age 50+', passRate: 92, bias: 3.1 },
  { demographic: 'Female', passRate: 96, bias: 1.2 },
  { demographic: 'Male', passRate: 94, bias: 2.8 },
  { demographic: 'Urban', passRate: 97, bias: 0.8 },
  { demographic: 'Rural', passRate: 89, bias: 4.2 },
];

const biasDetectionTrend = [
  { month: 'Jan', biasScore: 2.1, threshold: 2.5 },
  { month: 'Feb', biasScore: 2.3, threshold: 2.5 },
  { month: 'Mar', biasScore: 2.8, threshold: 2.5 },
  { month: 'Apr', biasScore: 2.4, threshold: 2.5 },
  { month: 'May', biasScore: 2.2, threshold: 2.5 },
  { month: 'Jun', biasScore: 1.9, threshold: 2.5 },
];

export const AIFairnessAudit: React.FC = () => {
  const metrics = useMemo(() => {
    const avgPassRate = fairnessData.reduce((sum, d) => sum + d.passRate, 0) / fairnessData.length;
    const avgBias = fairnessData.reduce((sum, d) => sum + d.bias, 0) / fairnessData.length;
    const maxBias = Math.max(...fairnessData.map((d) => d.bias));
    const biasGroups = fairnessData.filter((d) => d.bias > 2.5);

    return {
      avgPassRate: Math.round(avgPassRate),
      avgBias: avgBias.toFixed(2),
      maxBias: maxBias.toFixed(2),
      biasCount: biasGroups.length,
      overallFair: maxBias < 3,
    };
  }, []);

  const handleExportAudit = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      fairnessData,
      biasDetectionTrend,
      recommendation: metrics.overallFair
        ? 'Model meets fairness standards. Continue regular auditing.'
        : 'Address identified bias groups with retraining on underrepresented demographics.',
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairness-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Avg Pass Rate</p>
          <p className="text-3xl font-bold text-emerald-400">{metrics.avgPassRate}%</p>
        </Card>
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Avg Bias Score</p>
          <p className={`text-3xl font-bold ${metrics.overallFair ? 'text-blue-400' : 'text-rose-400'}`}>
            {metrics.avgBias}
          </p>
        </Card>
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Max Bias Detected</p>
          <p className={`text-3xl font-bold ${parseFloat(metrics.maxBias) < 3 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {metrics.maxBias}
          </p>
        </Card>
        <Card className={`border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl ${metrics.overallFair ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Status</p>
          <div className="flex items-center gap-2">
            {metrics.overallFair ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-lg font-bold text-emerald-400">FAIR</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <span className="text-lg font-bold text-rose-400">REVIEW</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Fairness by Demographic */}
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold text-white mb-6">Algorithmic Fairness by Demographic</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fairnessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="demographic" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Legend />
              <Bar dataKey="passRate" fill="#10b981" name="Pass Rate %" />
              <Bar dataKey="bias" fill="#f87171" name="Bias Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Bias Detection Trend */}
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold text-white mb-6">Bias Detection Trend (6 Months)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={biasDetectionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="biasScore"
                stroke="#6366f1"
                strokeWidth={2}
                name="Bias Score"
                dot={{ fill: '#6366f1', r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="threshold"
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={2}
                name="Acceptable Threshold"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* At-Risk Groups */}
      {metrics.biasCount > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur-xl border">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-rose-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white">Groups Requiring Attention</h3>
              <p className="text-sm text-rose-300 mt-1">
                {metrics.biasCount} demographic group(s) show bias above 2.5 threshold
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {fairnessData
              .filter((d) => d.bias > 2.5)
              .map((group, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-white/5">
                  <span className="font-semibold text-white">{group.demographic}</span>
                  <span className="text-rose-400 font-bold">{group.bias}% bias</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Export Button */}
      <Button
        onClick={handleExportAudit}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
      >
        <Download className="mr-2 h-4 w-4" />
        Export Fairness Audit Report
      </Button>
    </div>
  );
};
