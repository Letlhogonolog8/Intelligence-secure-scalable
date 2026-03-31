import { Button } from "@/components/ui/button";
import { EmptyState, ListItemCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import type { AdminActionItem, AdminFeedHealthItem, AdminThresholdNotification } from "@/lib/adminDashboard";

export const AdminRecommendedActionsList = ({
  items,
  onAction,
}: {
  items: AdminActionItem[];
  onAction: (module: string) => void;
}) => (
  <div className="grid gap-3">
    {items.map((item) => (
      <ListItemCard
        key={item.title}
        title={item.title}
        subtitle={item.description}
        meta={<StatusPill tone={item.tone}>{item.actionLabel}</StatusPill>}
        action={<Button size="sm" variant="outline" onClick={() => onAction(item.actionModule)}>{item.actionLabel}</Button>}
      />
    ))}
  </div>
);

export const AdminFeedHealthGrid = ({ items }: { items: AdminFeedHealthItem[] }) => (
  <div className="grid gap-3 md:grid-cols-3">
    {items.map((item) => (
      <ListItemCard key={item.label} title={item.label} subtitle="Live data channel status" meta={<StatusPill tone={item.tone}>{item.value}</StatusPill>} />
    ))}
  </div>
);

export const AdminAuditSeveritySummary = ({
  summary,
}: {
  summary: { critical: number; error: number; warning: number; info: number };
}) => (
  <div className="mb-4 grid gap-3 sm:grid-cols-4">
    <ListItemCard title="Critical" subtitle="Audit events marked critical" meta={<StatusPill tone="rose">{summary.critical}</StatusPill>} />
    <ListItemCard title="Errors" subtitle="Events marked error" meta={<StatusPill tone="rose">{summary.error}</StatusPill>} />
    <ListItemCard title="Warnings" subtitle="Events marked warning" meta={<StatusPill tone="amber">{summary.warning}</StatusPill>} />
    <ListItemCard title="Info" subtitle="Informational audit events" meta={<StatusPill tone="sky">{summary.info}</StatusPill>} />
  </div>
);

export const AdminThresholdNotifications = ({ items }: { items: AdminThresholdNotification[] }) => {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No threshold notifications"
        description="Current admin queues are below the configured alert thresholds."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <ListItemCard key={item.title} title={item.title} subtitle={item.description} meta={<StatusPill tone={item.tone}>Active</StatusPill>} />
      ))}
    </div>
  );
};
