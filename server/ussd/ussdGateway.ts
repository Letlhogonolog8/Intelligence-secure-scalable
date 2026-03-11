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
export type Language = 'en' | 'zu' | 'xh' | 'st' | 'af' | 'ss' | 'tn' | 'ts' | 've' | 'nso' | 'nr';

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

const SUPPORTED_LANGUAGES: Language[] = ['en', 'zu', 'xh', 'st', 'af', 'ss', 'tn', 'ts', 've', 'nso', 'nr'];

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
    this.telkomApiKey = process.env.TELKOM_API_KEY || '';
    this.telkomApiUrl = process.env.TELKOM_API_URL || 'https://api.telkom.co.za/ussd/v1';
    this.telkomUssdCode = process.env.TELKOM_USSD_CODE || '';
    this.telkomCallbackUrl = process.env.TELKOM_CALLBACK_URL || '';
    this.initializeMenus();
    this.initializeOfflineCache();
  }

  /**
   * Send USSD response to Telkom
   */
  public async sendTelkomResponse(phoneNumber: string, message: string, endSession: boolean = false): Promise<boolean> {
    try {
      if (!this.telkomApiKey || !this.telkomApiUrl || !this.telkomUssdCode || !this.telkomCallbackUrl) {
        console.warn('⚠️  Telkom provider configuration incomplete. Skipping Telkom send.');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (!cleanPhone) {
        console.warn('⚠️  Telkom send skipped because subscriber phone number is empty.');
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

      const response = await fetch(`${this.telkomApiUrl}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.telkomApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
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
  public async handleTelkomCallback(payload: TelkomCallbackPayload): Promise<USSDResponse> {
    try {
      const { subscriber, input, sessionId, language = 'en' } = payload;
      const phoneNumber = subscriber || payload.phoneNumber || '';
      const userInput = input || payload.userInput || '';
      const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

      if (!phoneNumber || !sessionId) {
        throw new Error('Invalid Telkom callback payload: missing phone number or sessionId');
      }

      await this.supabase.from('ussd_callbacks').insert({
        phone_number: phoneNumber,
        provider: 'telkom',
        user_input: userInput,
        session_id: sessionId,
        payload,
        received_at: new Date().toISOString(),
      });

      const response = await this.handleUSSDRequest(phoneNumber, userInput, normalizedLanguage);
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
    const trimmedInput = (userInput || '').trim();

    // Handle navigation
    if (trimmedInput === '0' || trimmedInput === '*') {
      session.currentMenu = 'main';
      return this.getMenuResponse(session, language);
    } 

    if (session.currentMenu === 'main') {
      const option = this.menus[language]?.main?.find((opt) => opt.key === trimmedInput);
      if (option) {
        if (option.action === 'emergency') {
          return await this.handleHelpRequest(session, 'Emergency', language);
        }
        session.currentMenu = option.nextMenu;
      }
    } else if (session.currentMenu === 'report_details') {
      return await this.handleReportSubmission(session, trimmedInput, language);
    } else if (session.currentMenu === 'help_details') {
      return await this.handleHelpRequest(session, trimmedInput, language);
    } else if (session.currentMenu === 'case_reference') {
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
    language: Language
  ): Promise<USSDResponse> {
    try {
      // Create case
      const caseId = this.generateCaseId();

      const { error } = await this.supabase.from('cases').insert({
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
        options: this.menus[language]?.end || [],
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
        options: this.menus[language]?.end || [],
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
          options: this.menus[language]?.main || [],
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
        options: this.menus[language]?.main || [],
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
    const menuOptions = this.menus[language]?.[menuKey];

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
    } catch (_error) {
      void _error;
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
        recipient_type: 'sms',
        recipient_address: phoneNumber,
        message_type: 'ussd_confirmation',
        message_content: message,
        case_id: caseId,
        status: 'pending',
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
    resources: NearestResources,
    language: Language
  ): Promise<void> {
    try {
      const shelterText = resources.shelters
        .slice(0, 2)
        .map((shelter) => `${shelter.name}: ${shelter.phone || 'N/A'}`)
        .join(' | ');

      const message = this.getLocalizedText('sms_resources', language, {
        shelters: shelterText,
      });

      const { error } = await this.supabase.from('notification_queue').insert({
        recipient_type: 'sms',
        recipient_address: phoneNumber,
        message_type: 'ussd_resources',
        message_content: message,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log(`📬 Resources SMS queued for ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to queue resources SMS:', error);
    }
  }

  /**
   * Find nearest resources
   */
  private async findNearestResources(_phoneNumber: string): Promise<NearestResources> {
    try {
      const { data: shelters } = await this.supabase
        .from('shelters')
        .select('id, name, phone, location')
        .limit(3);

      const { data: counselors } = await this.supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'counselor')
        .eq('is_active', true)
        .limit(3);

      return {
        shelters: (shelters || []) as ResourceContact[],
        counselors: (counselors || []).map((counselor) => ({
          id: counselor.id,
          name: counselor.full_name || 'Counselor',
          phone: counselor.phone,
        })),
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
    variables?: TemplateVariables
  ): string {
    const texts: Record<string, Record<Language, string>> = {
      confirmation: {
        en: 'Case reported. ID: {{caseId}}. Help coming soon.',
        zu: 'Icala libhalisiwe. Isithombelo: {{caseId}}. Usizo luza ngesikhashana.',
        xh: 'Ikesi licaciswe. Ikhowudi: {{caseId}}. Uncedo luza ngokukhawuleza.',
        st: 'Kgetsi ya fapano e be e lentswe. ID: {{caseId}}. Thuso e tlo tla ka potlako.',
        af: 'Saak gerapporteer. ID: {{caseId}}. Hulp kom gou.',
        ss: 'Icala liyhalisiwe. Inombolo: {{caseId}}. Incamo imiswele.',
        tn: 'Kgetsi e begilwe. ID: {{caseId}}. Thuso e tla tla go se kgale.',
        ts: 'Mhaka yi vikiwile. ID: {{caseId}}. Mpfuno wu ta fika ku nga ri khale.',
        ve: 'Mufhululu wo vhigiwa. ID: {{caseId}}. Thuso i khou da hu si kale.',
        nso: 'Mohlala o begilwe. ID: {{caseId}}. Thuso e tla tla e se kgale.',
        nr: 'Icala libikiwe. ID: {{caseId}}. Isizo liza maduze.',
      },
      help_confirmation: {
        en: 'Help received. {{shelters}} shelters nearby. SMS sent.',
        zu: 'Usizo wamukile. {{shelters}} amakhaya asekusedile. I-SMS ithunyelwe.',
        xh: 'Uncedo lwamkelwe. {{shelters}} indawo zokuhlala ekufutshane. Uxwebhu luthumwe.',
        st: 'Thuso e amanelwe. {{shelters}} maatla a mo gaufi. SMS e sentswitswe.',
        af: 'Hulp ontvang. {{shelters}} skuilings naby. SMS gestuur.',
        ss: 'Incamo wamukile. {{shelters}} indawo zokuhlala ekufutshane. SMS ithunyelwe.',
        tn: 'Thuso e amogetswe. {{shelters}} mafelo a go iphitlha a gaufi. SMS e rometswe.',
        ts: 'Mpfuno wu amukeriwile. {{shelters}} tindhawu to tumbela ti kusuhi. SMS yi rhumeriwile.',
        ve: 'Thuso yo tanganedzwa. {{shelters}} fhethu ha u dzumbama hu tsini. SMS yo rumelwa.',
        nso: 'Thuso e amogetšwe. {{shelters}} mafelo a go iphihla a kgauswi. SMS e rometšwe.',
        nr: 'Isizo lamukelwe. {{shelters}} iindawo zokuphephela ziseduze. ISMS ithunyelwe.',
      },
      case_not_found: {
        en: 'Case not found. Try again or call 123.',
        zu: 'Icala litholakali. Zama futhi noma umeme 123.',
        xh: 'Ikesi akufunyanwanga. Zama kwakhona okanye fonela 123.',
        st: 'Kgetsi ga se bonanwwa. Leka gape kgonwa leina 123.',
        af: 'Saak nie gevind nie. Probeer weer of bel 123.',
        ss: 'Icala akutiwa. Zama futhi kumbe ufakele 123.',
        tn: 'Kgetsi ga e a bonwa. Leka gape kgotsa leletsa 123.',
        ts: 'Mhaka a yi kumekanga. Ringeta nakambe kumbe u fonela 123.',
        ve: 'Mufhululu a wo ngo wanwa. Lingedzani hafhu kana ni founela 123.',
        nso: 'Mohlala ga se wa hwetšwa. Leka gape goba o letšetše 123.',
        nr: 'Icala alifumaneki. Linga godu namkha ufonele u-123.',
      },
      case_status: {
        en: 'Case {{caseId}}: {{status}} (Risk: {{riskLevel}})',
        zu: 'Icala {{caseId}}: {{status}} (Ingozi: {{riskLevel}})',
        xh: 'Ikesi {{caseId}}: {{status}} (Ingozi: {{riskLevel}})',
        st: 'Kgetsi {{caseId}}: {{status}} (Kotsi: {{riskLevel}})',
        af: 'Saak {{caseId}}: {{status}} (Risiko: {{riskLevel}})',
        ss: 'Icala {{caseId}}: {{status}} (Umngcele: {{riskLevel}})',
        tn: 'Kgetsi {{caseId}}: {{status}} (Kotsi: {{riskLevel}})',
        ts: 'Mhaka {{caseId}}: {{status}} (Nghozi: {{riskLevel}})',
        ve: 'Mufhululu {{caseId}}: {{status}} (Khombo: {{riskLevel}})',
        nso: 'Mohlala {{caseId}}: {{status}} (Kotsi: {{riskLevel}})',
        nr: 'Icala {{caseId}}: {{status}} (Ingozi: {{riskLevel}})',
      },
      sms_case_confirmation: {
        en: 'AEGIS: Case {{caseId}} received. You will be contacted.',
        zu: 'AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa umuntu.',
        xh: 'AEGIS: Ikesi {{caseId}} lwamkelwe. Uzanicelwa.',
        st: 'AEGIS: Kgetsi {{caseId}} e amanelwe. O tla lebiswa.',
        af: 'AEGIS: Saak {{caseId}} ontvang. U sal gekontak word.',
        ss: 'AEGIS: Icala {{caseId}} liyamukile. Uzonicelwa.',
        tn: 'AEGIS: Kgetsi {{caseId}} e amogetswe. O tla letsetswa.',
        ts: 'AEGIS: Mhaka {{caseId}} yi amukeriwile. U ta foneriwa.',
        ve: 'AEGIS: Mufhululu {{caseId}} wo tanganedzwa. Ni do founelwa.',
        nso: 'AEGIS: Mohlala {{caseId}} o amogetšwe. O tla letšetšwa.',
        nr: 'AEGIS: Icala {{caseId}} lamukelwe. Uzakufonelwa.',
      },
      sms_resources: {
        en: 'Shelters: {{shelters}}. Safe houses available 24/7.',
        zu: 'Amakhaya: {{shelters}}. Iindawo eziphakeme zilungile 24/7.',
        xh: 'Izindawo: {{shelters}}. Amakhaya aphakeme alungile 24/7.',
        st: 'Maatla: {{shelters}}. Malapa a sa thotloetsi a le gone 24/7.',
        af: 'Skuilings: {{shelters}}. Veilige huise beskikbaar 24/7.',
        ss: 'Amakhaya: {{shelters}}. Indawo eziphakeme zilungile 24/7.',
        tn: 'Mafelo a go iphitlha: {{shelters}}. Matlo a a sireletsegileng a teng 24/7.',
        ts: 'Tindhawu to tumbela: {{shelters}}. Tiyindlu leti sirhelelekeke ti kona 24/7.',
        ve: 'Fhethu ha u dzumbama: {{shelters}}. Nndu dzo tsireledzeaho dzi hone 24/7.',
        nso: 'Mafelo a go iphihla: {{shelters}}. Dintlo tša polokego di gona 24/7.',
        nr: 'Iindawo zokuphephela: {{shelters}}. Iindlu eziphephileko zikhona 24/7.',
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
        zu: 'Isisebenzi se-AEGIS\n1. Bhala Icala\n2. Thola Usizo\n3. Isimo Secala\n4. Isilindo Lokubhubhiseka\n0. Phuma',
        xh: 'Uncedo lwe-AEGIS\n1. Xela Isimangaliso\n2. Fumana Incedo\n3. Imisebenzi Yecala\n4. Ibhaleyilo Yethutyana\n0. Suka',
        st: 'Thuso ya AEGIS\n1. Gaka Ntswakiso\n2. Fumana Thuso\n3. Boemo ba Kgetsi\n4. Ikonokelo ya Ligokotsi\n0. Ema',
        af: 'AEGIS Ondersteuning\n1. Rapporteer Voorval\n2. Kry Hulp\n3. Saakstatus\n4. Noodtoestand\n0. Uitgang',
        ss: 'Incamo ye-AEGIS\n1. Phakamisa Icala\n2. Thola Usizo\n3. Isimo Secala\n4. I-Emergency Alert\n0. Phuma',
        tn: 'Thuso ya AEGIS\n1. Bega Kgetsi\n2. Kopa Thuso\n3. Boemo jwa Kgetsi\n4. Tlhagiso ya Tshoganetso\n0. Tswa',
        ts: 'Mpfuno wa AEGIS\n1. Vika Mhaka\n2. Kombela Mpfuno\n3. Xiyimo xa Mhaka\n4. Xivikelo xa xihatla\n0. Huma',
        ve: 'Thuso ya AEGIS\n1. Vhiga Mufhululu\n2. Humbela Thuso\n3. Tshiimo tsha Mufhululu\n4. Tsevho ya Tshihafu\n0. Bvuma',
        nso: 'Thuso ya AEGIS\n1. Bega Mohlala\n2. Kgopela Thuso\n3. Boemo bja Mohlala\n4. Temošo ya Tšhoganetšo\n0. Etswa',
        nr: 'Isizo le-AEGIS\n1. Bika Icala\n2. Funa Isizo\n3. Ubujamo Becala\n4. Isiyeleliso Esiphuthumako\n0. Phuma',
      },
      report_details: {
        en: 'Describe incident:\nBrief details please.',
        zu: 'Chaza lento okwenzeka:\nUmuntu muncinane.',
        xh: 'Chaza into eyenzeke:\nImininingwane emfutshane.',
        st: 'Thagela mokgatlho:\nThagela bonnyane.',
        af: 'Beskryf voorval:\nKorte besonderhede asseblief.',
        ss: 'Hlathula lokwakwenzela:\nUmuntu muncinane.',
        tn: 'Tlhalosa tiragalo:\nDintlha tse dikhutshwane tsweetswee.',
        ts: 'Hlamusela mhaka:\nVuxokoxoko byo koma ndza kombela.',
        ve: 'Talutshedzani mufhululu:\nZwidodombedzwa zwi pfufhi nga khumbelo.',
        nso: 'Hlalosa tiragalo:\nDintlha tše dikopana hle.',
        nr: 'Hlathulula isehlakalo:\nImininingwana emifitjhani ngiyabawa.',
      },
      help_details: {
        en: 'What help do you need?\n1. Shelter\n2. Counseling\n3. Medical\n4. Police',
        zu: 'Yini usizo okudingayo?\n1. Ikhaya\n2. Ukunandisana\n3. Iziguli\n4. Amapolisa',
        xh: 'Yoluphi uncedo onodinga?\n1. Indawo Yokuhlala\n2. Untetho\n3. Izigqebela\n4. Amapolisa',
        st: 'Thuso efe o nago go e fumana?\n1. Mophato\n2. Kgetsi\n3. Bolwetse\n4. Mapodisi',
        af: 'Watter hulp het u nodig?\n1. Skuiling\n2. Terapie\n3. Mediese\n4. Polisie',
        ss: 'Yini usizo okudingayo?\n1. Ikhaya\n2. Ukunandisana\n3. Iziguli\n4. Amapolisa',
        tn: 'O tlhoka thuso efe?\n1. Lefelo la go iphitlha\n2. Bogakolodi\n3. Kalafi\n4. Mapodisi',
        ts: 'U lava mpfuno wihi?\n1. Ndhawu yo tumbela\n2. Ntsundzuxo\n3. Vutshunguri\n4. Maphorisa',
        ve: 'Ni khou toda thuso ifhio?\n1. Fhethu ha u dzumbama\n2. Vhueletshedzi\n3. Tshihedzwa\n4. Mapholisa',
        nso: 'O hloka thuso efe?\n1. Lefelo la go iphihla\n2. Keletšo\n3. Kalafo\n4. Maphodisa',
        nr: 'Udinga isizo elinjani?\n1. Indawo yokuphephela\n2. Ukwelulekwa\n3. Ezamapilo\n4. Amapholisa',
      },
      case_reference: {
        en: 'Enter case ID or number:',
        zu: 'Faka isithombelo secala noma inombolo:',
        xh: 'Faka ikhowudi yecala okanye inombolo:',
        st: 'Kenya khowudi ya kgetsi kgonwa le nomoro:',
        af: 'Voer saak-ID of nommer in:',
        ss: 'Faka isithombelo secala noma inombolo:',
        tn: 'Tsenya ID kgotsa nomoro ya kgetsi:',
        ts: 'Nghenisa ID kumbe nomboro ya mhaka:',
        ve: 'Dzhenisani ID kana nomboro ya mufhululu:',
        nso: 'Tsenya ID goba nomoro ya mohlala:',
        nr: 'Faka i-ID namkha inomboro yecala:',
      },
      emergency_alert: {
        en: 'Emergency - Police being notified. Stay safe.',
        zu: 'Ibhaleyilo - Amapolisa azotiwe. Hlala naphakeme.',
        xh: 'I-emergency - Amapolisa azonicelwa. Hlala ekhuselekile.',
        st: 'Kotsi - Mapodisi a tla lemoga. Dula a sa lwala.',
        af: 'Noodtoestand - Polisie word in kennis gestel. Bly veilig.',
        ss: 'I-Emergency - Amapolisa azonicelwa. Hlala ekhuselekile.',
        tn: 'Tshoganetso - Mapodisi a a itsisetswe. Nna o sireletsegile.',
        ts: 'Xihatla - Maphorisa ya tivisiwile. Tshama u sirhelelekile.',
        ve: 'Tshihafu - Mapholisa vha khou divhadzwa. Dzudzani no tsireledzea.',
        nso: 'Tšhoganetšo - Maphodisa a tsebišitšwe. Dula o bolokegile.',
        nr: 'Isiphuthumako - Amapholisa ayabikelwa. Hlala uphephile.',
      },
      end: {
        en: '0. Back to Menu\n*. Exit',
        zu: '0. Buya Ekumenyu\n*. Phuma',
        xh: '0. Buya Kwemenu\n*. Suka',
        st: '0. Koma go Menya\n*. Ema',
        af: '0. Terug na Keuzemenu\n*. Uitgang',
        ss: '0. Buya Ekumenyu\n*. Phuma',
        tn: '0. Boela kwa Menung\n*. Tswa',
        ts: '0. Tlhela eka Menu\n*. Huma',
        ve: '0. Vhuyelela kha Menu\n*. Bvuma',
        nso: '0. Boela go Menu\n*. Etswa',
        nr: '0. Buyela kuMenyu\n*. Phuma',
      },
    };

    return titles[menuKey]?.[language] || titles[menuKey]?.en || menuKey;
  }

  private initializeMenus(): void {
    // Main menu structure (same across languages)
    this.menus.en = {
      main: [
        { key: '1', label: 'Report Incident', labels: this.createEmptyLabels(), nextMenu: 'report_details', action: 'report', requiresInput: true },
        { key: '2', label: 'Get Help', labels: this.createEmptyLabels(), nextMenu: 'help_details', action: 'help', requiresInput: true },
        { key: '3', label: 'Case Status', labels: this.createEmptyLabels(), nextMenu: 'case_reference', action: 'status', requiresInput: true },
        { key: '4', label: 'Emergency Alert', labels: this.createEmptyLabels(), nextMenu: 'emergency_alert', action: 'emergency' },
      ],
      report_details: [],
      help_details: [],
      case_reference: [],
      emergency_alert: [],
      confirmation: [],
      help_confirmation: [],
      case_not_found: [],
      case_status_result: [],
      error: [],
      end: [],
    };

    // Copy structure to other languages
    SUPPORTED_LANGUAGES.filter((lang) => lang !== 'en').forEach((lang) => {
      this.menus[lang] = { ...this.menus.en };
    });
  }

  private createEmptyLabels(): Record<Language, string> {
    return SUPPORTED_LANGUAGES.reduce<Record<Language, string>>((labels, language) => {
      labels[language] = '';
      return labels;
    }, {} as Record<Language, string>);
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
