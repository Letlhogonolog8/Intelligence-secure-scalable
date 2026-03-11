/**
 * Global Deployment Configuration
 * config/globalDeployment.config.ts
 *
 * Multi-country, multi-region deployment settings
 * for AEGIS-AI Platform
 */
export interface RegionConfig {
    name: string;
    code: string;
    country: string;
    timezone: string;
    primary_provider: 'aws' | 'azure' | 'gcp';
    primary_region: string;
    failover_region?: string;
    emergency_phone: string;
    emergency_sms_shortcode: string;
    police_department_contact: string;
    primary_police_service: string;
    police_contacts: Record<string, string>;
    primary_language: string;
    supported_languages: string[];
    data_residency_required: boolean;
    data_residency_location: string;
    gdpr_compliant: boolean;
    max_latency_ms: number;
    target_uptime: number;
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
export declare const REGION_CONFIGS: Record<string, RegionConfig>;
/**
 * MULTI-LANGUAGE AI PROCESSING CONFIGURATION
 */
export declare const LANGUAGE_CONFIG: Record<string, {
    name: string;
    ai_model: string;
    nlp_provider: string;
    supports_sms: boolean;
    supports_voice: boolean;
    supports_whatsapp: boolean;
}>;
/**
 * Get region-specific config
 */
export declare function getRegionConfig(countryCode: string): RegionConfig;
/**
 * Get emergency number for region
 */
export declare function getEmergencyPhone(countryCode: string): string;
/**
 * Get supported languages for region
 */
export declare function getSupportedLanguages(countryCode: string): string[];
/**
 * Check if region requires data residency
 */
export declare function requiresDataResidency(countryCode: string): boolean;
/**
 * Get AI model for language
 */
export declare function getAIModelForLanguage(languageCode: string): string;
/**
 * Infrastructure as Code (Terraform variables)
 */
export declare const terraformConfig: {
    global_tags: {
        Application: string;
        Environment: string;
        ManagedBy: string;
        ComplianceFramework: string;
    };
    autoscaling: {
        min_instances: number;
        max_instances: number;
        target_cpu_utilization: number;
        target_memory_utilization: number;
    };
    load_balancer: {
        algorithm: string;
        health_check_interval: number;
        health_check_timeout: number;
        healthy_threshold: number;
        unhealthy_threshold: number;
    };
    database: {
        engine: string;
        version: string;
        backup_retention_days: number;
        multi_az: boolean;
        encryption_at_rest: boolean;
    };
    cdn: {
        provider: string;
        cache_ttl_minutes: number;
        cache_rules: {
            '/api/*': number;
            '/static/*': number;
            '/images/*': number;
        };
    };
};
//# sourceMappingURL=globalDeployment.config.d.ts.map