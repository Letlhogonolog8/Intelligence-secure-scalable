import React from "react";
import { Card } from "@/components/ui/card";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {icon && <div className="mb-4 flex justify-center text-slate-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export const EmptyStateCard: React.FC<EmptyStateProps> = (props) => {
  return (
    <Card className="bg-slate-900/40 border-slate-800 border-dashed">
      <div className="p-6">
        <EmptyState {...props} />
      </div>
    </Card>
  );
};

export const LoadingSpinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({
  size = "md",
}) => {
  const sizeClass = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }[size];

  return (
    <div className={`${sizeClass} border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin`} />
  );
};
