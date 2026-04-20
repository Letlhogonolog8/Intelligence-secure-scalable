import { SupabaseClient } from '@supabase/supabase-js';
import { AssignmentResult, GeoAssignment, GeoMatchingEngine } from '../intelligence/geoMatching';
import { RiskAssessment, RiskScoringEngine } from '../intelligence/riskScoring';
import { NotificationResult, TwilioNotificationService } from '../notifications/twilio';
import { AuditLogService } from '../security/auditLog';
import { EventBus } from '../events/eventEmitter';
import { createLogger } from '../utils/logger';

const logger = createLogger('escalation-workflow');

export interface EscalationCaseData {
  description?: string;
  region?: string;
  lat?: number;
  lng?: number;
  type?: string;
  location?: string;
  offenderId?: string;
  reportedAt?: Date | string;
  survivorPhone?: string;
  survivorName?: string;
  counselorPhone?: string;
  survivorData?: Record<string, unknown>;
}

export interface EscalationRequest {
  caseId: string;
  caseData: EscalationCaseData;
  triggeredBy: string;
  reason?: string;
}

export interface EscalationNotification {
  type: 'police_emergency' | 'counselor_assignment' | 'survivor_update' | 'ngo_coordination';
  sentAt: string;
  result?: NotificationResult;
  results?: NotificationResult[];
}

export interface EscalationResult {
  escalationId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  riskAssessment: RiskAssessment;
  assignments: AssignmentResult | null;
  notifications: EscalationNotification[];
  timestamp: string;
  completionTime?: number;
}

interface ResolvedNotificationContacts {
  policePhones: string[];
  counselorPhone?: string;
  ngoPhones: Record<string, string>;
}

interface ProfileContactRecord {
  phone?: string | null;
}

interface OrganizationContactRecord {
  phone?: string | null;
}

