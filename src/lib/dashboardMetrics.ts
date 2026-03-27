export type TimelineBucket = {
  label: string;
  opened: number;
  resolved: number;
  active: number;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - diff);
  return next;
};

const bucketLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const priorityWeight = (priority?: string | null) => {
  switch ((priority ?? "").toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
};

export const riskWeight = (riskLevel?: string | null) => {
  switch ((riskLevel ?? "").toLowerCase()) {
    case "critical":
      return 95;
    case "high":
      return 75;
    case "medium":
      return 55;
    case "low":
      return 30;
    default:
      return 0;
  }
};

export const sortByPriorityAndRecency = <T extends { priority?: string | null; updatedAt?: string | null; createdAt?: string | null }>(items: T[]) =>
  [...items].sort((left, right) => {
    const priorityDiff = priorityWeight(right.priority) - priorityWeight(left.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });

export const buildWeeklyLifecycle = <T,>(
  items: T[],
  getOpenedAt: (item: T) => string | null | undefined,
  getResolvedAt?: (item: T) => string | null | undefined,
  weeks = 4
): TimelineBucket[] => {
  const today = new Date();
  const firstWeek = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (weeks - 1) * 7));
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const date = new Date(firstWeek);
    date.setDate(firstWeek.getDate() + index * 7);
    return {
      date,
      label: bucketLabel(date),
      opened: 0,
      resolved: 0,
      active: 0,
    };
  });

  const lastBucketDate = buckets[buckets.length - 1]?.date ?? firstWeek;

  for (const item of items) {
    const openedAt = getOpenedAt(item);
    const resolvedAt = getResolvedAt?.(item);
    const openedDate = openedAt ? startOfWeek(new Date(openedAt)) : null;
    const resolvedDate = resolvedAt ? startOfWeek(new Date(resolvedAt)) : null;

    buckets.forEach((bucket) => {
      if (openedDate && bucket.date.getTime() === openedDate.getTime()) {
        bucket.opened += 1;
      }
      if (resolvedDate && bucket.date.getTime() === resolvedDate.getTime()) {
        bucket.resolved += 1;
      }
      if (openedDate && openedDate.getTime() <= bucket.date.getTime() && (!resolvedDate || resolvedDate.getTime() > bucket.date.getTime())) {
        bucket.active += 1;
      }
    });

    if (openedDate && openedDate.getTime() > lastBucketDate.getTime()) {
      buckets[buckets.length - 1].opened += 1;
      if (!resolvedDate || resolvedDate.getTime() > lastBucketDate.getTime()) {
        buckets[buckets.length - 1].active += 1;
      }
    }
  }

  return buckets.map(({ label, opened, resolved, active }) => ({ label, opened, resolved, active }));
};

export const formatRelativeDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatHours = (hours: number | null) => {
  if (hours === null || !Number.isFinite(hours)) return "--";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

export const averageHoursBetween = <T,>(items: T[], getStartedAt: (item: T) => string | null | undefined, getEndedAt: (item: T) => string | null | undefined) => {
  const durations = items
    .map((item) => {
      const startedAt = getStartedAt(item);
      const endedAt = getEndedAt(item);
      if (!startedAt || !endedAt) return null;
      const start = new Date(startedAt).getTime();
      const end = new Date(endedAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
      return (end - start) / 36e5;
    })
    .filter((value): value is number => value !== null);

  if (durations.length === 0) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
};

export const uniqueCount = <T,>(items: T[], getKey: (item: T) => string | null | undefined) => {
  const keys = new Set(items.map(getKey).filter((value): value is string => Boolean(value)));
  return keys.size;
};

export const dedupeBy = <T,>(items: T[], getKey: (item: T) => string | null | undefined) => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  items.forEach((item) => {
    const key = getKey(item)?.trim().toLowerCase();
    if (!key) {
      deduped.push(item);
      return;
    }
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
};

export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
