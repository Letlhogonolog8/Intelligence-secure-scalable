/**
 * Performance monitoring utility for Survivor Dashboard
 * Tracks key metrics and provides insights for optimization
 */

type PerformanceMetric = {
  name: string;
  value: number;
  timestamp: number;
};

type PerformanceReport = {
  metrics: PerformanceMetric[];
  summary: {
    avgLoadTime: number;
    avgApiTime: number;
    totalApiCalls: number;
    errorRate: number;
  };
};

class DashboardPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private apiCalls = 0;
  private errors = 0;
  private startTime = 0;

  start(metricName: string) {
    this.startTime = performance.now();
    return () => this.end(metricName);
  }

  end(metricName: string) {
    const duration = performance.now() - this.startTime;
    this.metrics.push({
      name: metricName,
      value: duration,
      timestamp: Date.now(),
    });
  }

  trackApiCall() {
    this.apiCalls++;
  }

  trackError() {
    this.errors++;
  }

  getReport(): PerformanceReport {
    const loadMetrics = this.metrics.filter((m) => m.name.includes("load"));
    const apiMetrics = this.metrics.filter((m) => m.name.includes("api"));

    const avgLoadTime = loadMetrics.length
      ? loadMetrics.reduce((sum, m) => sum + m.value, 0) / loadMetrics.length
      : 0;

    const avgApiTime = apiMetrics.length
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
      : 0;

    const errorRate = this.apiCalls > 0 ? (this.errors / this.apiCalls) * 100 : 0;

    return {
      metrics: this.metrics,
      summary: {
        avgLoadTime: Math.round(avgLoadTime),
        avgApiTime: Math.round(avgApiTime),
        totalApiCalls: this.apiCalls,
        errorRate: Math.round(errorRate * 100) / 100,
      },
    };
  }

  reset() {
    this.metrics = [];
    this.apiCalls = 0;
    this.errors = 0;
    this.startTime = 0;
  }

  logReport() {
    const report = this.getReport();
    console.group("📊 Dashboard Performance Report");
    console.log("Average Load Time:", `${report.summary.avgLoadTime}ms`);
    console.log("Average API Time:", `${report.summary.avgApiTime}ms`);
    console.log("Total API Calls:", report.summary.totalApiCalls);
    console.log("Error Rate:", `${report.summary.errorRate}%`);
    console.groupEnd();
  }
}

export const dashboardMonitor = new DashboardPerformanceMonitor();

// React hook for performance monitoring
export const useDashboardPerformance = (componentName: string) => {
  const trackRender = () => {
    const end = dashboardMonitor.start(`${componentName}-render`);
    return end;
  };

  return { trackRender };
};
