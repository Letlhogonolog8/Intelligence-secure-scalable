/**
 * Global Deployment Configuration
 * config/globalDeployment.config.ts
 * 
 * Multi-country, multi-region deployment settings
 * for AEGIS-AI Platform
 */

export interface RegionConfig {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  country: string;
  timezone: string;
  
  // Infrastructure
  primary_provider: 'aws' | 'azure' | 'gcp';
  primary_region: string;
  failover_region?: string;
  
  // Emergency numbers
  emergency_phone: string;
  emergency_sms_shortcode: string;
  police_department_contact: string;
  
  // Law enforcement structure
  primary_police_service: string;
  police_contacts: Record<string, string>;
  
  // Language & localization
  primary_language: string;
  supported_languages: string[];
  
  // Data residency (POPIA, GDPR, etc)
  data_residency_required: boolean;
  data_residency_location: string;
  gdpr_compliant: boolean;
  
  // Performance targets
  max_latency_ms: number;
  target_uptime: number; // 99.9
  
  // Features enabled
  features: {
    ussd_gateway: boolean;
    whatsapp_integration: boolean;
    offline_mode: boolean;
    ai_processing_local: boolean;
  };
}

/**
 * GLOBAL REGIONS CONFIGURATION
 */
export const REGION_CONFIGS: Record<string, RegionConfig> = {
  // ============================================================================
  // SOUTHERN AFRICA
  // ============================================================================
  
  ZA: {
    name: 'South Africa',
    code: 'ZA',
    country: 'South Africa',
    timezone: 'Africa/Johannesburg',
    
    primary_provider: 'aws',
    primary_region: 'af-south-1', // Cape Town
    failover_region: 'eu-west-1', // Dublin
    
    emergency_phone: '+27 086 005 AEGIS', // +27 086 005 23447
    emergency_sms_shortcode: '*120*AEGIS#',
    police_department_contact: 'SAPS Crime Stop: 086 001 0111',
    
    primary_police_service: 'South African Police Service (SAPS)',
    police_contacts: {
      saps_national: '+27 11 490 9000',
      saps_emergency: '10177',
      cybercrime: '+27 10 210 0950',
    },
    
    primary_language: 'en',
    supported_languages: ['en', 'zu', 'xh', 'af', 'st', 'tn', 'ss', 've', 'nr', 'nd'],
    
    data_residency_required: true,
    data_residency_location: 'Cape Town (af-south-1)',
    gdpr_compliant: true,
    
    max_latency_ms: 100,
    target_uptime: 99.95, // Extra buffer for national platform
    
    features: {
      ussd_gateway: true,
      whatsapp_integration: true,
      offline_mode: true,
      ai_processing_local: true,
    },
  },

  BW: {
    name: 'Botswana',
    code: 'BW',
    country: 'Botswana',
    timezone: 'Africa/Gaborone',
    
    primary_provider: 'aws',
    primary_region: 'af-south-1',
    failover_region: 'eu-west-1',
    
    emergency_phone: '+267 118',
    emergency_sms_shortcode: '*145#',
    police_department_contact: 'Botswana Police: +267 391 7911',
    
    primary_police_service: 'Botswana Police Service',
    police_contacts: {
      emergency: '999',
      headquarters: '+267 391 7911',
    },
    
    primary_language: 'en',
    supported_languages: ['en', 'tn'],
    
    data_residency_required: false,
    data_residency_location: 'South Africa (regional hub)',
    gdpr_compliant: false,
    
    max_latency_ms: 200,
    target_uptime: 99.9,
    
    features: {
      ussd_gateway: true,
      whatsapp_integration: true,
      offline_mode: true,
      ai_processing_local: false,
    },
  },

  // ============================================================================
  // EAST AFRICA
  // ============================================================================
  
  KE: {
    name: 'Kenya',
    code: 'KE',
    country: 'Kenya',
    timezone: 'Africa/Nairobi',
    
    primary_provider: 'aws',
    primary_region: 'eu-west-1', // Dublin (closest)
    failover_region: 'ap-south-1', // Mumbai
    
    emergency_phone: '+254 112',
    emergency_sms_shortcode: '*999#',
    police_department_contact: 'Kenya Police: 0800 722 722',
    
    primary_police_service: 'Kenya Police Service',
    police_contacts: {
      emergency: '999',
      toll_free: '0800 722 722',
    },
    
    primary_language: 'en',
    supported_languages: ['en', 'sw'],
    
    data_residency_required: false,
    data_residency_location: 'Dubai or Dublin (regional)',
    gdpr_compliant: false,
    
    max_latency_ms: 300,
    target_uptime: 99.5,
    
    features: {
      ussd_gateway: true,
      whatsapp_integration: true,
      offline_mode: true,
      ai_processing_local: false,
    },
  },

  // ============================================================================
  // EUROPEAN UNION (GDPR)
  // ============================================================================
  
  EU: {
    name: 'European Union',
    code: 'EU',
    country: 'EU Zone',
    timezone: 'Europe/London',
    
    primary_provider: 'aws',
    primary_region: 'eu-west-1', // Dublin (Ireland)
    failover_region: 'eu-central-1', // Frankfurt
    
    emergency_phone: '112',
    emergency_sms_shortcode: 'SMS 112',
    police_department_contact: 'National Police by country',
    
    primary_police_service: 'National Police Services',
    police_contacts: {
      emergency_number: '112',
      interpol: 'International Police',
    },
    
    primary_language: 'en',
    supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl'],
    
    data_residency_required: true,
    data_residency_location: 'Europe (Dublin or Frankfurt)',
    gdpr_compliant: true,
    
    max_latency_ms: 50,
    target_uptime: 99.99,
    
    features: {
      ussd_gateway: false,
      whatsapp_integration: true,
      offline_mode: false,
      ai_processing_local: true,
    },
  },

  // ============================================================================
  // ASIA-PACIFIC
  // ============================================================================
  
  IN: {
    name: 'India',
    code: 'IN',
    country: 'India',
    timezone: 'Asia/Kolkata',
    
    primary_provider: 'aws',
    primary_region: 'ap-south-1', // Mumbai
    failover_region: 'ap-southeast-1', // Singapore
    
    emergency_phone: '100',
    emergency_sms_shortcode: '100 (via SMS)',
    police_department_contact: 'National Crime Records Bureau',
    
    primary_police_service: 'Indian Police Service',
    police_contacts: {
      emergency: '100',
      women_helpline: '181',
    },
    
    primary_language: 'en',
    supported_languages: ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu'],
    
    data_residency_required: true,
    data_residency_location: 'India (Mumbai)',
    gdpr_compliant: false,
    
    max_latency_ms: 100,
    target_uptime: 99.9,
    
    features: {
      ussd_gateway: true,
      whatsapp_integration: true,
      offline_mode: true,
      ai_processing_local: true,
    },
  },
};

