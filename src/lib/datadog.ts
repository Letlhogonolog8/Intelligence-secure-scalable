import type { DatadogRumInit, RumUserAction } from '@datadog/browser-rum';

export interface DatadogConfig {
  applicationId: string;
  clientToken: string;
  service: string;
  env: string;
  version: string;
}

let ddInitialized = false;

export async function initDatadog(): Promise<void> {
  if (ddInitialized) {
    console.warn('Datadog already initialized');
    return;
  }

  if (import.meta.env.VITE_DATADOG_ENABLED !== 'true') {
    console.log('Datadog is disabled');
    return;
  }

  try {
    const { datadogRum } = await import('@datadog/browser-rum');
    const { datadogLogs } = await import('@datadog/browser-logs');

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
  context?: Record<string, any>
): void {
  if (!ddInitialized) return;

  try {
    const { datadogRum } = require('@datadog/browser-rum');
    const action: RumUserAction = {
      name,
      context,
    };
    datadogRum.addUserAction(action.name, action.context);
  } catch (error) {
    console.error('Error tracking user action:', error);
  }
}

export function trackError(
  error: Error,
  context?: Record<string, any>
): void {
  if (!ddInitialized) return;

  try {
    const { datadogLogs } = require('@datadog/browser-logs');
    datadogLogs.logger.error(error.message, {
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
  value: any
): void {
  if (!ddInitialized) return;

  try {
    const { datadogRum, datadogLogs } = require('@datadog/browser-rum');
    datadogRum.addRumGlobalContext(key, value);
    datadogLogs.addLoggerGlobalContext(key, value);
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
  if (!ddInitialized) return;

  try {
    const { datadogRum, datadogLogs } = require('@datadog/browser-rum');
    datadogRum.setUser({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    datadogLogs.setUserContext({
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
  if (!ddInitialized) return;

  try {
    const { datadogRum, datadogLogs } = require('@datadog/browser-rum');
    datadogRum.clearUser();
    datadogLogs.clearUserContext();
  } catch (error) {
    console.error('Error clearing user context:', error);
  }
}

export function startView(name: string): void {
  if (!ddInitialized) return;

  try {
    const { datadogRum } = require('@datadog/browser-rum');
    datadogRum.startView({ name });
  } catch (error) {
    console.error('Error starting view:', error);
  }
}

export async function captureException(
  error: Error,
  context?: Record<string, any>
): Promise<void> {
  if (!ddInitialized) {
    console.error('Datadog not initialized, cannot capture exception:', error);
    return;
  }

  try {
    const { datadogRum, datadogLogs } = require('@datadog/browser-rum');

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

    datadogRum.addError(error, errorContext);
    datadogLogs.logger.error(error.message, errorContext);
  } catch (err) {
    console.error('Error capturing exception:', err);
  }
}

export function logInfo(message: string, context?: Record<string, any>): void {
  if (!ddInitialized) {
    console.log(message, context);
    return;
  }

  try {
    const { datadogLogs } = require('@datadog/browser-logs');
    datadogLogs.logger.info(message, context);
  } catch (error) {
    console.error('Error logging info:', error);
  }
}

export function logWarn(message: string, context?: Record<string, any>): void {
  if (!ddInitialized) {
    console.warn(message, context);
    return;
  }

  try {
    const { datadogLogs } = require('@datadog/browser-logs');
    datadogLogs.logger.warn(message, context);
  } catch (error) {
    console.error('Error logging warning:', error);
  }
}

export function logDebug(message: string, context?: Record<string, any>): void {
  if (!ddInitialized) {
    console.debug(message, context);
    return;
  }

  try {
    const { datadogLogs } = require('@datadog/browser-logs');
    datadogLogs.logger.debug(message, context);
  } catch (error) {
    console.error('Error logging debug:', error);
  }
}
