/**
 * AEGIS USSD Gateway
 * server/ussd/ussdGateway.ts
 *
 * Enterprise USSD implementation for disadvantaged communities:
 * - USSD menu navigation (*123456#)
 * - Case reporting via USSD
 * - Real-time case ID generation
 * - SMS confirmation
 * - Offline caching
 * - Multi-language support
 * - SMS fallback system
 */

import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { URL } from "url";
import { USSD_MENU_STRUCTURE, USSD_MENU_TITLES } from "./menuConfig";

const ALLOWED_TELKOM_HOST = "api.telkom.co.za";

function sanitizeLog(value: string): string {
  return value.replace(/[\r\n\t]/g, "_").substring(0, 200);
}

function resolveTelkomCallbackUrl(): string {
  const explicitCallback = process.env.TELKOM_CALLBACK_URL?.trim();
  if (explicitCallback) {
    return explicitCallback;
  }

  const publicBackendUrl =
    process.env.BACKEND_PUBLIC_URL?.trim() || process.env.APP_BASE_URL?.trim();
  if (!publicBackendUrl) {
    return "";
  }

  return `${publicBackendUrl.replace(/\/+$/, "")}/api/ussd/telkom/callback`;
}

export type USSDAction =
  | "report"
  | "help"
  | "status"
  | "emergency"
  | "language"
  | "back"
  | "quit";
export type Language =
  | "en"
  | "zu"
  | "xh"
  | "st"
  | "af"
  | "ss"
  | "tn"
  | "ts"
  | "ve"
  | "nso"
  | "nr";

export interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  language: Language;
  currentMenu: string;
  state: SessionState;
  createdAt: string;
  lastAccessedAt: string;
  isOffline?: boolean;
}

export interface USSDMenuOption {
  key: string;
  label: string;
  labels: Record<Language, string>;
  nextMenu: string;
  action?: USSDAction;
  requiresInput?: boolean;
}

export interface USSDResponse {
  sessionId: string;
  menu: string;
  text: string;
  options: USSDMenuOption[];
  endSession: boolean;
  smsFollowUp?: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  "en",
  "zu",
  "xh",
  "st",
  "af",
  "ss",
  "tn",
  "ts",
  "ve",
  "nso",
  "nr",
];

const LANGUAGE_SELECTION_MAP: Record<string, Language> = {
  "1": "en",
  "2": "zu",
  "3": "xh",
  "4": "st",
  "5": "af",
  "6": "ss",
  "7": "tn",
  "8": "ts",
  "9": "ve",
  "10": "nso",
  "11": "nr",
};

// Maps the "Get Help" submenu digits to a human-readable help type so the
// stored record is meaningful (not a bare "1").
const HELP_TYPE_MAP: Record<string, string> = {
  "1": "Shelter",
  "2": "Counseling",
  "3": "Medical",
  "4": "Police",
};

type SessionState = Record<string, unknown>;
type TemplateVariables = Record<string, string | number | boolean | undefined>;

type MenuRegistry = Partial<Record<Language, Record<string, USSDMenuOption[]>>>;

interface TelkomCallbackPayload {
  subscriber?: string;
  input?: string;
  sessionId?: string;
  language?: Language;
  phoneNumber?: string;
  userInput?: string;
  [key: string]: unknown;
}

interface ResourceContact {
  id: string;
  name: string;
  phone?: string;
  location?: string;
}

interface NearestResources {
  shelters: ResourceContact[];
  counselors: ResourceContact[];
}

