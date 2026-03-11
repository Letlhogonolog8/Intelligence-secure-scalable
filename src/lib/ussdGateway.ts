/**
 * USSD Gateway Module
 * src/lib/ussdGateway.ts
 * 
 * Secure, production-ready USSD (Unstructured Supplementary Service Data) 
 * integration for supporting users without internet access.
 * Handles SMS-based communication, session management, and data synchronization.
 */

import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type USSDMenuLevel = "main" | "support" | "reporting" | "resources" | "auth";

export interface USSDSession {
  id: string;
  phoneNumber: string;
  sessionId: string;
  currentMenu: USSDMenuLevel;
  userRole?: string;
  userId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface USSDMessage {
  id: string;
  sessionId: string;
  direction: "inbound" | "outbound";
  content: string;
  menuLevel: USSDMenuLevel;
  timestamp: string;
  status: "pending" | "sent" | "delivered" | "failed";
  errorMessage?: string;
}

export interface USSDMenuItem {
  code: string;
  label: string;
  description: string;
  action: "navigate" | "submit" | "exit" | "help";
  nextMenu?: USSDMenuLevel;
  handler?: (input: string) => Promise<string>;
}

export interface USSDMenuConfig {
  level: USSDMenuLevel;
  title: string;
  description: string;
  items: USSDMenuItem[];
  timeout: number;
  maxRetries: number;
}

// ============================================================================
// MENU CONFIGURATIONS
// ============================================================================

const MAIN_MENU: USSDMenuConfig = {
  level: "main",
  title: "AEGIS Support System",
  description: "Welcome to AEGIS. Select an option:",
  items: [
    {
      code: "1",
      label: "Get Support",
      description: "Connect with a counselor",
      action: "navigate",
      nextMenu: "support",
    },
    {
      code: "2",
      label: "Report Incident",
      description: "Report a GBV incident",
      action: "navigate",
      nextMenu: "reporting",
    },
    {
      code: "3",
      label: "Find Resources",
      description: "Find shelters and services",
      action: "navigate",
      nextMenu: "resources",
    },
    {
      code: "4",
      label: "Login to AEGIS",
      description: "Access your account",
      action: "navigate",
      nextMenu: "auth",
    },
    {
      code: "0",
      label: "Exit",
      description: "End session",
      action: "exit",
    },
  ],
  timeout: 300,
  maxRetries: 3,
};

const SUPPORT_MENU: USSDMenuConfig = {
  level: "support",
  title: "Support Services",
  description: "Select support type:",
  items: [
    {
      code: "1",
      label: "Immediate Crisis Support",
      description: "Connect with crisis counselor",
      action: "submit",
    },
    {
      code: "2",
      label: "Schedule Counseling",
      description: "Book a counseling session",
      action: "submit",
    },
    {
      code: "3",
      label: "Safety Planning",
      description: "Get safety planning assistance",
      action: "submit",
    },
    {
      code: "4",
      label: "Legal Information",
      description: "Get legal guidance",
      action: "submit",
    },
    {
      code: "0",
      label: "Back",
      description: "Return to main menu",
      action: "navigate",
      nextMenu: "main",
    },
  ],
  timeout: 300,
  maxRetries: 3,
};

const REPORTING_MENU: USSDMenuConfig = {
  level: "reporting",
  title: "Incident Reporting",
  description: "Report an incident securely. Send STOP at any time.",
  items: [
    {
      code: "1",
      label: "Anonymous Report",
      description: "Report anonymously",
      action: "submit",
    },
    {
      code: "2",
      label: "Report with Contact Info",
      description: "Report and provide contact",
      action: "submit",
    },
    {
      code: "3",
      label: "Get Case Status",
      description: "Check existing report status",
      action: "submit",
    },
    {
      code: "0",
      label: "Back",
      description: "Return to main menu",
      action: "navigate",
      nextMenu: "main",
    },
  ],
  timeout: 600,
  maxRetries: 3,
};

const RESOURCES_MENU: USSDMenuConfig = {
  level: "resources",
  title: "Resources & Services",
  description: "Find help near you:",
  items: [
    {
      code: "1",
      label: "Emergency Shelters",
      description: "Find shelter locations",
      action: "submit",
    },
    {
      code: "2",
      label: "Health Services",
      description: "Find medical facilities",
      action: "submit",
    },
    {
      code: "3",
      label: "Legal Services",
      description: "Find legal aid",
      action: "submit",
    },
    {
      code: "4",
      label: "Counseling Services",
      description: "Find counselors",
      action: "submit",
    },
    {
      code: "0",
      label: "Back",
      description: "Return to main menu",
      action: "navigate",
      nextMenu: "main",
    },
  ],
  timeout: 300,
  maxRetries: 3,
};

const AUTH_MENU: USSDMenuConfig = {
  level: "auth",
  title: "AEGIS Login",
  description: "Enter your credentials securely.",
  items: [
    {
      code: "1",
      label: "Survivor Login",
      description: "Login as survivor",
      action: "submit",
    },
    {
      code: "2",
      label: "Counselor Login",
      description: "Login as counselor",
      action: "submit",
    },
    {
      code: "3",
      label: "Reset Password",
      description: "Reset your password",
      action: "submit",
    },
    {
      code: "0",
      label: "Back",
      description: "Return to main menu",
      action: "navigate",
      nextMenu: "main",
    },
  ],
  timeout: 300,
  maxRetries: 3,
};

const MENU_CONFIG_MAP: Record<USSDMenuLevel, USSDMenuConfig> = {
  main: MAIN_MENU,
  support: SUPPORT_MENU,
  reporting: REPORTING_MENU,
  resources: RESOURCES_MENU,
  auth: AUTH_MENU,
};

// ============================================================================
// USSD GATEWAY CLASS
// ============================================================================

export class USSDGateway {
  private static readonly SESSION_TIMEOUT = 300; // 5 minutes in seconds
  private static readonly MAX_MESSAGE_LENGTH = 160; // SMS standard

