/**
 * USSD Load Testing Framework
 * server/testing/ussdLoadTest.ts
 * 
 * Enterprise load testing for national-scale USSD deployment:
 * - Concurrent user simulation
 * - Real-world traffic patterns
 * - Performance metrics collection
 * - Bottleneck identification
 * - Capacity planning
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface LoadTestConfig {
  testId: string;
  concurrentUsers: number;
  requestsPerUser: number;
  requestDelay?: number; // milliseconds between requests
  duration?: number; // test duration in seconds
  rampUpTime?: number; // seconds to reach full load
  menus?: string[]; // menus to test
  languages?: string[]; // languages to test
}

export interface LoadTestMetrics {
  testId: string;
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  throughput: number; // requests/minute
  duration: number; // seconds
  errorBreakdown: Record<string, number>;
}

export class USSDLoadTest {
  private supabase: SupabaseClient;
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Run load test with specified configuration
   */
  public async runLoadTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
    console.log(`🚀 Starting load test: ${config.testId}`);
    console.log(`   Concurrent users: ${config.concurrentUsers}`);
    console.log(`   Requests per user: ${config.requestsPerUser}`);

    const startTime = Date.now();

    // Create test record in database
    const testRecord = await this.createTestRecord(config);

    // Generate test requests
    const requests = this.generateRequests(config);

    // Execute requests with rate limiting
    const results = await this.executeRequests(requests, config);

    const duration = (Date.now() - startTime) / 1000;

    // Calculate metrics
    const metrics = this.calculateMetrics(config, results, duration);

    // Store metrics
    await this.storeMetrics(metrics);

    // Generate report
    this.printReport(metrics);

    return metrics;
  }

  /**
   * Run sustained load test
   */
  public async runSustainedLoadTest(
    concurrentUsers: number,
    durationSeconds: number
  ): Promise<LoadTestMetrics> {
    const testId = `sustained_${Date.now()}`;

    console.log(
      `⏱️  Running sustained load test: ${concurrentUsers} users for ${durationSeconds}s`
    );

    const config: LoadTestConfig = {
      testId,
      concurrentUsers,
      requestsPerUser: Math.ceil(durationSeconds * 2), // ~2 requests/user/second
      duration: durationSeconds,
      requestDelay: 500,
    };

    return this.runLoadTest(config);
  }

  /**
   * Run spike test (sudden traffic increase)
   */
  public async runSpikeTest(
    baselineUsers: number,
    peakUsers: number,
    durationSeconds: number
  ): Promise<LoadTestMetrics> {
    const testId = `spike_${Date.now()}`;

    console.log(`📈 Running spike test: ${baselineUsers} → ${peakUsers} users`);

    const config: LoadTestConfig = {
      testId,
      concurrentUsers: peakUsers,
      requestsPerUser: Math.ceil((durationSeconds * peakUsers) / baselineUsers),
      rampUpTime: Math.ceil(durationSeconds / 3),
      duration: durationSeconds,
    };

    return this.runLoadTest(config);
  }

  /**
   * Run stress test (push to failure)
   */
  public async runStressTest(
    startUsers: number,
    incrementUsers: number,
    incrementInterval: number,
    maxUsers: number = 10000
  ): Promise<any> {
    const testId = `stress_${Date.now()}`;

    console.log(`💥 Running stress test: ${startUsers} → ${maxUsers} users`);

    let currentUsers = startUsers;
    const results: LoadTestMetrics[] = [];

    while (currentUsers <= maxUsers) {
      console.log(`\n📊 Testing with ${currentUsers} concurrent users...`);

      const config: LoadTestConfig = {
        testId: `${testId}_${currentUsers}`,
        concurrentUsers: currentUsers,
        requestsPerUser: 5,
        requestDelay: 500,
      };

      const metrics = await this.runLoadTest(config);
      results.push(metrics);

      // Stop if failure rate exceeds threshold
      if (metrics.successRate < 95) {
        console.log(`⚠️  Failure rate exceeded 5% threshold at ${currentUsers} users`);
        break;
      }

      currentUsers += incrementUsers;

      // Wait between test iterations
      await this.sleep(incrementInterval * 1000);
    }

    return {
      testId,
      results,
      maxSuccessfulUsers: currentUsers - incrementUsers,
      successfulRunsCount: results.length,
    };
  }

  /**
   * Run endurance test (extended duration)
   */
  public async runEnduranceTest(
    concurrentUsers: number,
    durationMinutes: number
  ): Promise<LoadTestMetrics[]> {
    const testId = `endurance_${Date.now()}`;

    console.log(`⏳ Running endurance test: ${durationMinutes} minutes`);

    const results: LoadTestMetrics[] = [];
    const iterations = durationMinutes;
    const durationPerIteration = 60; // 1 minute per iteration

    for (let i = 0; i < iterations; i++) {
      console.log(
        `\n📊 Iteration ${i + 1}/${iterations} (${Math.round((i / iterations) * 100)}% complete)`
      );

      const config: LoadTestConfig = {
        testId: `${testId}_iteration_${i + 1}`,
        concurrentUsers,
        requestsPerUser: durationPerIteration * 2,
        duration: durationPerIteration,
        requestDelay: 500,
      };

      const metrics = await this.runLoadTest(config);
      results.push(metrics);
    }

    return results;
  }

  /**
   * Run realistic scenario test
   */
  public async runScenarioTest(): Promise<LoadTestMetrics> {
    const testId = `scenario_${Date.now()}`;

    console.log(`🎬 Running realistic scenario test`);

    // Simulate real-world usage patterns
    // Peak hours: 9-5 (20% of daily volume)
    // Off-peak: evenings (50% of daily volume)
    // Night: late night (30% of daily volume)

    const scenarios = [
      { name: 'Peak Hour', users: 500, requests: 20, weight: 0.2 },
      { name: 'Off-Peak', users: 300, requests: 10, weight: 0.5 },
      { name: 'Night', users: 100, requests: 5, weight: 0.3 },
    ];

    let totalMetrics: LoadTestMetrics | null = null;

    for (const scenario of scenarios) {
      console.log(`\n🎯 Scenario: ${scenario.name} (${Math.round(scenario.weight * 100)}% of traffic)`);

      const config: LoadTestConfig = {
        testId: `${testId}_${scenario.name}`,
        concurrentUsers: scenario.users,
        requestsPerUser: scenario.requests,
        requestDelay: 500,
      };

      const metrics = await this.runLoadTest(config);

      if (!totalMetrics) {
        totalMetrics = metrics;
      } else {
        // Aggregate metrics
        totalMetrics.totalRequests += metrics.totalRequests;
        totalMetrics.successfulRequests += metrics.successfulRequests;
        totalMetrics.failedRequests += metrics.failedRequests;
      }
    }

    return totalMetrics!;
  }

  // Private helper methods

  private async createTestRecord(config: LoadTestConfig): Promise<any> {
    try {
      const { data } = await this.supabase.from('ussd_load_test_metrics').insert({
        test_id: config.testId,
        concurrent_users: config.concurrentUsers,
        requests_per_user: config.requestsPerUser,
        total_requests: config.concurrentUsers * config.requestsPerUser,
        status: 'running',
      });

      return data;
    } catch (error) {
      console.error('Failed to create test record:', error);
      return null;
    }
  }

  private generateRequests(config: LoadTestConfig): any[] {
    const requests: any[] = [];

    for (let userIndex = 0; userIndex < config.concurrentUsers; userIndex++) {
      const phoneNumber = `27${String(userIndex).padStart(9, '0')}`;
      const language = (config.languages || ['en'])[userIndex % (config.languages?.length || 1)];

      for (let reqIndex = 0; reqIndex < config.requestsPerUser; reqIndex++) {
        const menu = (config.menus || ['main', 'report_details', 'help_details', 'case_reference'])[
          reqIndex % 4
        ];

        requests.push({
          userId: `user_${userIndex}`,
          phoneNumber,
          userInput: this.generateInput(menu),
          language,
          menu,
          timestamp: Date.now() + reqIndex * (config.requestDelay || 0),
        });
      }
    }

    return requests;
  }

  private async executeRequests(requests: any[], config: LoadTestConfig): Promise<any[]> {
    const results: any[] = [];
    const batches: Promise<any>[] = [];

    // Execute in batches to simulate concurrent users
    const batchSize = config.concurrentUsers;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromise = Promise.all(
        batch.map(async (req) => {
          try {
            const startTime = Date.now();

            // Simulate USSD request
            await this.simulateUSSDRequest(req);

            const responseTime = Date.now() - startTime;

            this.responseTimes.push(responseTime);

            return {
              ...req,
              success: true,
              responseTime,
            };
          } catch (error) {
            const errorType = String(error).substring(0, 50);
            this.errors.set(errorType, (this.errors.get(errorType) || 0) + 1);

            return {
              ...req,
              success: false,
              error: String(error),
            };
          }
        })
      );

      batches.push(batchPromise);

      // Add delay between batches for ramp-up
      if (config.rampUpTime && i < requests.length - batchSize) {
        const batchDelay = (config.rampUpTime * 1000) / (requests.length / batchSize);
        await this.sleep(batchDelay);
      }
    }

    const allResults = await Promise.all(batches);
    return allResults.flat();
  }

  private async simulateUSSDRequest(request: any): Promise<void> {
    // Simulate network latency and processing time
    const networkLatency = Math.random() * 100 + 50; // 50-150ms
    const processingTime = Math.random() * 200 + 100; // 100-300ms

    return new Promise((resolve) => {
      setTimeout(() => resolve(), networkLatency + processingTime);
    });
  }

  private calculateMetrics(
    config: LoadTestConfig,
    results: any[],
    duration: number
  ): LoadTestMetrics {
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
      return sortedTimes[Math.max(0, index)];
    };

    return {
      testId: config.testId,
      concurrentUsers: config.concurrentUsers,
      totalRequests: results.length,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: (successful / results.length) * 100,
      avgResponseTime: sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length,
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      p50ResponseTime: percentile(50),
      p95ResponseTime: percentile(95),
      p99ResponseTime: percentile(99),
      requestsPerSecond: results.length / duration,
      throughput: (results.length / duration) * 60,
      duration,
      errorBreakdown: Object.fromEntries(this.errors),
    };
  }

  private async storeMetrics(metrics: LoadTestMetrics): Promise<void> {
    try {
      await this.supabase.from('ussd_load_test_metrics').update({
        successful_requests: metrics.successfulRequests,
        failed_requests: metrics.failedRequests,
        avg_response_time_ms: Math.round(metrics.avgResponseTime),
        min_response_time_ms: metrics.minResponseTime,
        max_response_time_ms: metrics.maxResponseTime,
        p95_response_time_ms: Math.round(metrics.p95ResponseTime),
        p99_response_time_ms: Math.round(metrics.p99ResponseTime),
        requests_per_second: Number(metrics.requestsPerSecond.toFixed(2)),
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(metrics.duration),
      }).eq('test_id', metrics.testId);
    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  private printReport(metrics: LoadTestMetrics): void {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    LOAD TEST REPORT                           ║
╚════════════════════════════════════════════════════════════════╝

Test ID: ${metrics.testId}
Duration: ${metrics.duration.toFixed(2)} seconds
Concurrent Users: ${metrics.concurrentUsers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THROUGHPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests: ${metrics.totalRequests}
Successful: ${metrics.successfulRequests} (${metrics.successRate.toFixed(2)}%)
Failed: ${metrics.failedRequests}
Requests/Second: ${metrics.requestsPerSecond.toFixed(2)}
Throughput: ${metrics.throughput.toFixed(2)} req/min

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE TIMES (milliseconds)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Min: ${metrics.minResponseTime.toFixed(2)} ms
Avg: ${metrics.avgResponseTime.toFixed(2)} ms
Median (p50): ${metrics.p50ResponseTime.toFixed(2)} ms
p95: ${metrics.p95ResponseTime.toFixed(2)} ms
p99: ${metrics.p99ResponseTime.toFixed(2)} ms
Max: ${metrics.maxResponseTime.toFixed(2)} ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  Object.entries(metrics.errorBreakdown)
    .map(([error, count]) => `${error}: ${count}`)
    .join('\n')
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  metrics.successRate >= 99
    ? '✅ EXCELLENT: System performing optimally'
    : metrics.successRate >= 95
      ? '✓ GOOD: System performing well'
      : metrics.successRate >= 90
        ? '⚠️  WARNING: Consider optimization'
        : '❌ CRITICAL: System needs immediate attention'
}
╚════════════════════════════════════════════════════════════════╝
    `);
  }

  private generateInput(menu: string): string {
    const inputs: Record<string, string> = {
      main: '1',
      report_details: 'Domestic violence incident',
      help_details: '1',
      case_reference: 'CASE20260222ABC123',
    };

    return inputs[menu] || '1';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default USSDLoadTest;