export class USSDGateway {
  private supabase: SupabaseClient;
  private offlineCache: Map<string, Record<string, unknown>> = new Map();
  private menus: MenuRegistry = {};
  private telkomApiKey: string;
  private telkomApiUrl: string;
  private telkomUssdCode: string;
  private telkomCallbackUrl: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.telkomApiKey = process.env.TELKOM_API_KEY || "";
    this.telkomApiUrl =
      process.env.TELKOM_API_URL || "https://api.telkom.co.za/ussd/v1";
    this.telkomUssdCode = process.env.TELKOM_USSD_CODE || "";
    this.telkomCallbackUrl = resolveTelkomCallbackUrl();
    this.initializeMenus();
    this.initializeOfflineCache();
  }

  /**
   * Send USSD response to Telkom
   */
  public async sendTelkomResponse(
    phoneNumber: string,
    message: string,
    endSession: boolean = false,
  ): Promise<boolean> {
    try {
      if (
        !this.telkomApiKey ||
        !this.telkomApiUrl ||
        !this.telkomUssdCode ||
        !this.telkomCallbackUrl
      ) {
        console.warn(
          "⚠️  Telkom provider configuration incomplete. Skipping Telkom send.",
        );
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      if (!cleanPhone) {
        console.warn(
          "⚠️  Telkom send skipped because subscriber phone number is empty.",
        );
        return false;
      }

      const payload = {
        subscriber: cleanPhone,
        serviceCode: this.telkomUssdCode,
        callbackUrl: this.telkomCallbackUrl,
        text: message,
        end: endSession,
        timestamp: new Date().toISOString(),
      };

      // Validate URL to prevent SSRF
      const parsedUrl = new URL(`${this.telkomApiUrl}/send`);
      if (parsedUrl.hostname !== ALLOWED_TELKOM_HOST) {
        throw new Error(`Blocked SSRF attempt to host: ${parsedUrl.hostname}`);
      }

      const response = await fetch(parsedUrl.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.telkomApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(
          `Telkom API error: ${response.status} ${response.statusText}`,
        );
      }

      console.log(`✅ USSD sent to ${sanitizeLog(phoneNumber)} via Telkom`);
      return true;
    } catch (error) {
      console.error("❌ Failed to send USSD via Telkom:", error);
      return false;
    }
  }

  /**
   * Handle Telkom callback (webhook from provider)
   */
  public async handleTelkomCallback(
    payload: TelkomCallbackPayload,
  ): Promise<USSDResponse> {
    try {
      const { subscriber, input, sessionId, language = "en" } = payload;
      const phoneNumber = subscriber || payload.phoneNumber || "";
      const userInput = input || payload.userInput || "";
      const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language)
        ? language
        : "en";

      if (!phoneNumber || !sessionId) {
        throw new Error(
          "Invalid Telkom callback payload: missing phone number or sessionId",
        );
      }

      await this.supabase.from("ussd_callbacks").insert({
        phone_number: phoneNumber,
        provider: "telkom",
        user_input: userInput,
        session_id: sessionId,
        payload,
        received_at: new Date().toISOString(),
      });

      const response = await this.handleUSSDRequest(
        phoneNumber,
        userInput,
        normalizedLanguage,
        sessionId,
      );
      await this.sendTelkomResponse(
        phoneNumber,
        response.text,
        response.endSession,
      );

      return response;
    } catch (error) {
      console.error("❌ Error handling Telkom callback:", error);
      throw error;
    }
  }

  /**
   * Handle incoming USSD request
   */
  public async handleUSSDRequest(
    phoneNumber: string,
    userInput: string,
    language: Language = "en",
    externalSessionId?: string,
  ): Promise<USSDResponse> {
    try {
      const session = await this.getOrCreateSession(
        phoneNumber,
        language,
        externalSessionId,
      );
      const activeLanguage = session.language || language;
      const response = await this.processInput(
        session,
        userInput,
        activeLanguage,
      );
      await this.updateSession(
        session.sessionId,
        response,
        session.language || activeLanguage,
      );

      return response;
    } catch (error) {
      console.error("USSD request error:", error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Process user input and navigate menu
   */
  private async processInput(
    session: USSDSession,
    userInput: string,
    language: Language,
  ): Promise<USSDResponse> {
    const trimmedInput = (userInput || "").trim();

    if (trimmedInput === "*") {
      return this.getExitResponse(session, language);
    }

    if (trimmedInput === "0") {
      if (session.currentMenu === "main") {
        return this.getExitResponse(session, language);
      }

      session.currentMenu = "main";
      return this.getMenuResponse(session, language);
    }

    if (session.currentMenu === "main") {
      const option = this.menus[language]?.main?.find(
        (opt) => opt.key === trimmedInput,
      );
      if (option) {
        if (option.action === "emergency") {
          return await this.handleEmergencyAlert(session, language);
        }

        if (option.action === "language") {
          session.currentMenu = "language_menu";
          return this.getMenuResponse(session, language);
        }

        session.currentMenu = option.nextMenu;
      } else if (trimmedInput !== "") {
        // Unknown choice: re-show the menu with feedback instead of silently
        // rendering the same screen (the survivor must know the input failed).
        return this.getMenuResponse(
          session,
          language,
          this.getLocalizedText("invalid_option", language),
        );
      }
    } else if (session.currentMenu === "language_menu") {
      return await this.handleLanguageSelection(
        session,
        trimmedInput,
        language,
      );
    } else if (session.currentMenu === "report_details") {
      return await this.handleReportSubmission(session, trimmedInput, language);
    } else if (session.currentMenu === "help_details") {
      return await this.handleHelpRequest(session, trimmedInput, language);
    } else if (session.currentMenu === "case_reference") {
      return await this.handleCaseStatusQuery(session, trimmedInput, language);
    }

    // Get menu content
    return this.getMenuResponse(session, language);
  }

  /**
   * Handle GBV case reporting
   */
  private async handleReportSubmission(
    session: USSDSession,
    details: string,
    language: Language,
  ): Promise<USSDResponse> {
    try {
      // Don't create an empty case — re-prompt with the report instructions.
      if (!details.trim()) {
        session.currentMenu = "report_details";
        return this.getMenuResponse(session, language);
      }

      const caseReference = this.generateCaseId();
      const createdAt = new Date().toISOString();
      const persistedCaseId = caseReference;

      const modernInsert = await this.supabase.from("cases").insert({
        id: caseReference,
        case_number: caseReference,
        phone_number: session.phoneNumber,
        description: details,
        channel: "ussd",
        status: "submitted",
        risk_level: "medium",
        created_at: createdAt,
        updated_at: createdAt,
        source_session_id: session.sessionId,
      });

      if (modernInsert.error) {
        throw modernInsert.error;
      }

      this.offlineCache.set(`case:${caseReference}`, {
        caseId: caseReference,
        phoneNumber: session.phoneNumber,
        details,
        timestamp: createdAt,
      });

      await this.sendConfirmationSMS(
        session.phoneNumber,
        caseReference,
        language,
      );
      await this.triggerRiskAssessment(persistedCaseId);

      const confirmationText = this.getLocalizedText("confirmation", language, {
        caseId: caseReference,
      });

      return {
        sessionId: session.sessionId,
        menu: "confirmation",
        text: confirmationText,
        options: this.menus[language]?.end || [],
        endSession: true,
        smsFollowUp: `Case ID: ${caseReference}\nWe will contact you soon.`,
      };
    } catch (error) {
      console.error("Report submission error:", error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Handle emergency help request
   */
  private async handleHelpRequest(
    session: USSDSession,
    helpType: string,
    language: Language,
  ): Promise<USSDResponse> {
    try {
      // Validate against the help submenu; re-prompt on an unknown choice.
      const mappedHelpType = HELP_TYPE_MAP[helpType.trim()];
      if (!mappedHelpType) {
        return this.getMenuResponse(
          session,
          language,
          this.getLocalizedText("invalid_option", language),
        );
      }

      const emergencyId = this.generateEmergencyId();
      const createdAt = new Date().toISOString();

      const modernInsert = await this.supabase
        .from("emergency_requests")
        .insert({
          id: emergencyId,
          phone_number: session.phoneNumber,
          help_type: mappedHelpType,
          channel: "ussd",
          status: "received",
          created_at: createdAt,
          updated_at: createdAt,
          source_session_id: session.sessionId,
        });

      if (modernInsert.error) {
        throw modernInsert.error;
      }

      const resources = await this.findNearestResources(session.phoneNumber);
      await this.sendResourceSMS(session.phoneNumber, resources, language);

      const responseText = this.getLocalizedText(
        "help_confirmation",
        language,
        {
          shelters: resources.shelters.length,
          counselors: resources.counselors.length,
        },
      );

      return {
        sessionId: session.sessionId,
        menu: "help_confirmation",
        text: responseText,
        options: this.menus[language]?.end || [],
        endSession: true,
        smsFollowUp: `Help request received. Resources sent via SMS.`,
      };
    } catch (error) {
      console.error("Help request error:", error);
      return this.getErrorResponse(language);
    }
  }

  private async handleLanguageSelection(
    session: USSDSession,
    languageChoice: string,
    currentLanguage: Language,
  ): Promise<USSDResponse> {
    const selectedLanguage = LANGUAGE_SELECTION_MAP[languageChoice];
    if (!selectedLanguage) {
      return {
        sessionId: session.sessionId,
        menu: "language_menu",
        text: this.buildMenuText("language_menu", [], currentLanguage),
        options: this.menus[currentLanguage]?.language_menu || [],
        endSession: false,
      };
    }

    session.language = selectedLanguage;
    session.currentMenu = "main";

    return this.getMenuResponse(session, selectedLanguage);
  }

  private async handleEmergencyAlert(
    session: USSDSession,
    language: Language,
  ): Promise<USSDResponse> {
    try {
      const emergencyId = this.generateEmergencyId();
      const createdAt = new Date().toISOString();

      const insertResult = await this.supabase
        .from("emergency_requests")
        .insert({
          id: emergencyId,
          phone_number: session.phoneNumber,
          help_type: "Emergency Alert",
          channel: "ussd",
          status: "received",
          created_at: createdAt,
          updated_at: createdAt,
          source_session_id: session.sessionId,
        });

      if (insertResult.error) {
        throw insertResult.error;
      }

      const resources = await this.findNearestResources(session.phoneNumber);
      await this.sendResourceSMS(session.phoneNumber, resources, language);

      return {
        sessionId: session.sessionId,
        menu: "emergency_alert",
        text: this.buildMenuText("emergency_alert", [], language),
        options: this.menus[language]?.end || [],
        endSession: true,
        smsFollowUp: "Emergency alert received. Help is being dispatched.",
      };
    } catch (error) {
      console.error("Emergency alert error:", error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Handle case status queries
   */
  private async handleCaseStatusQuery(
    session: USSDSession,
    caseReference: string,
    language: Language,
  ): Promise<USSDResponse> {
    try {
      let caseRecord: { id: string; status: string; riskLevel: string } | null =
        null;
      const isUuidReference = this.isUuid(caseReference);

      const modernQuery = await (isUuidReference
        ? this.supabase
            .from("cases")
            .select("id, status, risk_level, updated_at, case_number")
            .or(`id.eq.${caseReference},case_number.eq.${caseReference}`)
            .single()
        : this.supabase
            .from("cases")
            .select("id, status, risk_level, updated_at, case_number")
            .eq("case_number", caseReference)
            .single());

      if (!modernQuery.error && modernQuery.data) {
        caseRecord = {
          id: String(modernQuery.data.case_number ?? modernQuery.data.id),
          status: String(modernQuery.data.status),
          riskLevel: String(modernQuery.data.risk_level ?? "medium"),
        };
      } else if (modernQuery.error && !this.isNoRowsError(modernQuery.error)) {
        throw modernQuery.error;
      }

      // Return to the main menu after answering so the next keypress is a
      // valid menu choice (not a re-query of an unknown menu key).
      session.currentMenu = "main";
      const mainMenu = this.buildMenuText("main", [], language);

      if (!caseRecord) {
        const notFoundText = this.getLocalizedText("case_not_found", language);
        return {
          sessionId: session.sessionId,
          menu: "main",
          text: `${notFoundText}\n\n${mainMenu}`,
          options: this.menus[language]?.main || [],
          endSession: false,
        };
      }

      const statusText = this.getLocalizedText("case_status", language, {
        caseId: caseRecord.id,
        status: caseRecord.status,
        riskLevel: caseRecord.riskLevel,
      });

      return {
        sessionId: session.sessionId,
        menu: "main",
        text: `${statusText}\n\n${mainMenu}`,
        options: this.menus[language]?.main || [],
        endSession: false,
      };
    } catch (error) {
      console.error("Case status query error:", error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Get menu response for current session state
   */
  private async getMenuResponse(
    session: USSDSession,
    language: Language,
    notice?: string,
  ): Promise<USSDResponse> {
    const menuKey = session.currentMenu;
    const menuOptions = this.menus[language]?.[menuKey];

    if (!menuOptions) {
      return this.getMenuResponse(
        { ...session, currentMenu: "main" },
        language,
      );
    }

    const menuText = this.buildMenuText(menuKey, menuOptions, language);

    return {
      sessionId: session.sessionId,
      menu: menuKey,
      text: notice ? `${notice}\n${menuText}` : menuText,
      options: menuOptions,
      endSession: false,
    };
  }

  /**
   * Get session (create if not exists)
   */
  private async getOrCreateSession(
    phoneNumber: string,
    language: Language,
    externalSessionId?: string,
  ): Promise<USSDSession> {
    try {
      if (externalSessionId) {
        const existingBySession = await this.fetchSessionBySessionId(
          externalSessionId,
          language,
        );
        if (existingBySession) {
          this.storeOfflineSession(existingBySession);
          return existingBySession;
        }
      } else {
        const existingByPhone = await this.fetchLatestSessionByPhone(
          phoneNumber,
          language,
        );
        if (existingByPhone) {
          this.storeOfflineSession(existingByPhone);
          return existingByPhone;
        }
      }
    } catch (error) {
      console.warn(
        "USSD session lookup failed, creating a fresh session:",
        error,
      );
    }

    if (externalSessionId) {
      const cachedSession = this.getOfflineSessionById(externalSessionId);
      if (cachedSession) {
        return cachedSession;
      }
    } else {
      const cachedSession = this.getOfflineSessionByPhone(phoneNumber);
      if (cachedSession) {
        return cachedSession;
      }
    }

    const sessionId = externalSessionId || this.generateSessionId();
    const now = new Date().toISOString();
    const newSession: USSDSession = {
      sessionId,
      phoneNumber,
      language,
      currentMenu: "main",
      state: {},
      createdAt: now,
      lastAccessedAt: now,
    };

    this.storeOfflineSession(newSession);
    await this.insertSession(newSession);

    return newSession;
  }

  private mapSessionRow(
    row: Record<string, unknown>,
    fallbackLanguage: Language,
  ): USSDSession {
    return {
      sessionId: String(row.session_id),
      phoneNumber: String(row.phone_number),
      language: (row.language as Language) || fallbackLanguage,
      currentMenu: String(row.current_menu ?? row.current_state ?? "main"),
      state: ((row.state ?? row.metadata) as SessionState) || {},
      createdAt: String(row.created_at || new Date().toISOString()),
      lastAccessedAt: String(
        row.last_accessed_at ?? row.last_activity ?? new Date().toISOString(),
      ),
    };
  }

  private getOfflineSessionById(sessionId: string): USSDSession | null {
    const session = this.offlineCache.get(
      `ussd-session:${sessionId}`,
    ) as unknown as USSDSession | undefined;
    if (!session) {
      return null;
    }

    // Mirror the 5-minute DB expires_at: an abandoned mid-flow session must
    // not resume hours later from the in-memory cache.
    const SESSION_TTL_MS = 5 * 60 * 1000;
    if (
      Date.now() - new Date(session.lastAccessedAt).getTime() >
      SESSION_TTL_MS
    ) {
      this.removeOfflineSession(session);
      return null;
    }

    return session;
  }

  private getOfflineSessionByPhone(phoneNumber: string): USSDSession | null {
    const sessionId = this.offlineCache.get(
      `ussd-phone:${phoneNumber}`,
    )?.sessionId;
    if (typeof sessionId !== "string") {
      return null;
    }

    return this.getOfflineSessionById(sessionId);
  }

  private storeOfflineSession(session: USSDSession): void {
    this.offlineCache.set(
      `ussd-session:${session.sessionId}`,
      session as unknown as Record<string, unknown>,
    );
    this.offlineCache.set(`ussd-phone:${session.phoneNumber}`, {
      sessionId: session.sessionId,
    });
  }

  private removeOfflineSession(session: USSDSession): void {
    this.offlineCache.delete(`ussd-session:${session.sessionId}`);
    this.offlineCache.delete(`ussd-phone:${session.phoneNumber}`);
  }

  private async fetchSessionBySessionId(
    sessionId: string,
    language: Language,
  ): Promise<USSDSession | null> {
    const { data, error } = await this.supabase
      .from("ussd_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data
      ? this.mapSessionRow(data as Record<string, unknown>, language)
      : null;
  }

  private async fetchLatestSessionByPhone(
    phoneNumber: string,
    language: Language,
  ): Promise<USSDSession | null> {
    const modernQuery = await this.supabase
      .from("ussd_sessions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!modernQuery.error && modernQuery.data) {
      return this.mapSessionRow(
        modernQuery.data as Record<string, unknown>,
        language,
      );
    }

    if (!this.isMissingColumnError(modernQuery.error, "is_active")) {
      return null;
    }

    const legacyQuery = await this.supabase
      .from("ussd_sessions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (legacyQuery.error || !legacyQuery.data) {
      return null;
    }

    return this.mapSessionRow(
      legacyQuery.data as Record<string, unknown>,
      language,
    );
  }

  private async insertSession(session: USSDSession): Promise<void> {
    const modernInsert = await this.supabase.from("ussd_sessions").insert({
      session_id: session.sessionId,
      phone_number: session.phoneNumber,
      language: session.language,
      current_menu: "main",
      state: session.state,
      is_active: true,
      created_at: session.createdAt,
    });

    if (!modernInsert.error) {
      return;
    }

    if (this.isMissingTableError(modernInsert.error, "ussd_sessions")) {
      console.warn(
        "USSD session persistence is running in offline mode because public.ussd_sessions is unavailable.",
      );
      return;
    }

    if (
      !this.isMissingColumnError(modernInsert.error, "language") &&
      !this.isMissingColumnError(modernInsert.error, "current_menu") &&
      !this.isMissingColumnError(modernInsert.error, "state") &&
      !this.isMissingColumnError(modernInsert.error, "is_active")
    ) {
      throw modernInsert.error;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const legacyInsert = await this.supabase.from("ussd_sessions").insert({
      session_id: session.sessionId,
      phone_number: session.phoneNumber,
      current_state: "main",
      menu_level: 0,
      user_input: "",
      created_at: session.createdAt,
      last_activity: session.lastAccessedAt,
      expires_at: expiresAt,
    });

    if (legacyInsert.error) {
      if (this.isMissingTableError(legacyInsert.error, "ussd_sessions")) {
        console.warn(
          "USSD session persistence is running in offline mode because public.ussd_sessions is unavailable.",
        );
        return;
      }
      throw legacyInsert.error;
    }
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const message =
      "message" in error && typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";
    return (
      message.includes(columnName.toLowerCase()) &&
      (message.includes("column") || message.includes("schema cache"))
    );
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const message =
      "message" in error && typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";
    return (
      message.includes(tableName.toLowerCase()) &&
      message.includes("could not find the table")
    );
  }

  private isNoRowsError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const code =
      "code" in error && typeof error.code === "string" ? error.code : "";
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";

    return (
      code === "PGRST116" ||
      message.includes("not found") ||
      message.includes("no rows") ||
      message.includes("0 rows")
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  /**
   * Update session state
   */
  private async updateSession(
    sessionId: string,
    response: USSDResponse,
    language: Language,
  ): Promise<void> {
    try {
      const isActive = !response.endSession;
      const now = new Date().toISOString();
      const cachedSession = this.getOfflineSessionById(sessionId);
      if (cachedSession) {
        if (response.endSession) {
          // Drop the cached session when it ends, otherwise the next dial-in
          // from this number resumes a dead session stuck on its final menu.
          this.removeOfflineSession(cachedSession);
        } else {
          this.storeOfflineSession({
            ...cachedSession,
            language,
            currentMenu: response.menu,
            lastAccessedAt: now,
          });
        }
      }

      const modernUpdate = await this.supabase
        .from("ussd_sessions")
        .update({
          language,
          current_menu: response.menu,
          is_active: isActive,
          last_accessed_at: now,
        })
        .eq("session_id", sessionId);

      if (!modernUpdate.error) {
        return;
      }

      if (this.isMissingTableError(modernUpdate.error, "ussd_sessions")) {
        return;
      }

      if (
        !this.isMissingColumnError(modernUpdate.error, "last_accessed_at") &&
        !this.isMissingColumnError(modernUpdate.error, "current_menu") &&
        !this.isMissingColumnError(modernUpdate.error, "is_active")
      ) {
        throw modernUpdate.error;
      }

      const legacyUpdate = await this.supabase
        .from("ussd_sessions")
        .update({
          current_state: response.menu,
          last_activity: now,
          expires_at: isActive
            ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
            : now,
        })
        .eq("session_id", sessionId);

      if (
        legacyUpdate.error &&
        !this.isMissingTableError(legacyUpdate.error, "ussd_sessions")
      ) {
        throw legacyUpdate.error;
      }
    } catch (error) {
      console.error("Failed to update session:", error);
    }
  }

  /**
   * Send SMS confirmation
   */
  private async sendConfirmationSMS(
    phoneNumber: string,
    caseId: string,
    language: Language,
  ): Promise<void> {
    try {
      const message = this.getLocalizedText("sms_case_confirmation", language, {
        caseId,
      });

      const { error } = await this.supabase.from("notification_queue").insert({
        recipient_type: "sms",
        recipient_address: phoneNumber,
        message_type: "ussd_confirmation",
        message_content: message,
        case_id: caseId,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(`📬 SMS confirmation queued for ${sanitizeLog(phoneNumber)}`);
    } catch (error) {
      console.error("Failed to queue SMS:", error);
    }
  }

  /**
   * Send resource SMS
   */
  private async sendResourceSMS(
    phoneNumber: string,
    resources: NearestResources,
    language: Language,
  ): Promise<void> {
    try {
      const shelterText = resources.shelters
        .slice(0, 2)
        .map((shelter) => `${shelter.name}: ${shelter.phone || "N/A"}`)
        .join(" | ");

      const message = this.getLocalizedText("sms_resources", language, {
        shelters: shelterText,
      });

      const { error } = await this.supabase.from("notification_queue").insert({
        recipient_type: "sms",
        recipient_address: phoneNumber,
        message_type: "ussd_resources",
        message_content: message,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(`📬 Resources SMS queued for ${sanitizeLog(phoneNumber)}`);
    } catch (error) {
      console.error("Failed to queue resources SMS:", error);
    }
  }

  /**
   * Find nearest resources
   */
  private async findNearestResources(
    _phoneNumber: string,
  ): Promise<NearestResources> {
    try {
      const { data: shelters } = await this.supabase
        .from("resources")
        .select("id, name, contact_info, description")
        .eq("resource_type", "shelter")
        .limit(3);

      const { data: counselors } = await this.supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "counselor")
        .eq("is_active", true)
        .eq("is_available", true)
        .limit(3);

      return {
        shelters: (shelters || []).map((shelter) => ({
          id: shelter.id,
          name: shelter.name,
          phone: shelter.contact_info,
          location: shelter.description,
        })),
        counselors: (counselors || []).map((counselor) => ({
          id: counselor.id,
          name: counselor.full_name || "Counselor",
          phone: counselor.phone,
        })),
      };
    } catch (error) {
      console.error("Failed to find resources:", error);
      return { shelters: [], counselors: [] };
    }
  }

  /**
   * Trigger risk assessment
   */
  private async triggerRiskAssessment(caseId: string): Promise<void> {
    try {
      const { error } = await this.supabase.from("events_log").insert({
        event_type: "case:created",
        case_id: caseId,
        data: { source: "ussd" },
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(
        `✅ Risk assessment triggered for case ${sanitizeLog(caseId)}`,
      );
    } catch (error) {
      console.error("Failed to trigger risk assessment:", error);
    }
  }

  // Localization & Menu Methods

  private getLocalizedText(
    key: string,
    language: Language,
    variables?: TemplateVariables,
  ): string {
    const texts: Record<string, Record<Language, string>> = {
      invalid_option: {
        en: "Invalid choice. Reply with a number from the menu.",
        zu: "Okukhethile akulungile. Phendula ngenombolo esemenyu.",
        xh: "Ukhetho alulunganga. Phendula ngenombolo esemenyu.",
        st: "Kgetho e fosahetse. Araba ka nomoro e menung.",
        af: "Ongeldige keuse. Antwoord met 'n nommer uit die keuselys.",
        ss: "Lokukhetsile akulungile. Phendvula ngenombolo lesemenyu.",
        tn: "Tlhopho e e sa siamang. Araba ka nomoro e e mo menung.",
        ts: "Nhlawulo a wu lulamanga. Hlamula hi nomboro leyi nga eka menu.",
        ve: "Khetho a yo ngo luga. Fhindulani nga nomboro i re kha menu.",
        nso: "Kgetho e fošagetšego. Araba ka nomoro yeo e lego menung.",
        nr: "Ukukhetha okungakalungi. Phendula ngenomboro esemenyini.",
      },
      confirmation: {
        en: "Case reported. ID: {{caseId}}. Save this ID for option 3 (Case Status).",
        zu: "Icala libhalisiwe. Isithombelo: {{caseId}}. Usizo luza ngesikhashana.",
        xh: "Ikesi licaciswe. Ikhowudi: {{caseId}}. Uncedo luza ngokukhawuleza.",
        st: "Kgetsi ya fapano e be e lentswe. ID: {{caseId}}. Thuso e tlo tla ka potlako.",
        af: "Saak gerapporteer. ID: {{caseId}}. Hulp kom gou.",
        ss: "Icala liyhalisiwe. Inombolo: {{caseId}}. Incamo imiswele.",
        tn: "Kgetsi e begilwe. ID: {{caseId}}. Thuso e tla tla go se kgale.",
        ts: "Mhaka yi vikiwile. ID: {{caseId}}. Mpfuno wu ta fika ku nga ri khale.",
        ve: "Mufhululu wo vhigiwa. ID: {{caseId}}. Thuso i khou da hu si kale.",
        nso: "Mohlala o begilwe. ID: {{caseId}}. Thuso e tla tla e se kgale.",
        nr: "Icala libikiwe. ID: {{caseId}}. Isizo liza maduze.",
      },
      help_confirmation: {
        en: "Help received. {{shelters}} shelters nearby. SMS sent.",
        zu: "Usizo wamukile. {{shelters}} amakhaya asekusedile. I-SMS ithunyelwe.",
        xh: "Uncedo lwamkelwe. {{shelters}} indawo zokuhlala ekufutshane. Uxwebhu luthumwe.",
        st: "Thuso e amanelwe. {{shelters}} maatla a mo gaufi. SMS e sentswitswe.",
        af: "Hulp ontvang. {{shelters}} skuilings naby. SMS gestuur.",
        ss: "Incamo wamukile. {{shelters}} indawo zokuhlala ekufutshane. SMS ithunyelwe.",
        tn: "Thuso e amogetswe. {{shelters}} mafelo a go iphitlha a gaufi. SMS e rometswe.",
        ts: "Mpfuno wu amukeriwile. {{shelters}} tindhawu to tumbela ti kusuhi. SMS yi rhumeriwile.",
        ve: "Thuso yo tanganedzwa. {{shelters}} fhethu ha u dzumbama hu tsini. SMS yo rumelwa.",
        nso: "Thuso e amogetšwe. {{shelters}} mafelo a go iphihla a kgauswi. SMS e rometšwe.",
        nr: "Isizo lamukelwe. {{shelters}} iindawo zokuphephela ziseduze. ISMS ithunyelwe.",
      },
      case_not_found: {
        en: "Case not found. Try again or call 123.",
        zu: "Icala litholakali. Zama futhi noma umeme 123.",
        xh: "Ikesi akufunyanwanga. Zama kwakhona okanye fonela 123.",
        st: "Kgetsi ga se bonanwwa. Leka gape kgonwa leina 123.",
        af: "Saak nie gevind nie. Probeer weer of bel 123.",
        ss: "Icala akutiwa. Zama futhi kumbe ufakele 123.",
        tn: "Kgetsi ga e a bonwa. Leka gape kgotsa leletsa 123.",
        ts: "Mhaka a yi kumekanga. Ringeta nakambe kumbe u fonela 123.",
        ve: "Mufhululu a wo ngo wanwa. Lingedzani hafhu kana ni founela 123.",
        nso: "Mohlala ga se wa hwetšwa. Leka gape goba o letšetše 123.",
        nr: "Icala alifumaneki. Linga godu namkha ufonele u-123.",
      },
      case_status: {
        en: "Case {{caseId}}: {{status}} (Risk: {{riskLevel}})",
        zu: "Icala {{caseId}}: {{status}} (Ingozi: {{riskLevel}})",
        xh: "Ikesi {{caseId}}: {{status}} (Ingozi: {{riskLevel}})",
        st: "Kgetsi {{caseId}}: {{status}} (Kotsi: {{riskLevel}})",
        af: "Saak {{caseId}}: {{status}} (Risiko: {{riskLevel}})",
        ss: "Icala {{caseId}}: {{status}} (Umngcele: {{riskLevel}})",
        tn: "Kgetsi {{caseId}}: {{status}} (Kotsi: {{riskLevel}})",
        ts: "Mhaka {{caseId}}: {{status}} (Nghozi: {{riskLevel}})",
        ve: "Mufhululu {{caseId}}: {{status}} (Khombo: {{riskLevel}})",
        nso: "Mohlala {{caseId}}: {{status}} (Kotsi: {{riskLevel}})",
        nr: "Icala {{caseId}}: {{status}} (Ingozi: {{riskLevel}})",
      },
      sms_case_confirmation: {
        en: "AEGIS: Case {{caseId}} received. You will be contacted.",
        zu: "AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa umuntu.",
        xh: "AEGIS: Ikesi {{caseId}} lwamkelwe. Uzanicelwa.",
        st: "AEGIS: Kgetsi {{caseId}} e amanelwe. O tla lebiswa.",
        af: "AEGIS: Saak {{caseId}} ontvang. U sal gekontak word.",
        ss: "AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa.",
        tn: "AEGIS: Kgetsi {{caseId}} e amogetswe. O tla letsetswa.",
        ts: "AEGIS: Mhaka {{caseId}} yi amukeriwile. U ta foneriwa.",
        ve: "AEGIS: Mufhululu {{caseId}} wo tanganedzwa. Ni do founelwa.",
        nso: "AEGIS: Mohlala {{caseId}} o amogetšwe. O tla letšetšwa.",
        nr: "AEGIS: Icala {{caseId}} lamukelwe. Uzakufonelwa.",
      },
      sms_resources: {
        en: "Shelters: {{shelters}}. Safe houses available 24/7.",
        zu: "Amakhaya: {{shelters}}. Iindawo eziphakeme zilungile 24/7.",
        xh: "Izindawo: {{shelters}}. Amakhaya aphakeme alungile 24/7.",
        st: "Maatla: {{shelters}}. Malapa a sa thotloetsi a le gone 24/7.",
        af: "Skuilings: {{shelters}}. Veilige huise beskikbaar 24/7.",
        ss: "Amakhaya: {{shelters}}. Indawo eziphakeme zilungile 24/7.",
        tn: "Mafelo a go iphitlha: {{shelters}}. Matlo a a sireletsegileng a teng 24/7.",
        ts: "Tindhawu to tumbela: {{shelters}}. Tiyindlu leti sirhelelekeke ti kona 24/7.",
        ve: "Fhethu ha u dzumbama: {{shelters}}. Nndu dzo tsireledzeaho dzi hone 24/7.",
        nso: "Mafelo a go iphihla: {{shelters}}. Dintlo tša polokego di gona 24/7.",
        nr: "Iindawo zokuphephela: {{shelters}}. Iindlu eziphephileko zikhona 24/7.",
      },
      session_closed: {
        en: "Session closed. Stay safe.",
        zu: "Iseshini ivaliwe. Hlala uphephile.",
        xh: "Iseshoni ivaliwe. Hlala ukhuselekile.",
        st: "Seshene e tswaletswe. Dula o bolokehile.",
        af: "Sessie gesluit. Bly veilig.",
        ss: "I-session ivaliwe. Hlala uphephile.",
        tn: "Session e tswaletswe. Nna o bolokegile.",
        ts: "Sesheni yi pfariwile. Tshama u sirhelelekile.",
        ve: "Session yo valiwa. Dzudzani no tsireledzea.",
        nso: "Session e tswaletšwe. Dula o bolokegile.",
        nr: "Iseshini ivaliwe. Hlala uphephile.",
      },
      error: {
        en: "Something went wrong. Please try again, or call 0800 428 428 for help.",
        zu: "Kukhona okungahambanga kahle. Sicela uzame futhi, noma ushayele u-0800 428 428.",
        xh: "Kukho into engahambanga kakuhle. Nceda uzame kwakhona, okanye utsalele u-0800 428 428.",
        st: "Ho na le phoso. Ka kopo leka hape, kapa o letse 0800 428 428.",
        af: "Iets het verkeerd geloop. Probeer asseblief weer, of bel 0800 428 428.",
        ss: "Kukhona lokungahambanga kahle. Sicela uzame futsi, nobe ushayele 0800 428 428.",
        tn: "Go na le phoso. Tsweetswee leka gape, kgotsa o leletse 0800 428 428.",
        ts: "Ku na ni xihoxo. Hi kombela u ringeta nakambe, kumbe u fonela 0800 428 428.",
        ve: "Hu na tshithu tsho khakheaho. Ri humbela ni lingedze hafhu, kana ni founele 0800 428 428.",
        nso: "Go na le phošo. Ka kgopelo leka gape, goba o letše 0800 428 428.",
        nr: "Kukhona okungakahambi kuhle. Sibawa uzame godu, namkha ushayele u-0800 428 428.",
      },
    };

    let text = texts[key]?.[language] || texts[key]?.en || `[${key}]`;

    // Replace variables
    if (variables) {
      Object.entries(variables).forEach(([varKey, value]) => {
        text = text.replace(`{{${varKey}}}`, String(value));
      });
    }

    return text;
  }

  private buildMenuText(
    menuKey: string,
    _options: USSDMenuOption[],
    language: Language,
  ): string {
    return (
      USSD_MENU_TITLES[menuKey as keyof typeof USSD_MENU_TITLES]?.[language] ||
      USSD_MENU_TITLES[menuKey as keyof typeof USSD_MENU_TITLES]?.en ||
      menuKey
    );
  }

  private initializeMenus(): void {
    const baseMenus = Object.fromEntries(
      Object.entries(USSD_MENU_STRUCTURE).map(([menuKey, menuOptions]) => [
        menuKey,
        menuOptions.map((option) => ({
          ...option,
          labels: this.createEmptyLabels(),
        })),
      ]),
    ) as Record<string, USSDMenuOption[]>;

    SUPPORTED_LANGUAGES.forEach((language) => {
      this.menus[language] = Object.fromEntries(
        Object.entries(baseMenus).map(([menuKey, menuOptions]) => [
          menuKey,
          menuOptions.map((option) => ({
            ...option,
            labels: { ...option.labels },
          })),
        ]),
      );
    });
  }

  private createEmptyLabels(): Record<Language, string> {
    return SUPPORTED_LANGUAGES.reduce<Record<Language, string>>(
      (labels, language) => {
        labels[language] = "";
        return labels;
      },
      {} as Record<Language, string>,
    );
  }

  private initializeOfflineCache(): void {
    // In production: load from local storage or IndexedDB
    console.log("✅ USSD offline cache initialized");
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  private generateCaseId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `CASE${timestamp}${random}`;
  }

  private generateEmergencyId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `EMRG${timestamp}${random}`;
  }

  private getExitResponse(
    session: USSDSession,
    language: Language,
  ): USSDResponse {
    return {
      sessionId: session.sessionId,
      menu: "end",
      text: this.getLocalizedText("session_closed", language),
      options: [],
      endSession: true,
    };
  }

  private getErrorResponse(language: Language): USSDResponse {
    const errorText = this.getLocalizedText("error", language);
    return {
      sessionId: "",
      menu: "error",
      text: errorText || "An error occurred. Please try again.",
      options: [],
      endSession: true,
    };
  }
}

export default USSDGateway;