const DEFAULT_POLICE_CONTACTS: Record<string, string[]> = {
  ZA: ['+27114909000'],
  BW: ['+2673917911'],
  KE: ['+254800722722'],
  EU: [],
  IN: [],
};

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
   * Time-boxed risk assessment for the escalation hot path.
   * The full ML assessment is attempted first.  If it exceeds the deadline
   * (default 4 s) the fast heuristic assessment is returned immediately so
   * that notifications and geo-matching are never blocked by a slow ML call.
   * The full ML result is still computed in the background and logged.
   */
  private async timedRiskAssessment(
    request: EscalationRequest,
    deadlineMs: number = 4000
  ): Promise<RiskAssessment> {
    const mlPromise = this.riskEngine.assessCaseRisk(request.caseId, request.caseData);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), deadlineMs)
    );

    const winner = await Promise.race([mlPromise, timeoutPromise]);

    if (winner !== null) {
      return winner as RiskAssessment;
    }

    logger.warn('ML risk assessment exceeded deadline, using heuristic fallback', { caseId: request.caseId, deadlineMs });

    // Fire-and-forget: let the full ML run finish in the background for logging
    mlPromise
      .then((fullResult) => {
        logger.info('Background ML risk completed', { caseId: request.caseId, riskLevel: fullResult.riskLevel, riskScore: fullResult.riskScore });
      })
      .catch((err) => {
        logger.error('Background ML risk assessment failed', err instanceof Error ? err : undefined, { caseId: request.caseId });
      });

    return this.riskEngine.quickAssessRisk(request.caseData);
  }

  public async processEscalation(request: EscalationRequest): Promise<EscalationResult> {
    const startTime = Date.now();
    const escalationId = `esc_${Date.now()}`;

    logger.info('Starting escalation workflow', { caseId: request.caseId });

    try {
      const riskAssessment = await this.timedRiskAssessment(request);

      logger.info('Risk assessment complete', { caseId: request.caseId, riskLevel: riskAssessment.riskLevel, riskScore: riskAssessment.riskScore });

      if (!this.isEscalationRequired(riskAssessment)) {
        return {
          escalationId,
          status: 'completed',
          riskAssessment,
          assignments: null,
          notifications: [],
          timestamp: new Date().toISOString(),
          completionTime: Date.now() - startTime,
        };
      }

      const assignmentLat = request.caseData.lat ?? 0;
      const assignmentLng = request.caseData.lng ?? 0;
      const assignments = await this.geoEngine.assignResources(
        request.caseId,
        assignmentLat,
        assignmentLng,
        riskAssessment.riskLevel,
        request.caseData.type || 'gbv'
      );

      logger.info('Resources assigned', { caseId: request.caseId, resource: assignments.primary.resourceName });

      const notifications = await this.sendNotifications(
        request.caseId,
        riskAssessment,
        assignments,
        request.caseData
      );

      logger.info('Notifications sent', { caseId: request.caseId, count: notifications.length });

      await this.createEscalationEvent(
        request.caseId,
        escalationId,
        riskAssessment,
        assignments,
        request.triggeredBy,
        request.reason
      );

      await this.eventBus.emitAsync('escalation:triggered', {
        escalationId,
        caseId: request.caseId,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        primaryResource: assignments.primary.resourceId,
        timestamp: new Date().toISOString(),
      });

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
      logger.error('Escalation workflow failed', error instanceof Error ? error : undefined, { caseId: request.caseId });

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

  private isEscalationRequired(riskAssessment: RiskAssessment): boolean {
    return ['high', 'critical'].includes(riskAssessment.riskLevel);
  }

  private async sendNotifications(
    caseId: string,
    riskAssessment: RiskAssessment,
    assignments: AssignmentResult,
    caseData: EscalationCaseData
  ): Promise<EscalationNotification[]> {
    const notifications: EscalationNotification[] = [];
    const contacts = await this.resolveNotificationContacts(assignments, caseData);
    const incidentLocation = this.resolveIncidentLocation(caseData);

    try {
      if (['high', 'critical'].includes(riskAssessment.riskLevel)) {
        if (contacts.policePhones.length > 0) {
          const policeResult = await this.notificationService.sendPoliceEmergency(
            contacts.policePhones,
            caseId,
            riskAssessment.riskLevel,
            incidentLocation,
            caseData.survivorPhone
          );

          notifications.push({
            type: 'police_emergency',
            results: policeResult,
            sentAt: new Date().toISOString(),
          });
        } else {
          notifications.push({
            type: 'police_emergency',
            results: [
              {
                success: false,
                status: 'missing_recipient',
                sentAt: new Date().toISOString(),
                error: 'No police contacts resolved for escalation',
              },
            ],
            sentAt: new Date().toISOString(),
          });
        }
      }

      if (assignments.primary.resourceType === 'counselor') {
        if (contacts.counselorPhone) {
          const counselorResult = await this.notificationService.sendCounselorAssignment(
            contacts.counselorPhone,
            caseId,
            caseData.survivorName || 'Survivor',
            riskAssessment.riskLevel
          );

          notifications.push({
            type: 'counselor_assignment',
            result: counselorResult,
            sentAt: new Date().toISOString(),
          });
        } else {
          notifications.push({
            type: 'counselor_assignment',
            result: {
              success: false,
              status: 'missing_recipient',
              sentAt: new Date().toISOString(),
              error: `No counselor contact resolved for resource ${assignments.primary.resourceId}`,
            },
            sentAt: new Date().toISOString(),
          });
        }
      }

      if (caseData.survivorPhone) {
        const survivorResult = await this.notificationService.sendSurvivorUpdate(
          caseData.survivorPhone,
          caseId,
          riskAssessment.riskLevel === 'critical'
            ? 'Your case has been escalated for immediate emergency response. Stay in a safe place if possible.'
            : 'Your case has been escalated and a response team has been notified. You will be contacted shortly.'
        );

        notifications.push({
          type: 'survivor_update',
          result: survivorResult,
          sentAt: new Date().toISOString(),
        });
      }

      const ngoAssignments = [assignments.primary, ...assignments.secondary].filter(
        (assignment): assignment is GeoAssignment => assignment.resourceType === 'ngo'
      );

      for (const ngoAssignment of ngoAssignments) {
        const ngoPhone = contacts.ngoPhones[ngoAssignment.resourceId];

        if (!ngoPhone) {
          notifications.push({
            type: 'ngo_coordination',
            result: {
              success: false,
              status: 'missing_recipient',
              sentAt: new Date().toISOString(),
              error: `No NGO contact resolved for resource ${ngoAssignment.resourceId}`,
            },
            sentAt: new Date().toISOString(),
          });
          continue;
        }

        const ngoResult = await this.notificationService.sendNGONotification(
          ngoPhone,
          caseId,
          ngoAssignment.resourceName,
          riskAssessment.riskLevel
        );

        notifications.push({
          type: 'ngo_coordination',
          result: ngoResult,
          sentAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Notification send error', error instanceof Error ? error : undefined);
    }

    return notifications;
  }

  private async resolveNotificationContacts(
    assignments: AssignmentResult,
    caseData: EscalationCaseData
  ): Promise<ResolvedNotificationContacts> {
    const policePhones = this.sanitizePhoneList([
      ...this.parsePhoneList(process.env.ESCALATION_POLICE_CONTACTS),
      ...this.getRegionalPoliceContacts(),
    ]);

    let counselorPhone = this.normalizePhoneNumber(caseData.counselorPhone);
    if (!counselorPhone && assignments.primary.resourceType === 'counselor') {
      counselorPhone = await this.lookupCounselorPhone(assignments.primary.resourceId);
    }

    const ngoPhones: Record<string, string> = {};
    const ngoAssignments = [assignments.primary, ...assignments.secondary].filter(
      (assignment): assignment is GeoAssignment => assignment.resourceType === 'ngo'
    );

    for (const ngoAssignment of ngoAssignments) {
      const ngoPhone = await this.lookupOrganizationPhone(ngoAssignment.resourceId);
      if (ngoPhone) {
        ngoPhones[ngoAssignment.resourceId] = ngoPhone;
      }
    }

    return {
      policePhones,
      counselorPhone,
      ngoPhones,
    };
  }

  private async lookupCounselorPhone(resourceId: string): Promise<string | undefined> {
    try {
      const { data } = await this.supabase
        .from('profiles')
        .select('phone')
        .eq('id', resourceId)
        .maybeSingle<ProfileContactRecord>();

      return this.normalizePhoneNumber(data?.phone);
    } catch (error) {
      logger.error('Failed to resolve counselor phone', error instanceof Error ? error : undefined, { resourceId });
      return undefined;
    }
  }

  private async lookupOrganizationPhone(resourceId: string): Promise<string | undefined> {
    try {
      const { data } = await this.supabase
        .from('organizations')
        .select('phone')
        .eq('id', resourceId)
        .maybeSingle<OrganizationContactRecord>();

      return this.normalizePhoneNumber(data?.phone);
    } catch (error) {
      logger.error('Failed to resolve organization phone', error instanceof Error ? error : undefined, { resourceId });
      return undefined;
    }
  }

  private resolveIncidentLocation(caseData: EscalationCaseData): string {
    if (caseData.location) {
      return caseData.location;
    }

    if (typeof caseData.lat === 'number' && typeof caseData.lng === 'number') {
      return `${caseData.lat}, ${caseData.lng}`;
    }

    return caseData.region || 'Unspecified location';
  }

  private getCountryCode(): string {
    return (process.env.COUNTRY_CODE || process.env.VITE_COUNTRY_CODE || 'ZA').toUpperCase();
  }

  private getRegionalPoliceContacts(): string[] {
    return DEFAULT_POLICE_CONTACTS[this.getCountryCode()] || DEFAULT_POLICE_CONTACTS.ZA;
  }

  private parsePhoneList(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
  }

  private sanitizePhoneList(phoneNumbers: Array<string | undefined | null>): string[] {
    return [...new Set(phoneNumbers.map((phone) => this.normalizePhoneNumber(phone)).filter(Boolean) as string[])];
  }

  private normalizePhoneNumber(phoneNumber?: string | null): string | undefined {
    if (!phoneNumber) {
      return undefined;
    }

    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    const normalized = cleaned.startsWith('+')
      ? cleaned
      : cleaned.startsWith('00')
        ? `+${cleaned.slice(2)}`
        : /^\d+$/.test(cleaned)
          ? `+${cleaned}`
          : undefined;

    return normalized && /^\+\d{8,15}$/.test(normalized) ? normalized : undefined;
  }

  private async createEscalationEvent(
    caseId: string,
    escalationId: string,
    riskAssessment: RiskAssessment,
    assignments: AssignmentResult,
    triggeredBy: string,
    reason?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('escalation_events').insert({
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
        assignedResources: [
          assignments.primary.resourceId,
          ...assignments.secondary.map((assignment) => assignment.resourceId),
        ],
      },
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

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

      if (error) {
        throw error;
      }

      await this.eventBus.emitAsync('escalation:acknowledged', {
        escalationId,
        acknowledgedBy,
        timestamp: new Date().toISOString(),
      });

      logger.info('Escalation acknowledged', { escalationId, acknowledgedBy });
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge escalation', error instanceof Error ? error : undefined, { escalationId });
      return false;
    }
  }

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

      if (error) {
        throw error;
      }

      await this.eventBus.emitAsync('escalation:resolved', {
        escalationId,
        resolution,
        resolvedBy,
        timestamp: new Date().toISOString(),
      });

      logger.info('Escalation resolved', { escalationId });
      return true;
    } catch (error) {
      logger.error('Failed to resolve escalation', error instanceof Error ? error : undefined, { escalationId });
      return false;
    }
  }
}

export default EscalationWorkflow;
