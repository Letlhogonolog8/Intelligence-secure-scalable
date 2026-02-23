import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useJusticeCases } from '@/data/aegisData';
import {
  AlertTriangle,
  Clock,
  MapPin,
  User,
  ArrowRight,
} from 'lucide-react';

interface PriorityCaseQueueProps {
  onSelectCase?: (caseId: string) => void;
}

export const PriorityCaseQueue: React.FC<PriorityCaseQueueProps> = ({ onSelectCase }) => {
  const { data: cases = [], isLoading } = useJusticeCases({ limit: 50 });

  const priorityQueue = useMemo(() => {
    return cases
      .filter((c) => c.status !== 'resolved')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
        return aPriority - bPriority;
      })
      .slice(0, 8);
  }, [cases]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
      case 'high':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
      case 'medium':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-300';
    }
  };

  const getStatusIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <Clock className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Priority Case Queue</h3>
        <p className="text-sm text-slate-400">
          {priorityQueue.length} active cases requiring attention
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : priorityQueue.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400">No active cases in queue</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {priorityQueue.map((caseItem, index) => (
            <button
              key={caseItem.id}
              onClick={() => onSelectCase?.(caseItem.id)}
              className="w-full text-left"
            >
              <div
                className={`p-4 rounded-lg border transition-all hover:border-opacity-100 ${getPriorityColor(
                  caseItem.priority
                )}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {index + 1}
                    </span>
                    {getStatusIcon(caseItem.priority)}
                    <span className="font-bold uppercase text-xs">
                      {caseItem.priority === 'critical' ? 'CRITICAL' : caseItem.priority.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">ID: {caseItem.id.substring(0, 8)}</span>
                </div>

                <div className="space-y-2 mb-3">
                  <p className="text-sm font-semibold text-white line-clamp-1">
                    {caseItem.type || 'Case Report'}
                  </p>
                  {caseItem.jurisdiction && (
                    <div className="flex items-center gap-1 text-xs text-slate-300">
                      <MapPin className="h-3 w-3" />
                      <span>{caseItem.jurisdiction}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {caseItem.status}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};
