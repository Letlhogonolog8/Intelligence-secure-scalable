import type { DatadogRumInit, RumUserAction } from '@datadog/browser-rum';

export interface DatadogConfig {
  applicationId: string;
  clientToken: string;
  service: string;
  env: string;
  version: string;
}

type DatadogRumModule = typeof import('@datadog/browser-rum');
type DatadogLogsModule = typeof import('@datadog/browser-logs');

let ddInitialized = false;
let rumModule: DatadogRumModule | null = null;
let logsModule: DatadogLogsModule | null = null;

const getRumApi = () => rumModule?.datadogRum;
const getLogsApi = () => logsModule?.datadogLogs;

export async function initDatadog(): Promise<void> {
  if (ddInitialized) {
    console.warn('Datadog already initialized');
    return;
  }

  if (import.meta.env.VITE_DATADOG_ENABLED !== 'true') {
    return;
  }

  try {
    const rum = await import('@datadog/browser-rum');
    const logs = await import('@datadog/browser-logs');

    rumModule = rum;
    logsModule = logs;

    const { datadogRum } = rum;
    const { datadogLogs } = logs;

    const config: DatadogRumInit = {
      applicationId: import.meta.env.VITE_DATADOG_APPLICATION_ID,
      clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
      site: 'datadoghq.com',
      service: import.meta.env.VITE_DATADOG_SERVICE || 'aegis-web',
      env: import.meta.env.VITE_DATADOG_ENV || 'development',
      version: import.meta.env.VITE_DATADOG_VERSION || '1.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      trackFrustrations: true,
      defaultPrivacyLevel: 'mask-user-input',
      actionNameAttribute: 'data-dd-action-name',
    };

    datadogRum.init(config);
    datadogRum.startSessionReplayRecording();

    datadogLogs.init({
      clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
      site: 'datadoghq.com',
      forwardErrorsToLogs: true,
      forwardConsoleLogs: ['error', 'warn'],
      sessionSampleRate: 100,
      service: import.meta.env.VITE_DATADOG_SERVICE || 'aegis-web',
      env: import.meta.env.VITE_DATADOG_ENV || 'development',
    });

    ddInitialized = true;
    console.log('✅ Datadog RUM and Logs initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Datadog:', error);
  }
}

export function trackUserAction(
  name: string,
  context?: Record<string, unknown>
): void {
  const rumApi = getRumApi();
  if (!ddInitialized || !rumApi) return;

  try {
    const action: RumUserAction = {
      name,
      context,
    };
    rumApi.addUserAction(action.name, action.context);
  } catch (error) {
    console.error('Error tracking user action:', error);
  }
}

export function trackError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const logsApi = getLogsApi();
  if (!ddInitialized || !logsApi) return;

  try {
    logsApi.logger.error(error.message, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  } catch (err) {
    console.error('Error logging error to Datadog:', err);
  }
}

export function addGlobalContext(
  key: string,
  value: unknown
): void {
  const rumApi = getRumApi();
  const logsApi = getLogsApi();
  if (!ddInitialized || !rumApi || !logsApi) return;

  try {
    rumApi.addRumGlobalContext(key, value);
    logsApi.addLoggerGlobalContext(key, value);
  } catch (error) {
    console.error('Error adding global context:', error);
  }
}

export function setUser(user: {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}): void {
  const rumApi = getRumApi();
  const logsApi = getLogsApi();
  if (!ddInitialized || !rumApi || !logsApi) return;

  try {
    rumApi.setUser({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    logsApi.setUserContext({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    addGlobalContext('user', user);
  } catch (error) {
    console.error('Error setting user context:', error);
  }
}

export function clearUser(): void {
  const rumApi = getRumApi();
  const logsApi = getLogsApi();
  if (!ddInitialized || !rumApi || !logsApi) return;

  try {
    rumApi.clearUser();
    logsApi.clearUserContext();
  } catch (error) {
    console.error('Error clearing user context:', error);
  }
}

export function startView(name: string): void {
  const rumApi = getRumApi();
  if (!ddInitialized || !rumApi) return;

  try {
    rumApi.startView({ name });
  } catch (error) {
    console.error('Error starting view:', error);
  }
}

export async function captureException(
  error: Error,
  context?: Record<string, unknown>
): Promise<void> {
  const rumApi = getRumApi();
  const logsApi = getLogsApi();
  if (!ddInitialized || !rumApi || !logsApi) {
    console.error('Datadog not initialized, cannot capture exception:', error);
    return;
  }

  try {
    const errorContext = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...context,
    };

    rumApi.addError(error, errorContext);
    logsApi.logger.error(error.message, errorContext);
  } catch (err) {
    console.error('Error capturing exception:', err);
  }
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  const logsApi = getLogsApi();
  if (!ddInitialized || !logsApi) {
    console.log(message, context);
    return;
  }

  try {
    logsApi.logger.info(message, context);
  } catch (error) {
    console.error('Error logging info:', error);
  }
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  const logsApi = getLogsApi();
  if (!ddInitialized || !logsApi) {
    console.warn(message, context);
    return;
  }

  try {
    logsApi.logger.warn(message, context);
  } catch (error) {
    console.error('Error logging warning:', error);
  }
}

export function logDebug(message: string, context?: Record<string, unknown>): void {
  const logsApi = getLogsApi();
  if (!ddInitialized || !logsApi) {
    console.debug(message, context);
    return;
  }

  try {
    logsApi.logger.debug(message, context);
  } catch (error) {
    console.error('Error logging debug:', error);
  }
}
