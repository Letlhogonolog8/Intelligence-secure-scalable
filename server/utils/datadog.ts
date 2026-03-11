import StatsD from 'hot-shots';

interface StatsDClient {
  gauge(stat: string, value: number, tags?: string[]): void;
  increment(stat: string, value?: number, tags?: string[]): void;
  timing(stat: string, time: number, tags?: string[]): void;
  distribution(stat: string, value: number, tags?: string[]): void;
  set(stat: string, value: string, tags?: string[]): void;
  check(name: string, status: number, tags?: string[]): void;
  close(callback?: () => void): void;
}

class NoopStatsD implements StatsDClient {
  gauge(_stat: string, _value: number, _tags?: string[]): void {}
  increment(_stat: string, _value?: number, _tags?: string[]): void {}
  timing(_stat: string, _time: number, _tags?: string[]): void {}
  distribution(_stat: string, _value: number, _tags?: string[]): void {}
  set(_stat: string, _value: string, _tags?: string[]): void {}
  check(_name: string, _status: number, _tags?: string[]): void {}
  close(callback?: () => void): void {
    callback?.();
  }
}

let statsdClient: StatsDClient | null = null;

function getDefaultTags(): string[] {
  return [
    `env:${process.env.DATADOG_ENV || 'development'}`,
    `service:${process.env.DATADOG_SERVICE || 'aegis-api'}`,
    `version:${process.env.DATADOG_VERSION || '1.0.0'}`,
    `region:${process.env.DEPLOYMENT_REGION || process.env.VITE_DEPLOYMENT_REGION || 'unknown'}`,
  ];
}

export function initializeDatadog(): StatsDClient | null {
  if (statsdClient) {
    return statsdClient;
  }

  if (process.env.DATADOG_ENABLED !== 'true') {
    console.log('⚠️ Datadog is disabled');
    return null;
  }

  try {
    const client = new StatsD({
      host: process.env.DATADOG_AGENT_HOST || '127.0.0.1',
      port: Number(process.env.DATADOG_AGENT_PORT || 8125),
      prefix: process.env.DATADOG_METRIC_PREFIX || 'aegis.',
      globalTags: getDefaultTags(),
      errorHandler: (error) => {
        console.error('❌ Datadog client error:', error);
      },
    });

    statsdClient = client as unknown as StatsDClient;
    statsdClient.gauge('app.startup', 1);
    console.log('✅ Datadog client initialized');
    return statsdClient;
  } catch (error) {
    console.error('❌ Failed to initialize Datadog:', error);
    statsdClient = new NoopStatsD();
    return statsdClient;
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

  await new Promise<void>((resolve) => {
    statsdClient!.close(() => {
      console.log('✅ Datadog client closed');
      resolve();
    });
  });

  statsdClient = null;
}

export function getDatadogClient(): StatsDClient | null {
  return statsdClient;
}

export const datadogTags = {
  environment: process.env.DATADOG_ENV || 'development',
  service: process.env.DATADOG_SERVICE || 'aegis-api',
  version: process.env.DATADOG_VERSION || '1.0.0',
  region: process.env.DEPLOYMENT_REGION || process.env.VITE_DEPLOYMENT_REGION || 'unknown',
};
