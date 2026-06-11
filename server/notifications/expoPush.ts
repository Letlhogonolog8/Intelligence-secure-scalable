/**
 * Expo push delivery for the notification worker.
 *
 * Uses the Expo Push HTTP API directly (https://docs.expo.dev/push-notifications/sending-notifications/)
 * via native fetch — no extra server dependency. The worker calls
 * `sendExpoPush` for every notification_queue row whose recipient_type is
 * 'push'; the recipient_address holds the device's ExpoPushToken.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushResult {
  success: boolean;
  ticketId?: string;
  status: string;
  error?: string;
  /** True when Expo says this token is dead and should be deactivated. */
  invalidToken?: boolean;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function isExpoPushToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<ExpoPushResult> {
  if (!isExpoPushToken(token)) {
    return { success: false, status: 'invalid_token', error: 'Not an Expo push token', invalidToken: true };
  }

  const message = {
    to: token,
    sound: 'default',
    priority: 'high',
    channelId: 'emergency',
    title,
    body,
    data: data ?? {},
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // Optional but recommended for higher rate limits / security.
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      return {
        success: false,
        status: `http_${response.status}`,
        error: `Expo push API returned ${response.status}`,
      };
    }

    const payload = (await response.json()) as { data?: ExpoTicket | ExpoTicket[] };
    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;

    if (ticket && ticket.status === 'ok') {
      return { success: true, ticketId: ticket.id, status: 'sent' };
    }

    const errorCode = ticket?.details?.error;
    return {
      success: false,
      status: 'failed',
      error: ticket?.message || errorCode || 'Unknown Expo push error',
      invalidToken: errorCode === 'DeviceNotRegistered',
    };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
