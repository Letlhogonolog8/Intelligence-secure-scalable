import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

const STAGES = [
  { key: "report", label: "Report Filed", detail: "Incident securely captured" },
  { key: "triage", label: "AI Triage", detail: "Risk and urgency classified" },
  { key: "assigned", label: "Assigned", detail: "Counselor and NGO allocated" },
  { key: "police", label: "Police Action", detail: "Investigation and safety checks" },
  { key: "shelter", label: "Shelter / Support", detail: "Safe housing and care" },
  { key: "court", label: "Court Process", detail: "Dockets and hearings tracked" },
  { key: "resolution", label: "Resolution", detail: "Long-term support and closure" },
] as const;

interface SurvivorJourneyVisualizerProps {
  currentStage?: string;
}

const SurvivorJourneyVisualizer: React.FC<SurvivorJourneyVisualizerProps> = ({ currentStage = "assigned" }) => {
  const currentIndex = Math.max(0, STAGES.findIndex((s) => s.key === currentStage));

  return (
    <Card className="border-white/15 bg-slate-950/65 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Survivor Journey</h3>
        <span className="text-[10px] uppercase tracking-widest text-cyan-300 border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 rounded-full">
          Transparent Workflow
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {STAGES.map((stage, index) => {
          const completed = index <= currentIndex;
          const active = index === currentIndex;
          return (
            <div key={stage.key} className="flex items-center gap-3 lg:flex-col lg:items-start">
              <div className="flex items-center gap-2 lg:w-full">
                <div className={`h-7 w-7 rounded-full border flex items-center justify-center ${completed ? "border-emerald-500/40 bg-emerald-500/20" : "border-white/20 bg-slate-900/80"}`}>
                  {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 text-slate-500" />}
                </div>
                {index < STAGES.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-600 hidden lg:block" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${active ? "text-cyan-300" : "text-slate-100"}`}>{stage.label}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{stage.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SurvivorJourneyVisualizer;
