/**
 * AEGIS Escalation Workflow Engine
 * server/workflows/escalationWorkflow.ts
 * 
 * Orchestrates the complete emergency escalation process:
 * 1. Case creation/update trigger
 * 2. Risk assessment
 * 3. Resource assignment (geo-matching)
 * 4. Multi-channel notifications
 * 5. Status tracking
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { RiskScoringEngine } from '../intelligence/riskScoring';
import { GeoMatchingEngine } from '../intelligence/geoMatching';
import { TwilioNotificationService } from '../notifications/twilio';
import { AuditLogService } from '../security/auditLog';
import { EventBus } from '../events/eventEmitter';

export interface EscalationRequest {
  caseId: string;
  caseData: any;
  triggeredBy: string;
  reason?: string;
}

export interface EscalationResult {
  escalationId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  riskAssessment: any;
  assignments: any;
  notifications: any[];
  timestamp: string;
  completionTime?: number;
}

export class EscalationWorkflow {
  private supabase: SupabaseClient;
  private riskEngine: RiskScoringEngine;
  private geoEngine: GeoMatchingEngine;
  private notificationService: TwilioNotificationService;
  private auditLog: AuditLogService;
  private eventBus: EventBus;

  constructor(
    supabase: SupabaseClient,
    riskEngine: RiskScoringEngine,
    geoEngine: GeoMatchingEngine,
    notificationService: TwilioNotificationService,
    auditLog: AuditLogService,
    eventBus: EventBus
  ) {
    this.supabase = supabase;
    this.riskEngine = riskEngine;
    this.geoEngine = geoEngine;
    this.notificationService = notificationService;
    this.auditLog = auditLog;
    this.eventBus = eventBus;
  }

  /**
   * Execute full escalation workflow
   */
  public async processEscalation(request: EscalationRequest): Promise<EscalationResult> {
    const startTime = Date.now();
    const escalationId = `esc_${Date.now()}`;

    console.log(`🚨 Starting escalation workflow for case ${request.caseId}`);

    try {
      // Step 1: Risk Assessment
      const riskAssessment = await this.riskEngine.assessCaseRisk(
        request.caseId,
        request.caseData
      );

      console.log(`✅ Risk assessment: ${riskAssessment.riskLevel} (${riskAssessment.riskScore})`);

      // Step 2: Check if escalation is warranted
      if (!this.isEscalationRequired(riskAssessment)) {
        return {
          escalationId,
          status: 'completed',
          riskAssessment,
          assignments: [],
          notifications: [],
          timestamp: new Date().toISOString(),
          completionTime: Date.now() - startTime,
        };
      }

      // Step 3: Resource Assignment
      const { lat, lng } = request.caseData;
      const assignments = await this.geoEngine.assignResources(
        request.caseId,
        lat,
        lng,
        riskAssessment.riskLevel,
        request.caseData.type || 'gbv'
      );

      console.log(`✅ Resources assigned: ${assignments.primary.resourceName}`);

      // Step 4: Send Notifications
      const notifications = await this.sendNotifications(
        request.caseId,
        riskAssessment,
        assignments,
        request.caseData
      );

      console.log(`✅ Notifications sent: ${notifications.length}`);

      // Step 5: Create escalation event
      const escalationEvent = await this.createEscalationEvent(
        request.caseId,
        escalationId,
        riskAssessment,
        assignments,
        request.triggeredBy,
        request.reason
      );

      // Step 6: Emit event for real-time updates
      await this.eventBus.emitAsync('escalation:triggered', {
        escalationId,
        caseId: request.caseId,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        primaryResource: assignments.primary.resourceId,
        timestamp: new Date().toISOString(),
      });

      // Step 7: Log action
      await this.auditLog.log({
        userId: request.triggeredBy,
        action: 'escalation_processed',
        module: 'escalation',
        resourceId: request.caseId,
        resourceType: 'case',
        status: 'success',
        ipAddress: '',
        userAgent: '',
        metadata: {
          escalationId,
          riskLevel: riskAssessment.riskLevel,
          riskScore: riskAssessment.riskScore,
          notificationCount: notifications.length,
        },
        timestamp: new Date().toISOString(),
      });

      return {
        escalationId,
        status: 'completed',
        riskAssessment,
        assignments,
        notifications,
        timestamp: new Date().toISOString(),
        completionTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('❌ Escalation workflow failed:', error);

      // Log failure
      await this.auditLog.log({
        userId: request.triggeredBy,
        action: 'escalation_failed',
        module: 'escalation',
        resourceId: request.caseId,
        resourceType: 'case',
        status: 'failure',
        ipAddress: '',
        userAgent: '',
        metadata: {
          escalationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Check if escalation is required based on risk
   */
  private isEscalationRequired(riskAssessment: any): boolean {
    // Escalate if risk level is high or critical
    return ['high', 'critical'].includes(riskAssessment.riskLevel);
  }

  /**
   * Send notifications to all relevant parties
   */
  private async sendNotifications(
    caseId: string,
    riskAssessment: any,
    assignments: any,
    caseData: any
  ): Promise<any[]> {
    const notifications: any[] = [];

    try {
      // 1. Emergency alert to police (if high/critical)
      if (['high', 'critical'].includes(riskAssessment.riskLevel)) {
        const policeResult = await this.notificationService.sendPoliceEmergency(
          ['+27123456789'], // Would be fetched from assignments.primary.phoneNumbers
          caseId,
          riskAssessment.riskLevel,
          caseData.location || 'TBD',
          caseData.survivorPhone
        );

        notifications.push({
          type: 'police_emergency',
          results: policeResult,
          sentAt: new Date().toISOString(),
        });
      }

      // 2. Counselor assignment
      if (assignments.primary.resourceType === 'counselor') {
        const counselorResult = await this.notificationService.sendCounselorAssignment(
          caseData.counselorPhone || '+27123456789',
          caseId,
          caseData.survivorName || 'Survivor',
          riskAssessment.riskLevel
        );

        notifications.push({
          type: 'counselor_assignment',
          result: counselorResult,
          sentAt: new Date().toISOString(),
        });
      }

      // 3. Survivor notification (if appropriate)
      if (riskAssessment.riskLevel === 'medium') {
        const survivorResult = await this.notificationService.sendSurvivorUpdate(
          caseData.survivorPhone,
          caseId,
          'A counselor has been assigned to your case. They will contact you shortly.'
        );

        notifications.push({
          type: 'survivor_update',
          result: survivorResult,
          sentAt: new Date().toISOString(),
        });
      }

      // 4. NGO coordination
      if (assignments.secondary.length > 0) {
        for (const secondary of assignments.secondary) {
          if (secondary.resourceType === 'ngo') {
            const ngoResult = await this.notificationService.sendNGONotification(
              secondary.contactPhone || '+27123456789',
              caseId,
              'Shelter/Support',
              riskAssessment.riskLevel
            );

            notifications.push({
              type: 'ngo_coordination',
              result: ngoResult,
              sentAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Notification send error:', error);
    }

    return notifications;
  }

  /**
   * Create escalation event record
   */
  private async createEscalationEvent(
    caseId: string,
    escalationId: string,
    riskAssessment: any,
    assignments: any,
    triggeredBy: string,
    reason?: string
  ): Promise<any> {
    const { data, error } = await this.supabase.from('escalation_events').insert({
      id: escalationId,
      case_id: caseId,
      triggered_by: triggeredBy,
      severity: riskAssessment.riskLevel,
      reason,
      status: 'pending',
      assigned_to: assignments.primary.resourceId,
      metadata: {
        riskScore: riskAssessment.riskScore,
        confidence: riskAssessment.confidence,
        factors: riskAssessment.factors,
        assignedResources: [assignments.primary.resourceId, ...assignments.secondary.map((a: any) => a.resourceId)],
      },
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return data;
  }

  /**
   * Handle escalation acknowledgment
   */
  public async acknowledgeEscalation(
    escalationId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('escalation_events')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: acknowledgedBy,
          status: 'acknowledged',
        })
        .eq('id', escalationId);

      if (error) throw error;

      // Emit acknowledgment event
      await this.eventBus.emitAsync('escalation:acknowledged', {
        escalationId,
        acknowledgedBy,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Escalation ${escalationId} acknowledged by ${acknowledgedBy}`);
      return true;
    } catch (error) {
      console.error('Failed to acknowledge escalation:', error);
      return false;
    }
  }

  /**
   * Resolve escalation
   */
  public async resolveEscalation(
    escalationId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('escalation_events')
        .update({
          resolved_at: new Date().toISOString(),
          status: 'resolved',
          metadata: { resolution },
        })
        .eq('id', escalationId);

      if (error) throw error;

      await this.eventBus.emitAsync('escalation:resolved', {
        escalationId,
        resolution,
        resolvedBy,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Escalation ${escalationId} resolved`);
      return true;
    } catch (error) {
      console.error('Failed to resolve escalation:', error);
      return false;
    }
  }
}

export default EscalationWorkflow;
