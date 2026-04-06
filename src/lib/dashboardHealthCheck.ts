/**
 * Dashboard Health Check Utility
 * Validates system readiness and identifies potential issues
 */

import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  message: string;
  timestamp: number;
  duration: number;
};

export type HealthReport = {
  overall: HealthStatus;
  checks: HealthCheck[];
  timestamp: number;
};

const runCheck = async (
  name: string,
  checkFn: () => Promise<boolean>
): Promise<HealthCheck> => {
  const start = performance.now();
  try {
    const result = await checkFn();
    const duration = performance.now() - start;
    return {
      name,
      status: result ? "healthy" : "degraded",
      message: result ? "OK" : "Check failed",
      timestamp: Date.now(),
      duration: Math.round(duration),
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      name,
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
      duration: Math.round(duration),
    };
  }
};

export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!hasSupabase) return false;
  try {
    const { error } = await supabase.from("user_profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
};

export const checkAuthentication = async (): Promise<boolean> => {
  if (!hasSupabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
};

export const checkLocalStorage = async (): Promise<boolean> => {
  try {
    const testKey = "__aegis_health_check__";
    localStorage.setItem(testKey, "test");
    const value = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    return value === "test";
  } catch {
    return false;
  }
};

export const checkNetworkConnectivity = async (): Promise<boolean> => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

export const runDashboardHealthCheck = async (): Promise<HealthReport> => {
  const checks = await Promise.all([
    runCheck("Supabase Connection", checkSupabaseConnection),
    runCheck("Authentication", checkAuthentication),
    runCheck("Local Storage", checkLocalStorage),
    runCheck("Network Connectivity", checkNetworkConnectivity),
  ]);

  const unhealthyCount = checks.filter((c) => c.status === "unhealthy").length;
  const degradedCount = checks.filter((c) => c.status === "degraded").length;

  let overall: HealthStatus = "healthy";
  if (unhealthyCount > 0) {
    overall = "unhealthy";
  } else if (degradedCount > 0) {
    overall = "degraded";
  }

  return {
    overall,
    checks,
    timestamp: Date.now(),
  };
};

export const logHealthReport = (report: HealthReport) => {
  const statusEmoji = {
    healthy: "✅",
    degraded: "⚠️",
    unhealthy: "❌",
  };

  console.group(`${statusEmoji[report.overall]} Dashboard Health Check`);
  console.log("Overall Status:", report.overall.toUpperCase());
  console.log("Timestamp:", new Date(report.timestamp).toISOString());
  console.table(
    report.checks.map((c) => ({
      Check: c.name,
      Status: c.status,
      Duration: `${c.duration}ms`,
      Message: c.message,
    }))
  );
  console.groupEnd();
};

// Auto-run health check on module load in development
if (import.meta.env.DEV) {
  runDashboardHealthCheck().then(logHealthReport);
}
