import { StatsD } from 'node-statsd';

let statsdClient: StatsD | null = null;

export function initializeDatadog(): StatsD | null {
  if (!process.env.DATADOG_ENABLED || process.env.DATADOG_ENABLED !== 'true') {
    console.log('⚠️ Datadog is disabled');
    return null;
  }

  try {
    statsdClient = new StatsD({
      host: process.env.DATADOG_AGENT_HOST || 'localhost',
      port: parseInt(process.env.DATADOG_AGENT_PORT || '8125'),
      prefix: 'aegis.',
      cacheDns: true,
      stream: process.env.NODE_ENV !== 'production',
    });

    statsdClient.gauge('app.startup', 1, ['service:api']);
    console.log('✅ Datadog client initialized');
    return statsdClient;
  } catch (error) {
    console.error('❌ Failed to initialize Datadog:', error);
    return null;
  }
}

export function trackMetric(metric: string, value: number, tags?: string[]): void {
  if (!statsdClient) return;
  try {
    statsdClient.gauge(metric, value, tags);
  } catch (error) {
    console.error(`Error tracking metric ${metric}:`, error);
  }
}

export function incrementCounter(
  metric: string,
  count: number = 1,
  tags?: string[]
): void {
  if (!statsdClient) return;
  try {
    statsdClient.increment(metric, count, tags);
  } catch (error) {
    console.error(`Error incrementing counter ${metric}:`, error);
  }
}

export function trackTiming(metric: string, ms: number, tags?: string[]): void {
  if (!statsdClient) return;
  try {
    statsdClient.timing(metric, ms, tags);
  } catch (error) {
    console.error(`Error tracking timing ${metric}:`, error);
  }
}

export function trackDistribution(
  metric: string,
  value: number,
  tags?: string[]
): void {
  if (!statsdClient) return;
  try {
    statsdClient.distribution(metric, value, tags);
  } catch (error) {
    console.error(`Error tracking distribution ${metric}:`, error);
  }
}

export function trackSet(metric: string, value: string, tags?: string[]): void {
  if (!statsdClient) return;
  try {
    statsdClient.set(metric, value, tags);
  } catch (error) {
    console.error(`Error tracking set ${metric}:`, error);
  }
}

export function trackCheckStatus(
  check: string,
  status: number,
  tags?: string[]
): void {
  if (!statsdClient) return;
  try {
    statsdClient.check(check, status, tags);
  } catch (error) {
    console.error(`Error tracking check ${check}:`, error);
  }
}

export async function closeDatadog(): Promise<void> {
  if (!statsdClient) return;

  return new Promise((resolve) => {
    statsdClient!.close(() => {
      console.log('✅ Datadog client closed');
      resolve();
    });
  });
}

export function getDatadogClient(): StatsD | null {
  return statsdClient;
}

export const datadogTags = {
  environment: process.env.DATADOG_ENV || 'development',
  service: process.env.DATADOG_SERVICE || 'aegis-api',
  version: process.env.DATADOG_VERSION || '1.0.0',
  region: process.env.VITE_DEPLOYMENT_REGION || 'unknown',
};
