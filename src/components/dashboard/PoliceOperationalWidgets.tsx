import { Button } from "@/components/ui/button";
import { ListItemCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import type { ModuleType } from "@/data/aegisData";
import type { PoliceAvailabilitySummary, PoliceRecommendedAction, PoliceStageAgingItem } from "@/lib/policeDashboard";

export const PoliceRecommendedActionsList = ({
  items,
  onAction,
}: {
  items: PoliceRecommendedAction[];
  onAction: (module: ModuleType) => void;
}) => (
  <div className="space-y-3">
    {items.map((entry) => (
      <ListItemCard
        key={entry.title}
        title={entry.title}
        subtitle={entry.description}
        meta={<StatusPill tone={entry.tone}>{entry.tone}</StatusPill>}
        action={<Button size="sm" variant="outline" onClick={() => onAction(entry.actionModule)}>{entry.actionLabel}</Button>}
      />
    ))}
  </div>
);

export const PoliceAvailabilityGrid = ({ items }: { items: PoliceAvailabilitySummary[] }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {items.map((entry) => (
      <ListItemCard key={entry.label} title={entry.label} meta={<StatusPill tone={entry.tone}>{entry.value}</StatusPill>} />
    ))}
  </div>
);

export const PoliceStageAgingList = ({ items }: { items: PoliceStageAgingItem[] }) => (
  <div className="space-y-3">
    {items.map((entry) => (
      <ListItemCard
        key={entry.stage}
        title={entry.stage}
        subtitle={`${entry.count} open case${entry.count === 1 ? "" : "s"} • avg ${entry.avgDaysOpen}d in stage`}
        meta={<StatusPill tone={entry.tone}>{entry.avgDaysOpen}d</StatusPill>}
      />
    ))}
  </div>
);
