/**
 * POPIA Principle 5: Data Quality Audit Module
 * src/lib/popia/dataQuality.ts
 *
 * Ensures personal information is accurate, complete, and up-to-date
 * Implements quarterly audits per POPIA requirements
 */

import { createClient } from '@supabase/supabase-js';

export interface DataQualityCheckResult {
  timestamp: Date;
  field: string;
  accuracy: number;
  completeness: number;
  timeliness: number;
  status: 'pass' | 'warning' | 'fail';
  details?: string;
}

export interface AuditReport {
  auditDate: Date;
  totalRecordsChecked: number;
  results: DataQualityCheckResult[];
  overallScore: number;
  recommendations: string[];
}

export class DataQualityAudit {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY
  );

  /**
   * Run comprehensive data quality audit
   */
  async auditDataQuality(): Promise<AuditReport> {
    const survivors = await this.supabase
      .from('survivors')
      .select('*');

    if (!survivors.data) {
      throw new Error('Failed to fetch survivor data for audit');
    }

    const results: DataQualityCheckResult[] = [];
    const timestamps: number[] = [];

    for (const survivor of survivors.data) {
      const completeness = this.calculateCompleteness(survivor);
      const timeliness = this.checkTimeliness(survivor.updated_at);
      const accuracy = await this.verifyAccuracy(survivor);

      const result: DataQualityCheckResult = {
        timestamp: new Date(),
        field: 'survivors',
        accuracy,
        completeness,
        timeliness,
        status: this.determineStatus(accuracy, completeness, timeliness),
        details: `Record ID: ${survivor.id}`,
      };

      results.push(result);
      timestamps.push(accuracy * completeness * timeliness);
    }

    const overallScore = this.calculateAverageScore(timestamps);
    const recommendations = this.generateRecommendations(results);

    const report: AuditReport = {
      auditDate: new Date(),
      totalRecordsChecked: survivors.data.length,
      results,
      overallScore,
      recommendations,
    };

    await this.logAuditReport(report);
    return report;
  }

  /**
   * Calculate data completeness percentage
   */
  private calculateCompleteness(record: Record<string, unknown>): number {
    const requiredFields = [
      'user_id',
      'created_at',
      'updated_at',
      'region',
    ];

    const presentFields = requiredFields.filter(
      (field) => record[field] !== null && record[field] !== undefined
    );

    return (presentFields.length / requiredFields.length) * 100;
  }

  /**
   * Check data timeliness (how recent the data is)
   */
  private checkTimeliness(updatedAt: string): number {
    const lastUpdate = new Date(updatedAt);
    const now = new Date();
    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate <= 30) {
      return 100;
    } else if (daysSinceUpdate <= 90) {
      return 80;
    } else if (daysSinceUpdate <= 365) {
      return 50;
    } else {
      return 0;
    }
  }

  /**
   * Verify data accuracy through cross-checks
   */
  private async verifyAccuracy(survivor: Record<string, unknown>): Promise<number> {
    try {
      const user = await this.supabase
        .from('auth.users')
        .select('id')
        .eq('id', survivor.user_id)
        .single();

      if (user.data) {
        return 95;
      }
      return 50;
    } catch {
      return 50;
    }
  }

  /**
   * Determine overall status based on metrics
   */
  private determineStatus(
    accuracy: number,
    completeness: number,
    timeliness: number
  ): 'pass' | 'warning' | 'fail' {
    const average = (accuracy + completeness + timeliness) / 3;

    if (average >= 80) {
      return 'pass';
    } else if (average >= 60) {
      return 'warning';
    } else {
      return 'fail';
    }
  }

  /**
   * Calculate average quality score
   */
  private calculateAverageScore(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round((sum / scores.length) * 100) / 100;
  }

  /**
   * Generate recommendations based on audit results
   */
  private generateRecommendations(results: DataQualityCheckResult[]): string[] {
    const recommendations: string[] = [];
    const failures = results.filter((r) => r.status === 'fail');
    const warnings = results.filter((r) => r.status === 'warning');

    if (failures.length > 0) {
      recommendations.push(
        `${failures.length} records have critical quality issues requiring immediate correction`
      );
    }

    if (warnings.length > 0) {
      recommendations.push(
        `${warnings.length} records need data updates or verification`
      );
    }

    const staleRecords = results.filter((r) => r.timeliness < 50);
    if (staleRecords.length > 0) {
      recommendations.push(
        `Update ${staleRecords.length} records that have not been reviewed in over 90 days`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All data quality metrics are within acceptable ranges');
    }

    return recommendations;
  }

  /**
   * Log audit report to audit trail
   */
  private async logAuditReport(report: AuditReport): Promise<void> {
    await this.supabase.from('audit_log').insert({
      table_name: 'data_quality_audit',
      operation: 'AUDIT',
      record_id: crypto.randomUUID(),
      changed_fields: {
        overall_score: report.overallScore,
        records_checked: report.totalRecordsChecked,
        passed: report.results.filter((r) => r.status === 'pass').length,
        warned: report.results.filter((r) => r.status === 'warning').length,
        failed: report.results.filter((r) => r.status === 'fail').length,
      },
      changed_by: (await this.supabase.auth.getUser()).data.user?.id,
      changed_at: new Date().toISOString(),
    });
  }
}

export const dataQualityAudit = new DataQualityAudit();
