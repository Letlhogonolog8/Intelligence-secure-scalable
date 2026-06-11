/**
 * Enhanced Police Dashboard Utilities
 * Performance monitoring, caching, and optimization features
 */

import type { AlertItem, OrganizationCoordination } from "@/data/aegisData";
import type { LiveJusticeCase } from "@/data/liveDashboardData";

export type EnhancedPoliceCase = LiveJusticeCase & {
  isUrgent: boolean;
  isStale: boolean;
  needsAttention: boolean;
};

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

class PoliceDashboardMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  startTracking(operation: string) {
    this.startTimes.set(operation, performance.now());
  }

  endTracking(operation: string) {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    const existing = this.metrics.get(operation) || [];
    existing.push(duration);
    this.metrics.set(operation, existing.slice(-10)); // Keep last 10
    this.startTimes.delete(operation);
  }

  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation) || [];
    if (times.length === 0) return 0;
    return times.reduce((sum, t) => sum + t, 0) / times.length;
  }

  getReport() {
    const report: Record<string, { avg: number; count: number }> = {};
    this.metrics.forEach((times, operation) => {
      report[operation] = {
        avg: Math.round(this.getAverageTime(operation)),
        count: times.length,
      };
    });
    return report;
  }

  logReport() {
    if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") {
      return;
    }

    const report = this.getReport();
    console.group("🚔 Police Dashboard Performance");
    Object.entries(report).forEach(([operation, stats]) => {
      console.log(`${operation}: ${stats.avg}ms (${stats.count} samples)`);
    });
    console.groupEnd();
  }
}

export const policeMonitor = new PoliceDashboardMonitor();

