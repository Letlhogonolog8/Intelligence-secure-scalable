import { SupabaseClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { sendExpoPush } from "./expoPush";
import { sendEmail } from "./email";

export interface NotificationPayload {
  recipientType: "sms" | "whatsapp" | "email";
  recipientAddress: string;
  messageType: string;
  messageContent: string;
  caseId?: string;
  userId?: string;
  priority?: "low" | "medium" | "high" | "critical";
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  status: string;
  sentAt: string;
  error?: string;
}

type QueueRecipientType = "sms" | "email" | "push" | "webhook";

interface NotificationQueueRecord {
  id: string;
  status?: string | null;
  sent_at?: string | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
  recipient_type?: QueueRecipientType | null;
  recipient_address?: string | null;
  message_content?: string | null;
  message_type?: string | null;
  case_id?: string | null;
}

interface PhoneDispatchOptions {
  channel: "sms" | "whatsapp";
  phoneNumber: string;
  message: string;
  messageType: string;
  caseId?: string;
  notificationId?: string;
  attemptCount?: number;
}

export class TwilioNotificationService {
  private supabase: SupabaseClient;
  private accountSid = process.env.TWILIO_ACCOUNT_SID;
  private authToken = process.env.TWILIO_AUTH_TOKEN;
  private fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  private whatsappFromNumber =
    process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  private client: ReturnType<typeof twilio> | null;
  private appBaseUrl = this.resolveAppBaseUrl();
  private notificationQueueAvailable = true;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    // Twilio's own SDK validates accountSid/authToken synchronously and
    // throws on a malformed value (e.g. a still-placeholder env var like
    // `[replace-with-twilio-account-sid]` copied from .env.example) — that
    // must not be allowed to crash server boot over an optional service.
    if (this.accountSid && this.authToken) {
      try {
        this.client = twilio(this.accountSid, this.authToken);
      } catch (error) {
        console.warn(
          "Twilio credentials present but invalid — phone notifications will remain failed in queue.",
          error instanceof Error ? error.message : error,
        );
        this.client = null;
      }
    } else {
      this.client = null;
    }

    if (this.client && this.fromPhoneNumber) {
      console.log("🔔 Twilio notification service initialized");
    } else {
      console.warn(
        "Twilio credentials or sender number not configured. Phone notifications will remain failed in queue.",
      );
    }
  }

  public async sendPoliceEmergency(
    policePhoneNumbers: string[],
    caseId: string,
    riskLevel: string,
    location: string,
    survivorContact?: string,
  ): Promise<NotificationResult[]> {
    const messageTemplate = `
🚨 AEGIS EMERGENCY ESCALATION 🚨
Case: ${caseId}
Risk: ${riskLevel.toUpperCase()}
Location: ${location}
${survivorContact ? `Contact: ${survivorContact}` : ""}

RESPOND IMMEDIATELY VIA APP
    `.trim();

    return Promise.all(
      policePhoneNumbers.map((phone) =>
        this.sendSMS(phone, messageTemplate, "emergency", caseId),
      ),
    );
  }

  public async sendCounselorAssignment(
    counselorPhoneNumber: string,
    caseId: string,
    survivorName: string,
    priority: string,
  ): Promise<NotificationResult> {
    const appLink = this.appBaseUrl
      ? `${this.appBaseUrl}/auth`
      : "the AEGIS app";
    const messageTemplate = `
📋 AEGIS CASE ASSIGNMENT
Case: ${caseId}
Survivor: ${survivorName}
Priority: ${priority}
Open: ${appLink}

Acknowledge in app to proceed.
    `.trim();

    return this.sendSMS(
      counselorPhoneNumber,
      messageTemplate,
      "assignment",
      caseId,
    );
  }

  public async sendSurvivorUpdate(
    survivorPhoneNumber: string,
    caseId: string,
    updateMessage: string,
  ): Promise<NotificationResult> {
    const messageTemplate = `
AEGIS Case Update
Case: ${caseId}
${updateMessage}

Reply with HELP for support.
    `.trim();

    return this.sendSMS(survivorPhoneNumber, messageTemplate, "update", caseId);
  }

  public async sendNGONotification(
    ngoContactPhoneNumber: string,
    caseId: string,
    resourceNeeded: string,
    urgency: string,
  ): Promise<NotificationResult> {
    const messageTemplate = `
AEGIS NGO COORDINATION
Case: ${caseId}
Need: ${resourceNeeded}
Urgency: ${urgency}

Check app for details.
    `.trim();

    return this.sendSMS(
      ngoContactPhoneNumber,
      messageTemplate,
      "assignment",
      caseId,
    );
  }

  public async sendSMS(
    phoneNumber: string,
    message: string,
    messageType: string,
    caseId?: string,
  ): Promise<NotificationResult> {
    return this.dispatchPhoneMessage({
      channel: "sms",
      phoneNumber,
      message,
      messageType,
      caseId,
    });
  }

  public async sendWhatsApp(
    phoneNumber: string,
    message: string,
    messageType: string,
    caseId?: string,
    _mediaUrl?: string,
  ): Promise<NotificationResult> {
    return this.dispatchPhoneMessage({
      channel: "whatsapp",
      phoneNumber,
      message,
      messageType,
      caseId,
    });
  }

  public async sendBulkSMS(
    recipients: {
      phoneNumber: string;
      message: string;
      messageType: string;
      caseId?: string;
    }[],
    maxRetries: number = 3,
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const recipient of recipients) {
      let attempts = 0;
      let result: NotificationResult | null = null;

      while (attempts < maxRetries && !result?.success) {
        result = await this.sendSMS(
          recipient.phoneNumber,
          recipient.message,
          recipient.messageType,
          recipient.caseId,
        );

        if (!result.success) {
          attempts++;
          if (attempts < maxRetries) {
            await this.delay(Math.pow(2, attempts) * 1000);
          }
        }
      }

      results.push(
        result || {
          success: false,
          status: "max_retries_exceeded",
          sentAt: new Date().toISOString(),
        },
      );
    }

    return results;
  }

  public isConfigured(): boolean {
    return Boolean(this.client && this.fromPhoneNumber);
  }

  public isQueueAvailable(): boolean {
    return this.notificationQueueAvailable;
  }

  public setQueueAvailable(available: boolean): void {
    this.notificationQueueAvailable = available;
  }

  public getHealthStatus(): {
    configured: boolean;
    whatsappConfigured: boolean;
    queueAvailable: boolean;
  } {
    return {
      configured: this.isConfigured(),
      whatsappConfigured: Boolean(this.client && this.whatsappFromNumber),
      queueAvailable: this.notificationQueueAvailable,
    };
  }

  public async getNotificationStatus(
    messageId: string,
  ): Promise<{ status: string; sentAt: string; deliveredAt?: string }> {
    try {
      if (!this.notificationQueueAvailable) {
        return { status: "unavailable", sentAt: "" };
      }

      const { data, error } = await this.supabase
        .from("notification_queue")
        .select("status, sent_at")
        .eq("id", messageId)
        .maybeSingle<NotificationQueueRecord>();

      if (error) {
        throw error;
      }

      if (data) {
        return {
          status: data.status || "unknown",
          sentAt: data.sent_at || "",
        };
      }

      if (this.client && /^SM/i.test(messageId)) {
        const providerMessage = await this.client.messages(messageId).fetch();
        return {
          status: providerMessage.status || "unknown",
          sentAt:
            providerMessage.dateSent?.toISOString() ||
            providerMessage.dateCreated?.toISOString() ||
            "",
          deliveredAt: providerMessage.dateUpdated?.toISOString(),
        };
      }

      return { status: "unknown", sentAt: "" };
    } catch (error) {
      if (this.handleMissingNotificationQueue(error)) {
        return { status: "unavailable", sentAt: "" };
      }

      console.error("Failed to get notification status:", error);
      return { status: "error", sentAt: "" };
    }
  }

  /**
   * Atomically claim a queue row before sending so concurrent workers (the
   * in-process API drain loop, the standalone worker, multiple replicas)
   * never deliver the same notification twice. Returns false when another
   * worker won the race. If the claim fails because the schema predates the
   * 'processing' status (migration not applied yet), we fall back to legacy
   * unclaimed at-least-once processing rather than stalling the queue.
   */
  private async claimQueuedNotification(
    notificationId: string,
    fromStatuses: string[] = ["pending", "retry"],
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("notification_queue")
        .update({ status: "processing", claimed_at: new Date().toISOString() })
        .eq("id", notificationId)
        .in("status", fromStatuses)
        .select("id");

      if (error) {
        throw error;
      }

      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.warn(
        "Notification claim failed (pre-claiming schema?); processing without claim:",
        error instanceof Error ? error.message : error,
      );
      return true;
    }
  }

  /** Return claims abandoned by a crashed worker to the queue. Best-effort. */
  private async recoverStaleClaims(): Promise<void> {
    const STALE_CLAIM_MS = 5 * 60 * 1000;
    try {
      await this.supabase
        .from("notification_queue")
        .update({ status: "retry" })
        .eq("status", "processing")
        .lt("claimed_at", new Date(Date.now() - STALE_CLAIM_MS).toISOString());
    } catch {
      // Pre-claiming schema or transient error — nothing to recover.
    }
  }

  public async processPendingNotifications(
    limit: number = 25,
  ): Promise<number> {
    try {
      if (!this.notificationQueueAvailable) {
        return 0;
      }

      await this.recoverStaleClaims();

      const { data: pendingNotifications, error } = await this.supabase
        .from("notification_queue")
        .select(
          "id, recipient_type, recipient_address, message_content, message_type, case_id, attempt_count, max_attempts",
        )
        .in("status", ["pending", "retry"])
        .order("created_at", { ascending: true })
        .limit(limit)
        .returns<NotificationQueueRecord[]>();

      if (error) {
        throw error;
      }

      let processedCount = 0;

      for (const notification of pendingNotifications || []) {
        if (!(await this.claimQueuedNotification(notification.id))) {
          continue;
        }

        if (notification.recipient_type === "push") {
          const pushed = await this.dispatchPushMessage(notification);
          if (pushed) {
            processedCount++;
          }
          continue;
        }

        if (notification.recipient_type === "email") {
          const emailed = await this.dispatchEmailMessage(notification);
          if (emailed) {
            processedCount++;
          }
          continue;
        }

        if (
          notification.recipient_type &&
          notification.recipient_type !== "sms"
        ) {
          await this.updateQueuedNotification(notification.id, {
            status: "failed",
            last_error: `Unsupported recipient type: ${notification.recipient_type}`,
            attempt_count: (notification.attempt_count || 0) + 1,
          });
          continue;
        }

        const messageType = notification.message_type || "update";
        const isWhatsapp = messageType.startsWith("whatsapp:");
        const result = await this.dispatchPhoneMessage({
          channel: isWhatsapp ? "whatsapp" : "sms",
          phoneNumber: notification.recipient_address || "",
          message: notification.message_content || "",
          messageType: isWhatsapp
            ? messageType.replace(/^whatsapp:/, "")
            : messageType,
          caseId: notification.case_id || undefined,
          notificationId: notification.id,
          attemptCount: notification.attempt_count || 0,
        });

        if (result.success) {
          processedCount++;
        }
      }

      return processedCount;
    } catch (error) {
      if (this.handleMissingNotificationQueue(error)) {
        return 0;
      }

      console.error("Pending notification processing failed:", error);
      return 0;
    }
  }

  public async retryFailedNotifications(): Promise<number> {
    try {
      if (!this.notificationQueueAvailable) {
        return 0;
      }

      const { data: failedNotifications, error } = await this.supabase
        .from("notification_queue")
        .select(
          "id, recipient_address, message_content, message_type, case_id, attempt_count",
        )
        .eq("status", "failed")
        .lt("attempt_count", 3)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      let retryCount = 0;

      for (const notification of failedNotifications || []) {
        if (
          !(await this.claimQueuedNotification(notification.id, ["failed"]))
        ) {
          continue;
        }

        const messageType = notification.message_type || "update";
        const isWhatsapp = messageType.startsWith("whatsapp:");
        const result = await this.dispatchPhoneMessage({
          channel: isWhatsapp ? "whatsapp" : "sms",
          phoneNumber: notification.recipient_address,
          message: notification.message_content,
          messageType: isWhatsapp
            ? messageType.replace(/^whatsapp:/, "")
            : messageType,
          caseId: notification.case_id || undefined,
          notificationId: notification.id,
          attemptCount: notification.attempt_count || 0,
        });

        if (result.success) {
          retryCount++;
        }
      }

      console.log(`🔄 Retried ${retryCount} failed notifications`);
      return retryCount;
    } catch (error) {
      if (this.handleMissingNotificationQueue(error)) {
        return 0;
      }

      console.error("Failed notification retry failed:", error);
      return 0;
    }
  }

  private async dispatchPhoneMessage(
    options: PhoneDispatchOptions,
  ): Promise<NotificationResult> {
    const normalizedPhoneNumber = this.normalizePhoneNumber(
      options.phoneNumber,
    );
    const sentAt = new Date().toISOString();
    const nextAttemptCount = (options.attemptCount || 0) + 1;

    if (
      !normalizedPhoneNumber ||
      !this.isValidPhoneNumber(normalizedPhoneNumber)
    ) {
      if (options.notificationId) {
        await this.updateQueuedNotification(options.notificationId, {
          status: "failed",
          last_error: "Invalid phone number format",
          attempt_count: nextAttemptCount,
        });
      }

      return {
        success: false,
        status: "invalid_number",
        sentAt,
        error: "Invalid phone number format",
      };
    }

    const queueMessageType =
      options.channel === "whatsapp"
        ? `whatsapp:${options.messageType}`
        : options.messageType;

    const notificationId =
      options.notificationId ||
      (await this.queueNotification({
        recipientType: "sms",
        recipientAddress: normalizedPhoneNumber,
        messageType: queueMessageType,
        messageContent: options.message,
        caseId: options.caseId,
      }));

    if (!notificationId) {
      return {
        success: false,
        status: "queue_failed",
        sentAt,
        error: "Unable to persist notification in queue",
      };
    }

    const senderAddress =
      options.channel === "whatsapp"
        ? this.whatsappFromNumber
          ? `whatsapp:${this.normalizePhoneNumber(this.whatsappFromNumber)}`
          : undefined
        : this.normalizePhoneNumber(this.fromPhoneNumber);

    const recipientAddress =
      options.channel === "whatsapp"
        ? `whatsapp:${normalizedPhoneNumber}`
        : normalizedPhoneNumber;

    if (!this.client || !senderAddress) {
      await this.updateQueuedNotification(notificationId, {
        status: "failed",
        last_error: "Twilio is not fully configured",
        attempt_count: nextAttemptCount,
      });

      return {
        success: false,
        status: "provider_not_configured",
        sentAt,
        error: "Twilio is not fully configured",
      };
    }

    try {
      const response = await this.client.messages.create({
        body: options.message,
        from: senderAddress,
        to: recipientAddress,
      });

      await this.updateQueuedNotification(notificationId, {
        status: "sent",
        sent_at: sentAt,
        last_error: null,
        attempt_count: nextAttemptCount,
      });

      console.log(
        `📱 ${options.channel.toUpperCase()} sent to ${normalizedPhoneNumber}: ${response.sid}`,
      );

      return {
        success: true,
        messageId: response.sid,
        status: response.status || "sent",
        sentAt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await this.updateQueuedNotification(notificationId, {
        status: "failed",
        last_error: errorMessage,
        attempt_count: nextAttemptCount,
      });

      console.error(`${options.channel.toUpperCase()} send failed:`, error);

      return {
        success: false,
        status: "failed",
        sentAt,
        error: errorMessage,
      };
    }
  }

  /**
   * Deliver a queued 'push' notification via the Expo push API and update its
   * queue row. A token Expo reports as dead is deactivated in push_tokens so we
   * stop fanning out to it. Returns true on successful delivery.
   */
  private async dispatchPushMessage(
    notification: NotificationQueueRecord,
  ): Promise<boolean> {
    const token = notification.recipient_address || "";
    const nextAttemptCount = (notification.attempt_count || 0) + 1;
    const title =
      notification.message_type === "escalation"
        ? "🚨 AEGIS Emergency"
        : "AEGIS";

    const result = await sendExpoPush(
      token,
      title,
      notification.message_content || "",
      {
        type: notification.message_type,
        caseId: notification.case_id,
      },
    );

    if (result.success) {
      await this.updateQueuedNotification(notification.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        attempt_count: nextAttemptCount,
      });
      return true;
    }

    if (result.invalidToken && token) {
      try {
        await this.supabase
          .from("push_tokens")
          .update({ is_active: false })
          .eq("token", token);
      } catch {
        // best-effort: a missing push_tokens table must not break the drain loop
      }
    }

    const maxAttempts = notification.max_attempts ?? 5;
    await this.updateQueuedNotification(notification.id, {
      status: nextAttemptCount >= maxAttempts ? "failed" : "retry",
      last_error: result.error || result.status,
      attempt_count: nextAttemptCount,
    });
    return false;
  }

  /**
   * Deliver a queued 'email' notification via the email provider and update its
   * queue row. When the provider isn't configured the row is marked failed
   * without burning retries. Returns true on successful delivery.
   */
  private async dispatchEmailMessage(
    notification: NotificationQueueRecord,
  ): Promise<boolean> {
    const to = notification.recipient_address || "";
    const nextAttemptCount = (notification.attempt_count || 0) + 1;
    const subject =
      notification.message_type === "escalation"
        ? "🚨 AEGIS Emergency Alert"
        : "AEGIS Notification";

    const result = await sendEmail(
      to,
      subject,
      notification.message_content || "",
    );

    if (result.success) {
      await this.updateQueuedNotification(notification.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        attempt_count: nextAttemptCount,
      });
      return true;
    }

    // Not configured / invalid address won't fix on retry — fail terminally.
    const maxAttempts = notification.max_attempts ?? 3;
    const terminal =
      result.notConfigured || result.status === "invalid_address";
    await this.updateQueuedNotification(notification.id, {
      status: terminal || nextAttemptCount >= maxAttempts ? "failed" : "retry",
      last_error: result.error || result.status,
      attempt_count: nextAttemptCount,
    });
    return false;
  }

  private async queueNotification(
    payload: NotificationPayload,
  ): Promise<string | null> {
    try {
      if (!this.notificationQueueAvailable) {
        return null;
      }

      const recipientType: QueueRecipientType =
        payload.recipientType === "email" ? "email" : "sms";
      const { data, error } = await this.supabase
        .from("notification_queue")
        .insert({
          recipient_type: recipientType,
          recipient_address: payload.recipientAddress,
          message_type: payload.messageType,
          message_content: payload.messageContent,
          case_id: payload.caseId,
          user_id: payload.userId,
          status: "pending",
          attempt_count: 0,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw error;
      }

      return data?.id || null;
    } catch (error) {
      if (this.handleMissingNotificationQueue(error)) {
        return null;
      }

      console.error("Failed to queue notification:", error);
      return null;
    }
  }

  private async updateQueuedNotification(
    notificationId: string,
    updates: {
      status?: "pending" | "sent" | "failed" | "retry";
      sent_at?: string;
      last_error?: string | null;
      attempt_count?: number;
    },
  ): Promise<void> {
    if (!this.notificationQueueAvailable) {
      return;
    }

    const payload: Record<string, string | number | null> = {};

    if (updates.status) {
      payload.status = updates.status;
    }

    if (updates.sent_at !== undefined) {
      payload.sent_at = updates.sent_at;
    }

    if (updates.last_error !== undefined) {
      payload.last_error = updates.last_error;
    }

    if (updates.attempt_count !== undefined) {
      payload.attempt_count = updates.attempt_count;
    }

    try {
      const { error } = await this.supabase
        .from("notification_queue")
        .update(payload)
        .eq("id", notificationId);

      if (error) {
        throw error;
      }
    } catch (error) {
      if (!this.handleMissingNotificationQueue(error)) {
        console.error("Failed to update queued notification:", error);
      }
    }
  }

  private handleMissingNotificationQueue(error: unknown): boolean {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";

    const isMissingQueue =
      code === "PGRST205" ||
      code === "42P01" ||
      (message.includes("notification_queue") &&
        (message.includes("Could not find the table") ||
          message.includes("does not exist")));

    if (!isMissingQueue) {
      return false;
    }

    if (this.notificationQueueAvailable) {
      this.notificationQueueAvailable = false;
      console.warn(
        "notification_queue table is unavailable. Notification queue features are disabled until migrations are applied.",
      );
    }

    return true;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    return /^\+\d{8,15}$/.test(phoneNumber);
  }

  private normalizePhoneNumber(phoneNumber?: string): string | null {
    if (!phoneNumber) {
      return null;
    }

    const cleaned = phoneNumber.replace(/[\s\-()]/g, "");

    if (!cleaned) {
      return null;
    }

    if (cleaned.startsWith("+")) {
      return cleaned;
    }

    if (cleaned.startsWith("00")) {
      return `+${cleaned.slice(2)}`;
    }

    if (/^\d+$/.test(cleaned)) {
      return `+${cleaned}`;
    }

    return null;
  }

  private resolveAppBaseUrl(): string | undefined {
    const configuredBaseUrl =
      process.env.APP_BASE_URL || process.env.FRONTEND_URL;
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/+$/, "");
    }

    const firstOrigin = process.env.CORS_ORIGIN?.split(",")[0]?.trim();
    return firstOrigin ? firstOrigin.replace(/\/+$/, "") : undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TwilioNotificationService;
