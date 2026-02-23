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

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type USSDAction = 'report' | 'help' | 'status' | 'emergency' | 'back' | 'quit';
export type Language = 'en' | 'zu' | 'xh' | 'st' | 'af' | 'ss';

export interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  language: Language;
  currentMenu: string;
  state: Record<string, any>;
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

export class USSDGateway {
  private supabase: SupabaseClient;
  private offlineCache: Map<string, any> = new Map();
  private menus: Record<Language, Record<string, USSDMenuOption[]>> = {} as any;
  private telkomApiKey: string;
  private telkomApiUrl: string;
  private telkomUssdCode: string;
  private telkomCallbackUrl: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.telkomApiKey = process.env.TELKOM_API_KEY || '';
    this.telkomApiUrl = process.env.TELKOM_API_URL || 'https://api.telkom.co.za/ussd/v1';
    this.telkomUssdCode = process.env.TELKOM_USSD_CODE || '*180*123#';
    this.telkomCallbackUrl = process.env.TELKOM_CALLBACK_URL || 'https://your-domain.com/api/ussd/telkom/callback';
    this.initializeMenus();
    this.initializeOfflineCache();
  }

  /**
   * Send USSD response to Telkom
   */
  public async sendTelkomResponse(phoneNumber: string, message: string, endSession: boolean = false): Promise<boolean> {
    try {
      if (!this.telkomApiKey) {
        console.warn('⚠️  Telkom API key not configured. Skipping Telkom send.');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const payload = {
        subscriber: cleanPhone,
        text: message,
        end: endSession,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(`${this.telkomApiUrl}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.telkomApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Telkom API error: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ USSD sent to ${phoneNumber} via Telkom`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send USSD via Telkom:', error);
      return false;
    }
  }

  /**
   * Handle Telkom callback (webhook from provider)
   */
  public async handleTelkomCallback(payload: any): Promise<USSDResponse> {
    try {
      // Telkom uses 'subscriber' instead of phoneNumber
      const { subscriber, input, sessionId, language = 'en' } = payload;
      const phoneNumber = subscriber || payload.phoneNumber;
      const userInput = input || payload.userInput;

      // Log callback for audit
      await this.supabase.from('ussd_callbacks').insert({
        phone_number: phoneNumber,
        provider: 'telkom',
        user_input: userInput,
        session_id: sessionId,
        payload,
        received_at: new Date().toISOString(),
      });

      // Process USSD request
      const response = await this.handleUSSDRequest(phoneNumber, userInput, language);
      
      // Send response back to Telkom
      await this.sendTelkomResponse(phoneNumber, response.text, response.endSession);

      return response;
    } catch (error) {
      console.error('❌ Error handling Telkom callback:', error);
      throw error;
    }
  }

  /**
   * Handle incoming USSD request
   */
  public async handleUSSDRequest(
    phoneNumber: string,
    userInput: string,
    language: Language = 'en'
  ): Promise<USSDResponse> {
    try {
      // Get or create session
      const session = await this.getOrCreateSession(phoneNumber, language);

      // Process user input
      const response = await this.processInput(session, userInput, language);

      // Update session
      await this.updateSession(session.sessionId, response);

      return response;
    } catch (error) {
      console.error('USSD request error:', error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Process user input and navigate menu
   */
  private async processInput(
    session: USSDSession,
    userInput: string,
    language: Language
  ): Promise<USSDResponse> {
    const trimmedInput = userInput.trim();

    // Handle navigation
    if (trimmedInput === '0') {
      session.currentMenu = 'main';
    } else if (trimmedInput === '*') {
      session.currentMenu = 'main';
    } else if (session.currentMenu === 'report_details') {
      return await this.handleReportSubmission(session, userInput, language);
    } else if (session.currentMenu === 'help_details') {
      return await this.handleHelpRequest(session, userInput, language);
    } else if (session.currentMenu === 'case_reference') {
      return await this.handleCaseStatusQuery(session, userInput, language);
    } else {
      // Handle menu selection
      session.currentMenu = `menu_${trimmedInput}`;
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
    language: Language
  ): Promise<USSDResponse> {
    try {
      // Create case
      const caseId = this.generateCaseId();

      const { data: caseRecord, error } = await this.supabase.from('cases').insert({
        id: caseId,
        phone_number: session.phoneNumber,
        description: details,
        channel: 'ussd',
        status: 'submitted',
        risk_level: 'medium', // Will be assessed by AI
        created_at: new Date().toISOString(),
        source_session_id: session.sessionId,
      });

      if (error) throw error;

      // Log to offline cache for disaster recovery
      this.offlineCache.set(`case:${caseId}`, {
        caseId,
        phoneNumber: session.phoneNumber,
        details,
        timestamp: new Date().toISOString(),
      });

      // Send SMS confirmation
      await this.sendConfirmationSMS(session.phoneNumber, caseId, language);

      // Trigger risk assessment
      await this.triggerRiskAssessment(caseId);

      // Return confirmation
      const confirmationText = this.getLocalizedText('confirmation', language, {
        caseId,
      });

      return {
        sessionId: session.sessionId,
        menu: 'confirmation',
        text: confirmationText,
        options: this.menus[language]['end'] || [],
        endSession: true,
        smsFollowUp: `Case ID: ${caseId}\nWe will contact you soon.`,
      };
    } catch (error) {
      console.error('Report submission error:', error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Handle emergency help request
   */
  private async handleHelpRequest(
    session: USSDSession,
    helpType: string,
    language: Language
  ): Promise<USSDResponse> {
    try {
      // Create emergency request
      const emergencyId = this.generateEmergencyId();

      const { error } = await this.supabase.from('emergency_requests').insert({
        id: emergencyId,
        phone_number: session.phoneNumber,
        help_type: helpType,
        channel: 'ussd',
        status: 'received',
        created_at: new Date().toISOString(),
        source_session_id: session.sessionId,
      });

      if (error) throw error;

      // Find nearest resources
      const resources = await this.findNearestResources(session.phoneNumber);

      // Send SMS with resource info
      await this.sendResourceSMS(session.phoneNumber, resources, language);

      const responseText = this.getLocalizedText('help_confirmation', language, {
        shelters: resources.shelters.length,
        counselors: resources.counselors.length,
      });

      return {
        sessionId: session.sessionId,
        menu: 'help_confirmation',
        text: responseText,
        options: this.menus[language]['end'] || [],
        endSession: true,
        smsFollowUp: `Help request received. Resources sent via SMS.`,
      };
    } catch (error) {
      console.error('Help request error:', error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Handle case status queries
   */
  private async handleCaseStatusQuery(
    session: USSDSession,
    caseReference: string,
    language: Language
  ): Promise<USSDResponse> {
    try {
      // Fetch case
      const { data: caseRecord } = await this.supabase
        .from('cases')
        .select('id, status, risk_level, updated_at')
        .or(
          `id.eq.${caseReference},case_number.eq.${caseReference}`
        )
        .single();

      if (!caseRecord) {
        const notFoundText = this.getLocalizedText('case_not_found', language);
        return {
          sessionId: session.sessionId,
          menu: 'case_not_found',
          text: notFoundText,
          options: this.menus[language]['main'] || [],
          endSession: false,
        };
      }

      const statusText = this.getLocalizedText('case_status', language, {
        caseId: caseRecord.id,
        status: caseRecord.status,
        riskLevel: caseRecord.risk_level,
      });

      return {
        sessionId: session.sessionId,
        menu: 'case_status_result',
        text: statusText,
        options: this.menus[language]['main'] || [],
        endSession: false,
      };
    } catch (error) {
      console.error('Case status query error:', error);
      return this.getErrorResponse(language);
    }
  }

  /**
   * Get menu response for current session state
   */
  private async getMenuResponse(session: USSDSession, language: Language): Promise<USSDResponse> {
    const menuKey = session.currentMenu;
    const menuOptions = this.menus[language][menuKey];

    if (!menuOptions) {
      return this.getMenuResponse({ ...session, currentMenu: 'main' }, language);
    }

    const menuText = this.buildMenuText(menuKey, menuOptions, language);

    return {
      sessionId: session.sessionId,
      menu: menuKey,
      text: menuText,
      options: menuOptions,
      endSession: false,
    };
  }

  /**
   * Get session (create if not exists)
   */
  private async getOrCreateSession(phoneNumber: string, language: Language): Promise<USSDSession> {
    try {
      // Try to fetch existing session
      const { data: existing } = await this.supabase
        .from('ussd_sessions')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return {
          sessionId: existing.session_id,
          phoneNumber: existing.phone_number,
          language: existing.language || language,
          currentMenu: existing.current_menu,
          state: existing.state || {},
          createdAt: existing.created_at,
          lastAccessedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      // Session doesn't exist - create new one
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const newSession: USSDSession = {
      sessionId,
      phoneNumber,
      language,
      currentMenu: 'main',
      state: {},
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    };

    await this.supabase.from('ussd_sessions').insert({
      session_id: sessionId,
      phone_number: phoneNumber,
      language,
      current_menu: 'main',
      state: {},
      is_active: true,
      created_at: newSession.createdAt,
    });

    return newSession;
  }

  /**
   * Update session state
   */
  private async updateSession(sessionId: string, response: USSDResponse): Promise<void> {
    try {
      const isActive = !response.endSession;

      await this.supabase
        .from('ussd_sessions')
        .update({
          current_menu: response.menu,
          is_active: isActive,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }

  /**
   * Send SMS confirmation
   */
  private async sendConfirmationSMS(phoneNumber: string, caseId: string, language: Language): Promise<void> {
    try {
      const message = this.getLocalizedText('sms_case_confirmation', language, { caseId });

      const { error } = await this.supabase.from('notification_queue').insert({
        recipient_phone: phoneNumber,
        message,
        channel: 'sms',
        case_id: caseId,
        status: 'queued',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(`📬 SMS confirmation queued for ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to queue SMS:', error);
    }
  }

  /**
   * Send resource SMS
   */
  private async sendResourceSMS(
    phoneNumber: string,
    resources: any,
    language: Language
  ): Promise<void> {
    try {
      const shelterText = resources.shelters
        .slice(0, 2)
        .map((s: any) => `${s.name}: ${s.phone}`)
        .join(' | ');

      const message = this.getLocalizedText('sms_resources', language, {
        shelters: shelterText,
      });

      await this.supabase.from('notification_queue').insert({
        recipient_phone: phoneNumber,
        message,
        channel: 'sms',
        status: 'queued',
        created_at: new Date().toISOString(),
      });

      console.log(`📬 Resources SMS queued for ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to queue resources SMS:', error);
    }
  }

  /**
   * Find nearest resources
   */
  private async findNearestResources(phoneNumber: string): Promise<any> {
    try {
      // Default resources (in production: use location-based lookup)
      const { data: shelters } = await this.supabase
        .from('shelters')
        .select('id, name, phone, location')
        .limit(3);

      const { data: counselors } = await this.supabase
        .from('profiles')
        .select('id, name, phone')
        .eq('role', 'counselor')
        .eq('is_active', true)
        .limit(3);

      return {
        shelters: shelters || [],
        counselors: counselors || [],
      };
    } catch (error) {
      console.error('Failed to find resources:', error);
      return { shelters: [], counselors: [] };
    }
  }

  /**
   * Trigger risk assessment
   */
  private async triggerRiskAssessment(caseId: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('events_log').insert({
        event_type: 'case:created',
        case_id: caseId,
        data: { source: 'ussd' },
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(`✅ Risk assessment triggered for case ${caseId}`);
    } catch (error) {
      console.error('Failed to trigger risk assessment:', error);
    }
  }

  // Localization & Menu Methods

  private getLocalizedText(
    key: string,
    language: Language,
    variables?: Record<string, any>
  ): string {
    const texts: Record<string, Record<Language, string>> = {
      confirmation: {
        en: 'Case reported. ID: {{caseId}}. Help coming soon.',
        zu: 'Icala libhalisiwe. Isithombelo: {{caseId}}. Usizo luza ngesikhashana.',
        xh: 'Ikesi licaciswe. Ikhowudi: {{caseId}}. Uncedo luza ngokukhawuleza.',
        st: 'Kgetsi ya fapano e be e lentswe. ID: {{caseId}}. Thuso e tlo tla ka potlako.',
        af: 'Saak gerapporteer. ID: {{caseId}}. Hulp kom gou.',
        ss: 'Icala liyhalisiwe. Inombolo: {{caseId}}. Incamo imiswele.',
      },
      help_confirmation: {
        en: 'Help received. {{shelters}} shelters nearby. SMS sent.',
        zu: 'Usizo wamukile. {{shelters}} amakhaya asekusedile. I-SMS ithunyelwe.',
        xh: 'Uncedo lwamkelwe. {{shelters}} indawo zokuhlala ekufutshane. Uxwebhu luthumwe.',
        st: 'Thuso e amanelwe. {{shelters}} maatla a mo gaufi. SMS e sentswitswe.',
        af: 'Hulp ontvang. {{shelters}} skuilings naby. SMS gestuur.',
        ss: 'Incamo wamukile. {{shelters}} indawo zokuhlala ekufutshane. SMS ithunyelwe.',
      },
      case_not_found: {
        en: 'Case not found. Try again or call 123.',
        zu: 'Icala litholakali. Zama futhi noma umeme 123.',
        xh: 'Ikesi akufunyanwanga. Zama kwakhona okanye fonela 123.',
        st: 'Kgetsi ga se bonanwwa. Leka gape kgonwa leina 123.',
        af: 'Saak nie gevind nie. Probeer weer of bel 123.',
        ss: 'Icala akutiwa. Zama futhi kumbe ufakele 123.',
      },
      case_status: {
        en: 'Case {{caseId}}: {{status}} (Risk: {{riskLevel}})',
        zu: 'Icala {{caseId}}: {{status}} (Ingozi: {{riskLevel}})',
        xh: 'Ikesi {{caseId}}: {{status}} (Ingozi: {{riskLevel}})',
        st: 'Kgetsi {{caseId}}: {{status}} (Kotsi: {{riskLevel}})',
        af: 'Saak {{caseId}}: {{status}} (Risiko: {{riskLevel}})',
        ss: 'Icala {{caseId}}: {{status}} (Umngcele: {{riskLevel}})',
      },
      sms_case_confirmation: {
        en: 'AEGIS: Case {{caseId}} received. You will be contacted.',
        zu: 'AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa umuntu.',
        xh: 'AEGIS: Ikesi {{caseId}} lwamkelwe. Uzanicelwa.',
        st: 'AEGIS: Kgetsi {{caseId}} e amanelwe. O tla lebiswa.',
        af: 'AEGIS: Saak {{caseId}} ontvang. U sal gekontak word.',
        ss: 'AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa.',
      },
      sms_resources: {
        en: 'Shelters: {{shelters}}. Safe houses available 24/7.',
        zu: 'Amakhaya: {{shelters}}. Iindawo eziphakeme zilungile 24/7.',
        xh: 'Izindawo: {{shelters}}. Amakhaya aphakeme alungile 24/7.',
        st: 'Maatla: {{shelters}}. Malapa a sa thotloetsi a le gone 24/7.',
        af: 'Skuilings: {{shelters}}. Veilige huise beskikbaar 24/7.',
        ss: 'Amakhaya: {{shelters}}. Indawo eziphakeme zilungile 24/7.',
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

  private buildMenuText(menuKey: string, options: USSDMenuOption[], language: Language): string {
    const titles: Record<string, Record<Language, string>> = {
      main: {
        en: 'AEGIS GBV Support\n1. Report Incident\n2. Get Help\n3. Case Status\n4. Emergency Alert\n0. Exit',
        zu:
          'Isisebenzi se-AEGIS\n1. Bhala Icala\n2. Thola Usizo\n3. Isimo Secala\n4. Isilindo Lokubhubhiseka\n0. Phuma',
        xh: 'Uncedo lwe-AEGIS\n1. Xela Isimangaliso\n2. Fumana Incedo\n3. Imisebenzi Yecala\n4. Ibhaleyilo Yethutyana\n0. Suka',
        st: 'Thuso ya AEGIS\n1. Gaka Ntswakiso\n2. Fumana Thuso\n3. Boemo ba Kgetsi\n4. Ikonokelo ya Ligokotsi\n0. Ema',
        af: 'AEGIS Ondersteuning\n1. Rapporteer Voorval\n2. Kry Hulp\n3. Saakstatus\n4. Noodtoestand\n0. Uitgang',
        ss: 'Incamo ye-AEGIS\n1. Phakamisa Icala\n2. Thola Usizo\n3. Isimo Secala\n4. I-Emergency Alert\n0. Phuma',
      },
      menu_1: {
        en: 'Describe incident:\nBrief details please.',
        zu: 'Chaza lento okwenzeka:\nUmuntu muncinane.',
        xh: 'Chaza into eyenzeke:\nImininingwane emfutshane.',
        st: 'Thagela mokgatlho:\nThagela bonnyane.',
        af: 'Beskryf voorval:\nKorte besonderhede asseblief.',
        ss: 'Hlathula lokwakwenzela:\nUmuntu muncinane.',
      },
      menu_2: {
        en: 'What help do you need?\n1. Shelter\n2. Counseling\n3. Medical\n4. Police',
        zu: 'Yini usizo okudingayo?\n1. Ikhaya\n2. Ukunandisana\n3. Iziguli\n4. Amapolisa',
        xh: 'Yoluphi uncedo onodinga?\n1. Indawo Yokuhlala\n2. Untetho\n3. Izigqebela\n4. Amapolisa',
        st: 'Thuso efe o nago go e fumana?\n1. Mophato\n2. Kgetsi\n3. Bolwetse\n4. Mapodisi',
        af: 'Watter hulp het u nodig?\n1. Skuiling\n2. Terapie\n3. Mediese\n4. Polisie',
        ss: 'Yini usizo okudingayo?\n1. Ikhaya\n2. Ukunandisana\n3. Iziguli\n4. Amapolisa',
      },
      menu_3: {
        en: 'Enter case ID or number:',
        zu: 'Faka isithombelo secala noma inombolo:',
        xh: 'Faka ikhowudi yecala okanye inombolo:',
        st: 'Kenya khowudi ya kgetsi kgonwa le nomoro:',
        af: 'Voer saak-ID of nommer in:',
        ss: 'Faka isithombelo secala noma inombolo:',
      },
      menu_4: {
        en: 'Emergency - Police being notified. Stay safe.',
        zu: 'Ibhaleyilo - Amapolisa azotiwe. Hlala naphakeme.',
        xh: 'I-emergency - Amapolisa azonicelwa. Hlala ekhuselekile.',
        st: 'Kotsi - Mapodisi a tla lemoga. Dula a sa lwala.',
        af: 'Noodtoestand - Polisie word in kennis gestel. Bly veilig.',
        ss: 'I-Emergency - Amapolisa azonicelwa. Hlala ekhuselekile.',
      },
      end: {
        en: '0. Back to Menu\n*. Exit',
        zu: '0. Buya Ekumenyu\n*. Phuma',
        xh: '0. Buya Kwemenu\n*. Suka',
        st: '0. Koma go Menya\n*. Ema',
        af: '0. Terug na Keuzemenu\n*. Uitgang',
        ss: '0. Buya Ekumenyu\n*. Phuma',
      },
    };

    return titles[menuKey]?.[language] || titles[menuKey]?.en || menuKey;
  }

  private initializeMenus(): void {
    // Main menu structure (same across languages)
    this.menus.en = {
      main: [
        { key: '1', label: 'Report Incident', labels: {} as any, nextMenu: 'report_details', action: 'report', requiresInput: true },
        { key: '2', label: 'Get Help', labels: {} as any, nextMenu: 'help_details', action: 'help', requiresInput: true },
        { key: '3', label: 'Case Status', labels: {} as any, nextMenu: 'case_reference', action: 'status', requiresInput: true },
        { key: '4', label: 'Emergency Alert', labels: {} as any, nextMenu: 'emergency_alert', action: 'emergency' },
      ],
      end: [],
    };

    // Copy structure to other languages
    ['zu', 'xh', 'st', 'af', 'ss'].forEach((lang) => {
      this.menus[lang] = { ...this.menus.en };
    });
  }

  private initializeOfflineCache(): void {
    // In production: load from local storage or IndexedDB
    console.log('✅ USSD offline cache initialized');
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateCaseId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CASE${timestamp}${random}`;
  }

  private generateEmergencyId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `EMRG${timestamp}${random}`;
  }

  private getErrorResponse(language: Language): USSDResponse {
    const errorText = this.getLocalizedText('error', language);
    return {
      sessionId: '',
      menu: 'error',
      text: errorText || 'An error occurred. Please try again.',
      options: [],
      endSession: true,
    };
  }
}

export default USSDGateway;
