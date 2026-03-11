import { SupabaseClient } from '@supabase/supabase-js';

export interface LoadTestConfig {
  testId: string;
  concurrentUsers: number;
  requestsPerUser: number;
  requestDelay?: number;
  duration?: number;
  rampUpTime?: number;
  menus?: string[];
  languages?: string[];
  endpointUrl?: string;
  requestTimeoutMs?: number;
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
  throughput: number;
  duration: number;
  errorBreakdown: Record<string, number>;
}

interface GeneratedRequest {
  userId: string;
  phoneNumber: string;
  userInput: string;
  language: string;
  menu: string;
  timestamp: number;
}

interface LoadTestRequestResult extends GeneratedRequest {
  success: boolean;
  responseTime?: number;
  error?: string;
}

interface StressTestResult {
  testId: string;
  results: LoadTestMetrics[];
  maxSuccessfulUsers: number;
  successfulRunsCount: number;
}

interface LoadTestRecord {
  test_id: string;
  concurrent_users: number;
  requests_per_user: number;
  total_requests: number;
  status: string;
}

export class USSDLoadTest {
  private supabase: SupabaseClient;
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  public async runLoadTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
    console.log(`🚀 Starting load test: ${config.testId}`);
    console.log(`   Concurrent users: ${config.concurrentUsers}`);
    console.log(`   Requests per user: ${config.requestsPerUser}`);

    this.responseTimes = [];
    this.errors.clear();

    const startTime = Date.now();

    await this.createTestRecord(config);

    const requests = this.generateRequests(config);
    const results = await this.executeRequests(requests, config);
    const duration = (Date.now() - startTime) / 1000;
    const metrics = this.calculateMetrics(config, results, duration);

    await this.storeMetrics(metrics);
    this.printReport(metrics);

    return metrics;
  }

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
      requestsPerUser: Math.ceil(durationSeconds * 2),
      duration: durationSeconds,
      requestDelay: 500,
    };

    return this.runLoadTest(config);
  }

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

  public async runStressTest(
    startUsers: number,
    incrementUsers: number,
    incrementInterval: number,
    maxUsers: number = 10000
  ): Promise<StressTestResult> {
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

      if (metrics.successRate < 95) {
        console.log(`⚠️  Failure rate exceeded 5% threshold at ${currentUsers} users`);
        break;
      }

      currentUsers += incrementUsers;
      await this.sleep(incrementInterval * 1000);
    }

    return {
      testId,
      results,
      maxSuccessfulUsers: currentUsers - incrementUsers,
      successfulRunsCount: results.length,
    };
  }

  public async runEnduranceTest(
    concurrentUsers: number,
    durationMinutes: number
  ): Promise<LoadTestMetrics[]> {
    const testId = `endurance_${Date.now()}`;

    console.log(`⏳ Running endurance test: ${durationMinutes} minutes`);

    const results: LoadTestMetrics[] = [];
    const iterations = durationMinutes;
    const durationPerIteration = 60;

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

  public async runScenarioTest(): Promise<LoadTestMetrics> {
    const testId = `scenario_${Date.now()}`;

    console.log('🎬 Running realistic scenario test');

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
        totalMetrics = { ...metrics };
      } else {
        totalMetrics.totalRequests += metrics.totalRequests;
        totalMetrics.successfulRequests += metrics.successfulRequests;
        totalMetrics.failedRequests += metrics.failedRequests;
        totalMetrics.successRate = (totalMetrics.successfulRequests / totalMetrics.totalRequests) * 100;
      }
    }

    return totalMetrics as LoadTestMetrics;
  }

  private async createTestRecord(config: LoadTestConfig): Promise<LoadTestRecord | null> {
    try {
      const record: LoadTestRecord = {
        test_id: config.testId,
        concurrent_users: config.concurrentUsers,
        requests_per_user: config.requestsPerUser,
        total_requests: config.concurrentUsers * config.requestsPerUser,
        status: 'running',
      };

      const { error } = await this.supabase.from('ussd_load_test_metrics').insert(record);

      if (error) {
        throw error;
      }

      return record;
    } catch (error) {
      console.error('Failed to create test record:', error);
      return null;
    }
  }

  private generateRequests(config: LoadTestConfig): GeneratedRequest[] {
    const requests: GeneratedRequest[] = [];

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

  private async executeRequests(
    requests: GeneratedRequest[],
    config: LoadTestConfig
  ): Promise<LoadTestRequestResult[]> {
    const batches: Promise<LoadTestRequestResult[]>[] = [];
    const batchSize = config.concurrentUsers;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromise = Promise.all(
        batch.map(async (request): Promise<LoadTestRequestResult> => {
          try {
            const startTime = Date.now();
            await this.simulateUSSDRequest(request, config);
            const responseTime = Date.now() - startTime;

            this.responseTimes.push(responseTime);

            return {
              ...request,
              success: true,
              responseTime,
            };
          } catch (error) {
            const errorType = String(error).substring(0, 50);
            this.errors.set(errorType, (this.errors.get(errorType) || 0) + 1);

            return {
              ...request,
              success: false,
              error: String(error),
            };
          }
        })
      );

      batches.push(batchPromise);

      if (config.rampUpTime && i < requests.length - batchSize) {
        const batchDelay = (config.rampUpTime * 1000) / (requests.length / batchSize);
        await this.sleep(batchDelay);
      }
    }

    const allResults = await Promise.all(batches);
    return allResults.flat();
  }

  private async simulateUSSDRequest(request: GeneratedRequest, config?: LoadTestConfig): Promise<void> {
    const endpointUrl = config?.endpointUrl || process.env.USSD_LOAD_TEST_URL;

    if (endpointUrl) {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: request.phoneNumber,
          userInput: request.userInput,
          language: request.language,
        }),
        signal: AbortSignal.timeout(config?.requestTimeoutMs || 10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return;
    }

    const networkLatency = Math.random() * 100 + 50;
    const processingTime = Math.random() * 200 + 100;

    await new Promise((resolve) => {
      setTimeout(resolve, networkLatency + processingTime);
    });
  }

  private calculateMetrics(
    config: LoadTestConfig,
    results: LoadTestRequestResult[],
    duration: number
  ): LoadTestMetrics {
    const successful = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success).length;
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
      return sortedTimes[Math.max(0, index)] || 0;
    };

    const totalResponseTime = sortedTimes.reduce((sum, time) => sum + time, 0);
    const safeDuration = Math.max(duration, 1);

    return {
      testId: config.testId,
      concurrentUsers: config.concurrentUsers,
      totalRequests: results.length,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
      avgResponseTime: sortedTimes.length > 0 ? totalResponseTime / sortedTimes.length : 0,
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      p50ResponseTime: percentile(50),
      p95ResponseTime: percentile(95),
      p99ResponseTime: percentile(99),
      requestsPerSecond: results.length / safeDuration,
      throughput: (results.length / safeDuration) * 60,
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
Successful: ${metrics.successfulRequests} (${metrics.successRate.toFixed(2)}%)`);
  }

  private generateInput(menu: string): string {
    switch (menu) {
      case 'main':
        return '1';
      case 'report_details':
        return 'Need urgent help';
      case 'help_details':
        return '2';
      case 'case_reference':
        return 'CASE123';
      default:
        return '0';
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default USSDLoadTest;
