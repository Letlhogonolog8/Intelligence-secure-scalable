/**
 * Compliance KPIs & Metrics
 * src/lib/compliance/metrics.ts
 *
 * Tracks Key Performance Indicators for POPIA, security, operational,
 * and impact metrics
 */

export interface ComplianceMetrics {
  popia: POPIAMetrics;
  security: SecurityMetrics;
  operational: OperationalMetrics;
  impact: ImpactMetrics;
  timestamp: Date;
}

export interface POPIAMetrics {
  registration_status: 'pending' | 'active' | 'suspended' | 'revoked';
  data_breaches_count: number;
  data_breaches_reported: number;
  subject_requests_received: number;
  subject_requests_resolved: number;
  subject_requests_avg_resolution_days: number;
  audit_findings_critical: number;
  audit_findings_major: number;
  audit_findings_minor: number;
  data_processor_agreements: number;
  privacy_impact_assessments: number;
}

export interface SecurityMetrics {
  encryption_coverage_percent: number;
  access_control_violations: number;
  security_incidents_count: number;
  security_incidents_critical: number;
  security_incidents_major: number;
  patch_deployment_days: number;
  penetration_test_findings: number;
  vulnerability_scan_findings: number;
  two_fa_adoption_percent: number;
  security_training_completion_percent: number;
}

export interface OperationalMetrics {
  system_uptime_percent: number;
  data_accuracy_percent: number;
  user_satisfaction_percent: number;
  service_delivery_percent: number;
  mean_time_to_recovery_hours: number;
  mean_time_between_failures_hours: number;
  incident_response_time_minutes: number;
  data_backup_success_percent: number;
  disaster_recovery_drills_per_year: number;
}

export interface ImpactMetrics {
  survivors_reached_annual: number;
  survivors_reached_monthly: number;
  cases_resolved_annual: number;
  cases_resolved_monthly: number;
  community_awareness_reach: number;
  service_partnerships: number;
  provinces_covered: number;
  counselor_trained: number;
  health_facilities_integrated: number;
}

export const COMPLIANCE_KPIs = {
  popia: {
    registration_status: 'Active',
    data_breaches: 0,
    data_breaches_reported: 0,
    subject_requests_response_time: '< 10 days',
    audit_findings: '0 critical',
    data_processor_agreements: 3,
    privacy_impact_assessments: 2,
  },

  security: {
    encryption_coverage: '>99%',
    access_control_violations: '0',
    security_incidents: '< 1 per quarter',
    patch_timeliness: '< 30 days',
    penetration_testing: 'Annual',
    vulnerability_scanning: 'Continuous',
    two_fa_adoption: '>95%',
    security_training: '100% annually',
  },

  operational: {
    system_uptime: '>99.9%',
    data_accuracy: '>99%',
    user_satisfaction: '>85%',
    service_delivery: '>90%',
    mttr: '< 4 hours',
    mtbf: '> 720 hours',
    incident_response: '< 30 minutes',
    backup_success: '>99.9%',
    dr_drills: '2 per year',
  },

  impact: {
    survivors_reached_annual: '> 5000',
    survivors_reached_monthly: '> 400',
    cases_resolved_annual: '> 500',
    cases_resolved_monthly: '> 40',
    community_awareness_annual: '> 50000',
    service_partnerships: '> 20',
    provinces_covered: '9 (all)',
    counselors_trained: '> 50',
    health_facilities: '> 30',
  },
};

export class ComplianceMetricsTracker {
  /**
   * Get current compliance score (0-100)
   */
  async getCurrentComplianceScore(): Promise<{
    overall: number;
    popia: number;
    security: number;
    operational: number;
  }> {
    const metrics = await this.getMetrics();

    const popiaCompliance = this.calculatePOPIAScore(metrics.popia);
    const securityCompliance = this.calculateSecurityScore(metrics.security);
    const operationalCompliance = this.calculateOperationalScore(
      metrics.operational
    );

    const overall = Math.round(
      (popiaCompliance + securityCompliance + operationalCompliance) / 3
    );

    return {
      overall,
      popia: popiaCompliance,
      security: securityCompliance,
      operational: operationalCompliance,
    };
  }

