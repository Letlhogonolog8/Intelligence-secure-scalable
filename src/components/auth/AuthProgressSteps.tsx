import React from "react";

interface AuthProgressStepsProps {
  labels: string[];
  currentIndex: number;
}

const AuthProgressSteps: React.FC<AuthProgressStepsProps> = ({ labels, currentIndex }) => {
  const safeStepCount = Math.max(labels.length, 1);
  const clampedIndex = Math.min(Math.max(currentIndex, 0), safeStepCount - 1);
  const progressWidth = `${((clampedIndex + 1) / safeStepCount) * 100}%`;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-slate-500">
        {labels.map((label, index) => (
          <span key={label} className={index <= clampedIndex ? "text-blue-200" : "text-slate-600"}>
            {label}
          </span>
        ))}
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-800/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 transition-all"
          style={{ width: progressWidth }}
        />
      </div>
    </div>
  );
};

export default AuthProgressSteps;
