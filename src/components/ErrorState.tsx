import React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangleIcon, RefreshIcon } from "@/components/ui/AegisIcons";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  variant?: "inline" | "card" | "banner";
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "An error occurred while loading this section. Please try again.",
  onRetry,
  className = "",
  variant = "inline",
}) => {
  if (variant === "banner") {
    return (
      <div className={`bg-red-900/20 border border-red-800/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangleIcon size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-300 font-semibold">{title}</h3>
            <p className="text-red-200/70 text-sm mt-1">{message}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-sm transition"
              >
                <RefreshIcon size={14} />
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Card className="bg-slate-900/40 border-red-800/30 border">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangleIcon size={20} className="text-red-400" />
            <h3 className="text-red-300 font-semibold">{title}</h3>
          </div>
          <p className="text-red-200/70 text-sm mb-4">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-2 bg-red-800 hover:bg-red-700 text-white rounded text-sm transition flex items-center gap-2"
            >
              <RefreshIcon size={14} />
              Try Again
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className={`text-center py-8 px-4 ${className}`}>
      <AlertTriangleIcon size={32} className="text-red-400 mx-auto mb-3" />
      <h3 className="text-red-300 font-semibold mb-2">{title}</h3>
      <p className="text-red-200/70 text-sm mb-4 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded text-sm transition flex items-center gap-2 mx-auto"
        >
          <RefreshIcon size={14} />
          Try Again
        </button>
      )}
    </div>
  );
};