// ============================================================================
// CACHING LAYER
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PoliceDashboardCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  set<T>(key: string, data: T, ttl = 30000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const policeCache = new PoliceDashboardCache();

// ============================================================================
// ENHANCED DATA NORMALIZATION
// ============================================================================

export const normalizePoliceCasesEnhanced = (items: LiveJusticeCase[]): EnhancedPoliceCase[] => {
  policeMonitor.startTracking("normalizeCases");
  
  const cacheKey = `cases-${items.length}-${items.map((item) => `${item.id}:${item.updatedAt ?? item.createdAt ?? "na"}`).join("|")}`;
  const cached = policeCache.get<EnhancedPoliceCase[]>(cacheKey);
  if (cached) {
    policeMonitor.endTracking("normalizeCases");
    return cached;
  }

  const normalized: EnhancedPoliceCase[] = items
    .filter((entry) => entry.id && entry.caseNumber)
    .map((entry) => ({
      ...entry,
      status: (entry.status || "open").toLowerCase(),
      stage: (entry.stage || "intake").toLowerCase(),
      priority: (entry.priority || "medium").toLowerCase() as LiveJusticeCase["priority"],
      region: entry.region || "Region pending",
      updatedAt: entry.updatedAt || entry.createdAt || undefined,
      assignedTo: entry.assignedTo || "",
      // Enhanced fields
      isUrgent: entry.priority === "critical" || entry.priority === "high",
      isStale: entry.daysOpen ? entry.daysOpen > 14 : false,
      needsAttention: !entry.assignedTo || Boolean(entry.daysOpen && entry.daysOpen > 7),
    }));

  policeCache.set(cacheKey, normalized, 15000);
  policeMonitor.endTracking("normalizeCases");
  return normalized;
};

// ============================================================================
// SMART QUEUE MANAGEMENT
// ============================================================================

export interface QueueMetrics {
  totalCases: number;
  criticalCases: number;
  highPriorityCases: number;
  unassignedCases: number;
  staleCases: number;
  avgDaysOpen: number;
  medianDaysOpen: number;
}

export const calculateQueueMetrics = (cases: LiveJusticeCase[]): QueueMetrics => {
  policeMonitor.startTracking("queueMetrics");

  const openCases = cases.filter((c) => !["closed", "resolved"].includes(c.status.toLowerCase()));
  const daysOpenArray = openCases.map((c) => c.daysOpen || 0).sort((a, b) => a - b);
  
  const metrics: QueueMetrics = {
    totalCases: openCases.length,
    criticalCases: openCases.filter((c) => c.priority === "critical").length,
    highPriorityCases: openCases.filter((c) => c.priority === "high").length,
    unassignedCases: openCases.filter((c) => !c.assignedTo).length,
    staleCases: openCases.filter((c) => (c.daysOpen || 0) > 14).length,
    avgDaysOpen: daysOpenArray.length > 0
      ? Math.round(daysOpenArray.reduce((sum, d) => sum + d, 0) / daysOpenArray.length)
      : 0,
    medianDaysOpen: daysOpenArray.length > 0
      ? (daysOpenArray.length % 2 === 0
          ? Math.round((daysOpenArray[daysOpenArray.length / 2 - 1] + daysOpenArray[daysOpenArray.length / 2]) / 2)
          : daysOpenArray[Math.floor(daysOpenArray.length / 2)])
      : 0,
  };

  policeMonitor.endTracking("queueMetrics");
  return metrics;
};

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

export interface CasePrediction {
  caseId: string;
  predictedResolutionDays: number;
  riskOfEscalation: "low" | "medium" | "high";
  recommendedAction: string;
  confidence: number;
}

export const predictCaseOutcome = (caseItem: LiveJusticeCase): CasePrediction => {
  const daysOpen = caseItem.daysOpen || 0;
  const hasAssignment = Boolean(caseItem.assignedTo);
  const priority = caseItem.priority;

  // Simple heuristic-based prediction (can be replaced with ML model)
  let predictedDays = 30;
  let riskLevel: "low" | "medium" | "high" = "low";
  let action = "Continue monitoring";
  let confidence = 0.7;

  if (priority === "critical") {
    predictedDays = hasAssignment ? 7 : 14;
    riskLevel = hasAssignment ? "medium" : "high";
    action = hasAssignment ? "Expedite resolution" : "Assign immediately";
    confidence = 0.85;
  } else if (priority === "high") {
    predictedDays = hasAssignment ? 14 : 21;
    riskLevel = daysOpen > 7 ? "medium" : "low";
    action = daysOpen > 7 ? "Review progress" : "Monitor closely";
    confidence = 0.75;
  } else {
    predictedDays = 30;
    riskLevel = daysOpen > 21 ? "medium" : "low";
    action = daysOpen > 21 ? "Consider reassignment" : "Standard processing";
    confidence = 0.65;
  }

  return {
    caseId: caseItem.id,
    predictedResolutionDays: predictedDays,
    riskOfEscalation: riskLevel,
    recommendedAction: action,
    confidence,
  };
};

// ============================================================================
// WORKLOAD BALANCING
// ============================================================================

export interface OfficerWorkload {
  officerId: string;
  assignedCases: number;
  criticalCases: number;
  avgCaseAge: number;
  capacity: "available" | "moderate" | "full" | "overloaded";
  recommendedAssignments: number;
}

export const calculateOfficerWorkloads = (
  officers: Array<{ id: string; isActive: boolean }>,
  cases: LiveJusticeCase[]
): OfficerWorkload[] => {
  policeMonitor.startTracking("workloadCalculation");

  const activeOfficers = officers.filter((o) => o.isActive);
  const openCases = cases.filter((c) => !["closed", "resolved"].includes(c.status.toLowerCase()));

  const workloads = activeOfficers.map((officer) => {
    const assignedCases = openCases.filter((c) => c.assignedTo === officer.id);
    const criticalCases = assignedCases.filter((c) => c.priority === "critical");
    const avgCaseAge = assignedCases.length > 0
      ? Math.round(assignedCases.reduce((sum, c) => sum + (c.daysOpen || 0), 0) / assignedCases.length)
      : 0;

    let capacity: OfficerWorkload["capacity"] = "available";
    let recommendedAssignments = 5;

    if (assignedCases.length === 0) {
      capacity = "available";
      recommendedAssignments = 5;
    } else if (assignedCases.length <= 3) {
      capacity = "moderate";
      recommendedAssignments = 3;
    } else if (assignedCases.length <= 6) {
      capacity = "full";
      recommendedAssignments = 1;
    } else {
      capacity = "overloaded";
      recommendedAssignments = 0;
    }

    return {
      officerId: officer.id,
      assignedCases: assignedCases.length,
      criticalCases: criticalCases.length,
      avgCaseAge,
      capacity,
      recommendedAssignments,
    };
  });

  policeMonitor.endTracking("workloadCalculation");
  return workloads.sort((a, b) => a.assignedCases - b.assignedCases);
};

// ============================================================================
// ALERT PRIORITIZATION
// ============================================================================

export interface PrioritizedAlert extends AlertItem {
  priorityScore: number;
  urgencyLevel: "immediate" | "high" | "normal" | "low";
  estimatedResponseTime: number; // minutes
}

export const prioritizeAlerts = (alerts: AlertItem[]): PrioritizedAlert[] => {
  return alerts.map((alert) => {
    let priorityScore = 50;
    let urgencyLevel: PrioritizedAlert["urgencyLevel"] = "normal";
    let estimatedResponseTime = 30;

    // Score based on type
    if (alert.type === "critical") {
      priorityScore += 40;
      urgencyLevel = "immediate";
      estimatedResponseTime = 5;
    } else if (alert.type === "warning") {
      priorityScore += 20;
      urgencyLevel = "high";
      estimatedResponseTime = 15;
    }

    // Score based on module
    if (alert.module === "emergency") {
      priorityScore += 30;
    } else if (alert.module === "dispatch") {
      priorityScore += 20;
    }

    // Score based on status
    if (alert.status === "pending") {
      priorityScore += 10;
    }

    return {
      ...alert,
      priorityScore: Math.min(100, priorityScore),
      urgencyLevel,
      estimatedResponseTime,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
};

// ============================================================================
// COORDINATION INSIGHTS
// ============================================================================

export interface CoordinationInsight {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  avgCompletionTime: number; // hours
  topPartners: Array<{ partnerId: string; count: number }>;
  bottlenecks: Array<{ type: string; count: number }>;
}

export const analyzeCoordination = (referrals: OrganizationCoordination[]): CoordinationInsight => {
  const pending = referrals.filter((r) => r.status === "pending");
  const completed = referrals.filter((r) => r.status === "completed");

  const completionTimes = completed
    .map((r) => {
      if (!r.createdAt || !r.completedAt) return 0;
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.completedAt).getTime();
      return (end - start) / (1000 * 60 * 60); // hours
    })
    .filter((t) => t > 0);

  const avgCompletionTime = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length)
    : 0;

  // Count by partner
  const partnerCounts = new Map<string, number>();
  referrals.forEach((r) => {
    const partner = (r.toOrganizationId || "").trim();
    if (!partner) return;
    partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
  });

  const topPartners = Array.from(partnerCounts.entries())
    .map(([partnerId, count]) => ({ partnerId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Identify bottlenecks
  const typeCounts = new Map<string, number>();
  pending.forEach((r) => {
    const type = r.referralType || "unknown";
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  const bottlenecks = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .filter(({ count }) => count > 2)
    .sort((a, b) => b.count - a.count);

  return {
    totalReferrals: referrals.length,
    pendingReferrals: pending.length,
    completedReferrals: completed.length,
    avgCompletionTime,
    topPartners,
    bottlenecks,
  };
};

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const exportQueueToCSV = (cases: LiveJusticeCase[]): string => {
  const headers = ["Case Number", "Priority", "Status", "Stage", "Region", "Assigned To", "Days Open", "Updated At"];
  const escapeCsvValue = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
  const rows = cases.map((c) => [
    c.caseNumber,
    c.priority,
    c.status,
    c.stage || "intake",
    c.region || "",
    c.assignedTo || "Unassigned",
    c.daysOpen?.toString() || "0",
    c.updatedAt || "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsvValue(String(value))).join(",")).join("\n");
  return csv;
};

export const downloadQueueReport = (cases: LiveJusticeCase[], filename = "police-queue-report.csv") => {
  if (typeof document === "undefined") return;

  const csv = exportQueueToCSV(cases);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
