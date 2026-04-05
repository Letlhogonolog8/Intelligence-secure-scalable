import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentVaultCardProps {
  isLoading: boolean;
  headline: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
}

export const DocumentVaultCard: React.FC<DocumentVaultCardProps> = ({
  isLoading,
  headline,
  meta,
  actionLabel,
  onAction,
  compact = false,
}) => (
  <Card className="border-white/5 bg-slate-950/40 shadow-none">
    <div className={compact ? "p-4" : "p-5"}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Documents</p>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-24 bg-slate-800/60" />
          <Skeleton className="mt-2 h-3 w-40 bg-slate-800/60" />
          <Skeleton className="mt-4 h-9 w-28 bg-slate-800/60" />
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-white">{headline}</p>
          <p className="text-sm text-slate-300 mt-2">{meta}</p>
          <Button size="sm" className="mt-4 border-white/10 text-white" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </>
      )}
    </div>
  </Card>
);