  /**
   * Calculate POPIA compliance score
   */
  private calculatePOPIAScore(metrics: POPIAMetrics): number {
    let score = 100;

    if (metrics.registration_status !== 'active') score -= 25;
    if (metrics.data_breaches_count > 0) score -= 15;
    if (!metrics.data_breaches_reported) score -= 10;
    if (metrics.audit_findings_critical > 0) score -= 20;
    if (metrics.audit_findings_major > 0) score -= 10;
    if (metrics.subject_requests_avg_resolution_days > 10) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Calculate security compliance score
   */
  private calculateSecurityScore(metrics: SecurityMetrics): number {
    let score = 100;

    if (metrics.encryption_coverage_percent < 99) score -= 15;
    if (metrics.access_control_violations > 0) score -= 20;
    if (metrics.security_incidents_critical > 0) score -= 20;
    if (metrics.security_incidents_count > 2) score -= 10;
    if (metrics.patch_deployment_days > 30) score -= 10;
    if (metrics.two_fa_adoption_percent < 95) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Calculate operational compliance score
   */
  private calculateOperationalScore(metrics: OperationalMetrics): number {
    let score = 100;

    if (metrics.system_uptime_percent < 99.9) score -= 20;
    if (metrics.data_accuracy_percent < 99) score -= 15;
    if (metrics.user_satisfaction_percent < 85) score -= 10;
    if (metrics.service_delivery_percent < 90) score -= 10;
    if (metrics.data_backup_success_percent < 99.9) score -= 15;

    return Math.max(0, score);
  }

  /**
   * Check if all critical KPIs are met
   */
  async checkCriticalKPIs(): Promise<{
    allMet: boolean;
    failures: string[];
  }> {
    const metrics = await this.getMetrics();
    const failures: string[] = [];

    if (metrics.popia.registration_status !== 'active') {
      failures.push('POPIA registration not active');
    }

    if (metrics.popia.data_breaches_count > 0 && !metrics.popia.data_breaches_reported) {
      failures.push('Data breach not reported to regulator');
    }

    if (metrics.security.encryption_coverage_percent < 99) {
      failures.push('Encryption coverage below 99%');
    }

    if (metrics.operational.system_uptime_percent < 99.9) {
      failures.push('System uptime below 99.9% SLA');
    }

    if (metrics.impact.survivors_reached_annual < 5000) {
      failures.push('Not meeting annual survivor reach target');
    }

    return {
      allMet: failures.length === 0,
      failures,
    };
  }

  /**
   * Generate compliance dashboard data
   */
  async generateDashboard(): Promise<{
    overall_score: number;
    scores: {
      popia: number;
      security: number;
      operational: number;
    };
    critical_alerts: string[];
    metrics: ComplianceMetrics;
    trend: 'improving' | 'stable' | 'declining';
  }> {
    const scores = await this.getCurrentComplianceScore();
    const kpiCheck = await this.checkCriticalKPIs();
    const metrics = await this.getMetrics();
    const trend = await this.calculateTrend(metrics);

    return {
      overall_score: scores.overall,
      scores: {
        popia: scores.popia,
        security: scores.security,
        operational: scores.operational,
      },
      critical_alerts: kpiCheck.failures,
      metrics,
      trend,
    };
  }

  /**
   * Calculate compliance trend
   */
  private async calculateTrend(
    _metrics: ComplianceMetrics
  ): Promise<'improving' | 'stable' | 'declining'> {
    return 'stable';
  }

  /**
   * Get current metrics (placeholder - replace with database query)
   */
  private async getMetrics(): Promise<ComplianceMetrics> {
    return {
      popia: {
        registration_status: 'active',
        data_breaches_count: 0,
        data_breaches_reported: 0,
        subject_requests_received: 15,
        subject_requests_resolved: 15,
        subject_requests_avg_resolution_days: 7,
        audit_findings_critical: 0,
        audit_findings_major: 2,
        audit_findings_minor: 5,
        data_processor_agreements: 3,
        privacy_impact_assessments: 2,
      },
      security: {
        encryption_coverage_percent: 99.5,
        access_control_violations: 0,
        security_incidents_count: 0,
        security_incidents_critical: 0,
        security_incidents_major: 0,
        patch_deployment_days: 15,
        penetration_test_findings: 3,
        vulnerability_scan_findings: 12,
        two_fa_adoption_percent: 97,
        security_training_completion_percent: 100,
      },
      operational: {
        system_uptime_percent: 99.95,
        data_accuracy_percent: 99.8,
        user_satisfaction_percent: 87,
        service_delivery_percent: 92,
        mean_time_to_recovery_hours: 2,
        mean_time_between_failures_hours: 850,
        incident_response_time_minutes: 15,
        data_backup_success_percent: 99.9,
        disaster_recovery_drills_per_year: 2,
      },
      impact: {
        survivors_reached_annual: 5800,
        survivors_reached_monthly: 480,
        cases_resolved_annual: 580,
        cases_resolved_monthly: 48,
        community_awareness_reach: 62000,
        service_partnerships: 25,
        provinces_covered: 9,
        counselor_trained: 65,
        health_facilities_integrated: 35,
      },
      timestamp: new Date(),
    };
  }
}

export const complianceMetricsTracker = new ComplianceMetricsTracker();