/**
 * MULTI-LANGUAGE AI PROCESSING CONFIGURATION
 */
export const LANGUAGE_CONFIG: Record<string, {
  name: string;
  ai_model: string;
  nlp_provider: string;
  supports_sms: boolean;
  supports_voice: boolean;
  supports_whatsapp: boolean;
}> = {
  en: {
    name: 'English',
    ai_model: 'openai-gpt4', 
    nlp_provider: 'huggingface',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
  zu: {
    name: 'isiZulu',
    ai_model: 'openchat-3.5-zulu',
    nlp_provider: 'nlp-community-zu',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
  xh: {
    name: 'isiXhosa',
    ai_model: 'openchat-3.5-xhosa',
    nlp_provider: 'nlp-community-xh',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
  af: {
    name: 'Afrikaans',
    ai_model: 'openchat-3.5-afrikaans',
    nlp_provider: 'huggingface',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
  hi: {
    name: 'Hindi',
    ai_model: 'openai-gpt4-hindi',
    nlp_provider: 'ai4bharat',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
  sw: {
    name: 'Swahili',
    ai_model: 'openai-gpt4-swahili',
    nlp_provider: 'masakhane',
    supports_sms: true,
    supports_voice: true,
    supports_whatsapp: true,
  },
};

/**
 * Get region-specific config
 */
export function getRegionConfig(countryCode: string): RegionConfig {
  return REGION_CONFIGS[countryCode] || REGION_CONFIGS['ZA']; // Default to South Africa
}

/**
 * Get emergency number for region
 */
export function getEmergencyPhone(countryCode: string): string {
  return getRegionConfig(countryCode).emergency_phone;
}

/**
 * Get supported languages for region
 */
export function getSupportedLanguages(countryCode: string): string[] {
  return getRegionConfig(countryCode).supported_languages;
}

/**
 * Check if region requires data residency
 */
export function requiresDataResidency(countryCode: string): boolean {
  return getRegionConfig(countryCode).data_residency_required;
}

/**
 * Get AI model for language
 */
export function getAIModelForLanguage(languageCode: string): string {
  return LANGUAGE_CONFIG[languageCode]?.ai_model || LANGUAGE_CONFIG['en'].ai_model;
}

/**
 * Infrastructure as Code (Terraform variables)
 */
export const terraformConfig = {
  // Global settings
  global_tags: {
    Application: 'AEGIS-AI',
    Environment: 'Production',
    ManagedBy: 'Terraform',
    ComplianceFramework: 'POPIA,GDPR',
  },
  
  // Auto-scaling
  autoscaling: {
    min_instances: 3,
    max_instances: 100,
    target_cpu_utilization: 70,
    target_memory_utilization: 80,
  },
  
  // Load balancing
  load_balancer: {
    algorithm: 'least_connections',
    health_check_interval: 10,
    health_check_timeout: 5,
    healthy_threshold: 2,
    unhealthy_threshold: 3,
  },
  
  // Database
  database: {
    engine: 'postgresql',
    version: '14',
    backup_retention_days: 30,
    multi_az: true,
    encryption_at_rest: true,
  },
  
  // CDN
  cdn: {
    provider: 'cloudflare',
    cache_ttl_minutes: 3600,
    cache_rules: {
      '/api/*': 0, // No cache for API
      '/static/*': 31536000, // 1 year for static
      '/images/*': 86400, // 1 day for images
    },
  },
};