  /**
   * Create or retrieve a USSD session
   */
  static async createSession(phoneNumber: string): Promise<USSDSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT * 1000);

    try {
      const { data, error } = await supabase
        .from("ussd_sessions")
        .insert({
          phone_number: phoneNumber,
          session_id: sessionId,
          current_menu: "main",
          metadata: {},
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        phoneNumber: data.phone_number,
        sessionId: data.session_id,
        currentMenu: data.current_menu,
        userRole: data.user_role,
        userId: data.user_id,
        metadata: data.metadata || {},
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        isActive: data.is_active,
      };
    } catch (error) {
      throw new Error(`Failed to create USSD session: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get or create session for phone number
   */
  static async getOrCreateSession(phoneNumber: string): Promise<USSDSession> {
    try {
      const { data, error } = await supabase
        .from("ussd_sessions")
        .select("*")
        .eq("phone_number", phoneNumber)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt > new Date()) {
          return {
            id: data.id,
            phoneNumber: data.phone_number,
            sessionId: data.session_id,
            currentMenu: data.current_menu,
            userRole: data.user_role,
            userId: data.user_id,
            metadata: data.metadata || {},
            createdAt: data.created_at,
            expiresAt: data.expires_at,
            isActive: data.is_active,
          };
        }
      }

      return this.createSession(phoneNumber);
    } catch (_error) {
      throw new Error(`Failed to get or create USSD session: ${getErrorMessage(_error)}`);
    }
  }

  /**
   * Get menu for current level
   */
  static getMenu(level: USSDMenuLevel): USSDMenuConfig {
    return MENU_CONFIG_MAP[level];
  }

  /**
   * Format menu as USSD response
   */
  static formatMenuResponse(menuConfig: USSDMenuConfig): string {
    const lines = [menuConfig.title, menuConfig.description];
    
    menuConfig.items.forEach((item) => {
      lines.push(`${item.code}. ${item.label}`);
    });

    lines.push("Enter choice:");

    const response = lines.join("\n");
    const truncated = response.substring(0, this.MAX_MESSAGE_LENGTH);
    
    return truncated;
  }

  /**
   * Process user input and navigate menu
   */
  static async processUserInput(
    session: USSDSession,
    userInput: string
  ): Promise<{
    menu: USSDMenuConfig;
    response: string;
    nextSession: USSDSession;
  }> {
    const input = userInput.trim().toUpperCase();

    // Handle global commands
    if (input === "STOP" || input === "0") {
      await this.endSession(session.id);
      return {
        menu: MAIN_MENU,
        response: "Session ended. Thank you for using AEGIS.",
        nextSession: await this.getOrCreateSession(session.phoneNumber),
      };
    }

    const currentMenu = MENU_CONFIG_MAP[session.currentMenu];
    const selectedItem = currentMenu.items.find((item) => item.code === input);

    if (!selectedItem) {
      return {
        menu: currentMenu,
        response: `Invalid selection. ${this.formatMenuResponse(currentMenu)}`,
        nextSession: session,
      };
    }

    let nextSession = session;
    let nextMenu = currentMenu;

    if (selectedItem.action === "navigate" && selectedItem.nextMenu) {
      nextMenu = MENU_CONFIG_MAP[selectedItem.nextMenu];
      nextSession = await this.updateSessionMenu(session.id, selectedItem.nextMenu);
    } else if (selectedItem.action === "submit") {
      // Handle submission - store user input and response
      await this.logUSSDMessage(session.sessionId, "inbound", userInput, session.currentMenu);
      
      const responseText = await this.handleMenuSubmission(
        session,
        selectedItem,
        input
      );
      
      return {
        menu: currentMenu,
        response: responseText,
        nextSession,
      };
    } else if (selectedItem.action === "exit") {
      await this.endSession(session.id);
      return {
        menu: currentMenu,
        response: "Thank you for using AEGIS. Goodbye.",
        nextSession,
      };
    }

    return {
      menu: nextMenu,
      response: this.formatMenuResponse(nextMenu),
      nextSession,
    };
  }

  /**
   * Handle menu submission (async processing)
   */
  private static async handleMenuSubmission(
    session: USSDSession,
    item: USSDMenuItem,
    input: string
  ): Promise<string> {
    try {
      // Store the submission for async processing
      await supabase
        .from("ussd_submissions")
        .insert({
          session_id: session.sessionId,
          menu_level: session.currentMenu,
          menu_code: item.code,
          user_input: input,
          timestamp: new Date().toISOString(),
          status: "pending",
        });

      return `${item.label} request received. We will follow up shortly. Reply STOP to exit.`;
    } catch (_error) {
      return `Error processing request. Please try again or reply STOP to exit.`;
    }
  }

  /**
   * Update session menu level
   */
  private static async updateSessionMenu(
    sessionId: string,
    newMenu: USSDMenuLevel
  ): Promise<USSDSession> {
    const { data, error } = await supabase
      .from("ussd_sessions")
      .update({ current_menu: newMenu })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      phoneNumber: data.phone_number,
      sessionId: data.session_id,
      currentMenu: data.current_menu,
      userRole: data.user_role,
      userId: data.user_id,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      isActive: data.is_active,
    };
  }

  /**
   * End USSD session
   */
  static async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from("ussd_sessions")
      .update({ is_active: false })
      .eq("id", sessionId);

    if (error) throw error;
  }

  /**
   * Log USSD message
   */
  private static async logUSSDMessage(
    sessionId: string,
    direction: "inbound" | "outbound",
    content: string,
    menuLevel: USSDMenuLevel
  ): Promise<void> {
    await supabase
      .from("ussd_messages")
      .insert({
        session_id: sessionId,
        direction,
        content,
        menu_level: menuLevel,
        timestamp: new Date().toISOString(),
        status: "delivered",
      });
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `USSD_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string): Promise<USSDSession | null> {
    try {
      const { data, error } = await supabase
        .from("ussd_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error && error.code === "PGRST116") return null;
      if (error) throw error;

      return {
        id: data.id,
        phoneNumber: data.phone_number,
        sessionId: data.session_id,
        currentMenu: data.current_menu,
        userRole: data.user_role,
        userId: data.user_id,
        metadata: data.metadata || {},
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        isActive: data.is_active,
      };
    } catch (error) {
      throw new Error(`Failed to get USSD session: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Clean up expired sessions (should run periodically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from("ussd_sessions")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select();

      if (error) throw error;

      return data?.length ?? 0;
    } catch (error) {
      console.error(`Failed to cleanup USSD sessions: ${getErrorMessage(error)}`);
      return 0;
    }
  }
}
