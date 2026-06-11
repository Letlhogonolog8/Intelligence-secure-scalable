/**
 * Registers this device's Expo push token in the shared `push_tokens` table so
 * the backend notification worker can deliver out-of-app notifications (e.g. a
 * case-status update for the survivor).
 *
 * Resilient by design: if `expo-notifications` is not installed yet, or the user
 * denies permission, or there is no network, this resolves quietly. Push is an
 * enhancement — it must never block or break sign-in.
 *
 * Install the native module before relying on delivery:
 *   cd mobile && npx expo install expo-notifications
 */
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

let registeredToken: string | null = null;

async function loadNotifications(): Promise<typeof import("expo-notifications") | null> {
  try {
    // Dynamic import so a missing native module degrades gracefully.
    return (await import("expo-notifications")) as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

/**
 * Expo Go (SDK 53+) removed remote-push support, and merely importing
 * `expo-notifications` there triggers a noisy auto-registration error. Detect it
 * so we skip push entirely in Expo Go; a dev/standalone build runs normally.
 */
async function isExpoGo(): Promise<boolean> {
  try {
    const Constants = (await import("expo-constants")).default;
    return (
      Constants?.executionEnvironment === "storeClient" ||
      (Constants as unknown as { appOwnership?: string })?.appOwnership === "expo"
    );
  } catch {
    return false;
  }
}

async function resolveProjectId(): Promise<string | undefined> {
  try {
    const Constants = (await import("expo-constants")).default;
    return (
      Constants?.expoConfig?.extra?.eas?.projectId ??
      // Fallback for classic/legacy config shapes.
      (Constants as unknown as { easConfig?: { projectId?: string } })?.easConfig?.projectId
    );
  } catch {
    return undefined;
  }
}

/**
 * Idempotently upsert the current device token for the signed-in user.
 * Call after a session is established; safe to call repeatedly.
 */
export async function registerPushToken(userId: string | undefined): Promise<void> {
  if (!userId) return;

  // Expo Go can't deliver remote push and errors on import — skip it there.
  if (await isExpoGo()) return;

  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    // Emergency channel (Android) — high importance so SOS-related alerts surface.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        bypassDnd: true,
      }).catch(() => {});
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId = await resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse?.data;
    if (!token || token === registeredToken) return;

    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: "expo",
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    if (!error) {
      registeredToken = token;
    }
  } catch {
    // Best-effort: never surface push registration failures to the user.
  }
}

/** Clear the in-memory guard on sign-out so a new account re-registers. */
export function resetPushRegistration(): void {
  registeredToken = null;
}
