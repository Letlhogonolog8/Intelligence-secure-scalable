import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AppointmentCardProps {
  isLoading: boolean;
  headline: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  isLoading,
  headline,
  meta,
  actionLabel,
  onAction,
}) => (
  <Card className="border-white/15 bg-slate-950/70 shadow-xl backdrop-blur-sm">
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Next Appointment</p>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-24 bg-slate-800/60" />
          <Skeleton className="mt-2 h-3 w-40 bg-slate-800/60" />
          <Skeleton className="mt-4 h-9 w-28 bg-slate-800/60" />
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-slate-500 italic">{headline}</p>
          <p className="text-sm text-slate-400 mt-2">{meta}</p>
          <Button size="sm" className="mt-4 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </>
      )}
    </div>
  </Card>
);
