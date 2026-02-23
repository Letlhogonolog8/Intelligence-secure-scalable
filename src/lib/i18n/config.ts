/**
 * i18n Configuration for South African Languages
 * src/lib/i18n/config.ts
 *
 * Supports all 11 official South African languages
 */

export const I18N_CONFIG = {
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: {
    en: { name: 'English', nativeName: 'English', direction: 'ltr' as const },
    af: { name: 'Afrikaans', nativeName: 'Afrikaans', direction: 'ltr' as const },
    zu: { name: 'Zulu', nativeName: 'isiZulu', direction: 'ltr' as const },
    xh: { name: 'Xhosa', nativeName: 'isiXhosa', direction: 'ltr' as const },
    st: { name: 'Southern Sotho', nativeName: 'Sesotho', direction: 'ltr' as const },
    tn: { name: 'Tswana', nativeName: 'Setswana', direction: 'ltr' as const },
    ss: { name: 'Swati', nativeName: 'SiSwati', direction: 'ltr' as const },
    ve: { name: 'Venda', nativeName: 'Tshivenda', direction: 'ltr' as const },
    nr: {
      name: 'Northern Ndebele',
      nativeName: 'isiNdebele',
      direction: 'ltr' as const,
    },
    ts: { name: 'Tsonga', nativeName: 'Xitsonga', direction: 'ltr' as const },
    nd: { name: 'Southern Ndebele', nativeName: 'isiNdebele', direction: 'ltr' as const },
  },
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },
  namespaces: [
    'common',
    'auth',
    'chat',
    'admin',
    'compliance',
    'accessibility',
  ],
};

export const LANGUAGE_POPULATIONS = {
  en: { speakers: 3.6, percent_of_population: 8.2 },
  zu: { speakers: 11.6, percent_of_population: 22.7 },
  xh: { speakers: 8.2, percent_of_population: 16.0 },
  af: { speakers: 4.6, percent_of_population: 7.6 },
  st: { speakers: 3.9, percent_of_population: 7.6 },
  tn: { speakers: 4.3, percent_of_population: 8.0 },
  ss: { speakers: 0.8, percent_of_population: 2.5 },
  ve: { speakers: 0.8, percent_of_population: 1.3 },
  nr: { speakers: 0.3, percent_of_population: 0.6 },
  ts: { speakers: 0.7, percent_of_population: 1.3 },
  nd: { speakers: 0.2, percent_of_population: 0.3 },
};

export const TRANSLATION_STRINGS = {
  common: {
    en: {
      welcome: 'Welcome to AEGIS-AI',
      help: 'Help',
      settings: 'Settings',
      logout: 'Log Out',
      back: 'Back',
      next: 'Next',
      cancel: 'Cancel',
      submit: 'Submit',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Information',
    },
    af: {
      welcome: 'Welkom by AEGIS-AI',
      help: 'Hulp',
      settings: 'Instellings',
      logout: 'Teken uit',
      back: 'Terug',
      next: 'Volgende',
      cancel: 'Kanselleer',
      submit: 'Dien in',
      loading: 'Laai tans...',
      error: 'Fout',
      success: 'Sukses',
      warning: 'Waarskuwing',
      info: 'Inligting',
    },
    zu: {
      welcome: 'Sawubona ku-AEGIS-AI',
      help: 'Usizo',
      settings: 'Izilungiselelo',
      logout: 'Phuma',
      back: 'Buya',
      next: 'Okulandelayo',
      cancel: 'Khansela',
      submit: 'Thumela',
      loading: 'Ilayisha...',
      error: 'Impilo',
      success: 'Impumelelo',
      warning: 'Ibireli',
      info: 'Ulwazi',
    },
    xh: {
      welcome: 'Welkom kwi-AEGIS-AI',
      help: 'Uncedo',
      settings: 'Imigangatho',
      logout: 'Yenza ihembe',
      back: 'Buya umva',
      next: 'Okulandelayo',
      cancel: 'Khansela',
      submit: 'Thumela',
      loading: 'Ilawulayo...',
      error: 'Impazamo',
      success: 'Impumelelo',
      warning: 'Isilumkiso',
      info: 'Inkcukacha',
    },
  },

  auth: {
    en: {
      login: 'Login',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      forgotten_password: 'Forgot Password?',
      create_account: 'Create Account',
      sign_in: 'Sign In',
      support_survivor: 'Survivor Support',
      counselor_login: 'Counselor Login',
      emergency_hotline: 'Emergency Hotline',
    },
    zu: {
      login: 'Ngena',
      register: 'Bhalisa',
      email: 'I-imeyili',
      password: 'Iphasiwedi',
      forgotten_password: 'Akukhumbule iphasiwedi?',
      create_account: 'Dala i-akhaunthi',
      sign_in: 'Ngena',
      support_survivor: 'Okuthuthukisayo okusebenziswayo',
      counselor_login: 'Inkundla ye-counselor',
      emergency_hotline: 'Umncedisano-ngolwazi wengesigamu',
    },
  },

  chat: {
    en: {
      start_chat: 'Start Chat',
      end_chat: 'End Chat',
      message: 'Message',
      send: 'Send',
      type_message: 'Type your message...',
      chat_history: 'Chat History',
      safety_plan: 'Safety Plan',
      escalate: 'Escalate to Counselor',
      emergency: 'Emergency',
    },
    zu: {
      start_chat: 'Qala Ingxoxo',
      end_chat: 'Phela Ingxoxo',
      message: 'Umyalezo',
      send: 'Thumela',
      type_message: 'Bhala umyalezo wakho...',
      chat_history: 'Umlando Wegxoxo',
      safety_plan: 'Uhlelo lokuvikela',
      escalate: 'Bulela ku-Counselor',
      emergency: 'Isigamu',
    },
  },

  compliance: {
    en: {
      privacy_policy: 'Privacy Policy',
      terms_of_service: 'Terms of Service',
      data_protection: 'Data Protection',
      your_rights: 'Your Rights',
      request_data: 'Request Your Data',
      delete_account: 'Delete Account',
      gdpr_notice: 'Your data is protected under POPIA',
      consent: 'I consent to processing',
    },
    zu: {
      privacy_policy: 'Umgomo Wabuhle',
      terms_of_service: 'Imigomo Yokusebenza',
      data_protection: 'Ukuvikela Imininingwane',
      your_rights: 'Amagunya Akho',
      request_data: 'Cela Imininingwane Yakho',
      delete_account: 'Susa I-akhaunthi',
      gdpr_notice: 'Imininingwane yakho ivikelwe ngaphansi POPIA',
      consent: 'Ngiyavuma ukucutshungulwa',
    },
  },
};

