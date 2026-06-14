/**
 * Email delivery for the notification worker.
 *
 * Uses the Resend HTTP API (https://resend.com/docs/api-reference/emails)
 * via native fetch — no extra server dependency, mirroring expoPush. The
 * worker calls `sendEmail` for every notification_queue row whose
 * recipient_type is 'email'. Degrades gracefully (not_configured) when no API
 * key is set, exactly like Twilio/Expo, so the queue never hard-fails.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  status: string;
  error?: string;
  /** True when the provider isn't configured (no API key) — caller may skip retries. */
  notConfigured?: boolean;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function isValidEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      status: "not_configured",
      error: "RESEND_API_KEY not set",
      notConfigured: true,
    };
  }

  if (!isValidEmail(to)) {
    return {
      success: false,
      status: "invalid_address",
      error: "Invalid email address",
    };
  }

  const from = process.env.EMAIL_FROM || "AEGIS-AI <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        // Plain-text body wrapped minimally; responders read these as alerts.
        text: body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        success: false,
        status: `http_${response.status}`,
        error: detail.slice(0, 200) || `Resend returned ${response.status}`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return { success: true, messageId: payload.id, status: "sent" };
  } catch (error) {
    return {
      success: false,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