export const REGIONAL_CONFIGS = {
  'Western Cape': {
    primary_language: 'af',
    secondary_languages: ['en', 'xh'],
  },
  Gauteng: {
    primary_language: 'en',
    secondary_languages: ['af', 'zu'],
  },
  'KwaZulu-Natal': {
    primary_language: 'zu',
    secondary_languages: ['en', 'xh'],
  },
  Limpopo: {
    primary_language: 'ts',
    secondary_languages: ['en', 've'],
  },
  'North West': {
    primary_language: 'tn',
    secondary_languages: ['en', 'af'],
  },
  'Eastern Cape': {
    primary_language: 'xh',
    secondary_languages: ['en', 'af'],
  },
  'Free State': {
    primary_language: 'st',
    secondary_languages: ['en', 'af'],
  },
  Mpumalanga: {
    primary_language: 'ts',
    secondary_languages: ['en', 'zu'],
  },
  'Northern Cape': {
    primary_language: 'af',
    secondary_languages: ['en', 'tn'],
  },
};

export class I18nManager {
  /**
   * Get optimal language for region
   */
  static getLanguageForRegion(
    region: string
  ): { primary: string; secondary: string[] } {
    const config = REGIONAL_CONFIGS[region as keyof typeof REGIONAL_CONFIGS];
    return (
      config || {
        primary: 'en',
        secondary: ['af', 'zu'],
      }
    );
  }

  /**
   * Detect user language preference
   */
  static detectUserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLanguage = navigator.language.split('-')[0];
    const supportedLanguages = Object.keys(I18N_CONFIG.supportedLanguages);

    if (supportedLanguages.includes(browserLanguage)) {
      return browserLanguage;
    }

    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      return savedLanguage;
    }

    return I18N_CONFIG.defaultLanguage;
  }

  /**
   * Get translation string
   */
  static getTranslation(
    namespace: string,
    key: string,
    language: string
  ): string {
    const translations = TRANSLATION_STRINGS[namespace as keyof typeof TRANSLATION_STRINGS];
    if (!translations) return key;

    const langTranslations = translations[language as keyof typeof translations];
    if (!langTranslations) {
      const enTranslations = translations['en' as keyof typeof translations];
      return enTranslations?.[key as keyof typeof enTranslations] || key;
    }

    return (
      langTranslations[key as keyof typeof langTranslations] ||
      (translations['en' as keyof typeof translations]?.[key as keyof typeof translations['en']] ||
        key)
    );
  }

  /**
   * Format date for language/region
   */
  static formatDate(date: Date, language: string): string {
    const dateFormats: Record<string, Intl.DateTimeFormatOptions> = {
      en: { year: 'numeric', month: 'long', day: 'numeric' },
      af: { year: 'numeric', month: 'long', day: 'numeric' },
      zu: { year: 'numeric', month: 'long', day: 'numeric' },
    };

    const format = dateFormats[language] || dateFormats['en'];
    return new Intl.DateTimeFormat(language, format).format(date);
  }

  /**
   * Format currency for South Africa (ZAR)
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  }

  /**
   * Get text direction for language
   */
  static getTextDirection(language: string): 'ltr' | 'rtl' {
    const langConfig = I18N_CONFIG.supportedLanguages[language as keyof typeof I18N_CONFIG.supportedLanguages];
    return (langConfig?.direction as 'ltr' | 'rtl') || 'ltr';
  }
}

export const i18nManager = I18nManager;
