/**
 * AEGIS Event Emitter
 * server/events/eventEmitter.ts
 * 
 * Event-driven architecture for case workflows, escalations, and notifications.
 * Implements pub/sub pattern for asynchronous event handling.
 */

import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';

export type EventType =
  | 'case:created'
  | 'case:updated'
  | 'case:escalated'
  | 'case:resolved'
  | 'alert:generated'
  | 'escalation:triggered'
  | 'escalation_triggered'
  | 'escalation:acknowledged'
  | 'escalation:resolved'
  | 'notification:sent'
  | 'risk:scored'
  | 'geo:matched'
  | 'dispatch:created'
  | 'dispatch:updated';

export interface AegisEvent {
  type: EventType;
  timestamp: string;
  userId?: string;
  data: Record<string, any>;
  metadata?: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    retryable: boolean;
    idempotencyKey?: string;
  };
}

export class EventBus {
  private supabase: SupabaseClient;
  private emitter: EventEmitter;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Emit an event with automatic persistence
   */
  public async emitAsync(eventType: EventType, data: any, metadata?: AegisEvent['metadata']): Promise<void> {
    const event: AegisEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      userId: data.userId,
      data,
      metadata: {
        priority: data.priority || 'medium',
        retryable: data.retryable !== false,
        idempotencyKey: data.idempotencyKey || `${eventType}-${Date.now()}`,
        ...metadata,
      },
    };

    try {
      await this.persistEvent(event);
      this.emitter.emit(eventType, event);
      console.log(`📤 Event emitted: ${eventType}`);
    } catch (error) {
      console.error(`❌ Failed to emit event ${eventType}:`, error);
    }
  }

  /**
   * Register event handler
   */
  public on(eventType: EventType, handler: (event: AegisEvent) => Promise<void>): void {
    this.emitter.on(eventType, async (event: AegisEvent) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error handling ${eventType}:`, error);

        if (event.metadata?.retryable) {
          this.scheduleRetry(event);
        }
      }
    });
  }

  /**
   * Register one-time event handler
   */
  public once(eventType: EventType, handler: (event: AegisEvent) => Promise<void>): void {
    this.emitter.once(eventType, async (event: AegisEvent) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error handling ${eventType} (one-time):`, error);
      }
    });
  }

  /**
   * Persist event to database for audit trail
   */
  private async persistEvent(event: AegisEvent): Promise<void> {
    try {
      const { error } = await this.supabase.from('events_log').insert({
        event_type: event.type,
        user_id: event.userId,
        data: event.data,
        metadata: event.metadata,
        created_at: event.timestamp,
        idempotency_key: event.metadata?.idempotencyKey,
      });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to persist event:', err);
      throw err;
    }
  }

  /**
   * Schedule event retry with exponential backoff
   */
  private scheduleRetry(event: AegisEvent, attemptNumber: number = 1): void {
    const maxRetries = 3;
    const baseDelay = 5000;
    const delay = baseDelay * Math.pow(2, attemptNumber - 1);

    if (attemptNumber > maxRetries) {
      console.error(`❌ Event ${event.type} failed after ${maxRetries} retries`);
      return;
    }

    setTimeout(() => {
      console.log(`🔄 Retrying event ${event.type} (attempt ${attemptNumber})`);
      this.emitter.emit(event.type, event);
    }, delay);
  }

  /**
   * Query event history
   */
  public async getEventHistory(
    eventType: EventType,
    limit: number = 100,
    offset: number = 0
  ): Promise<AegisEvent[]> {
    const { data, error } = await this.supabase
      .from('events_log')
      .select('*')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      type: row.event_type as EventType,
      timestamp: row.created_at,
      userId: row.user_id,
      data: row.data,
      metadata: row.metadata,
    }));
  }

  /**
   * Clear old events (retention policy)
   */
  public async cleanupOldEvents(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error } = await this.supabase
      .from('events_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
    console.log(`🧹 Cleaned up events older than ${daysToKeep} days`);
  }

  /**
   * Get event statistics
   */
  public async getEventStats(): Promise<Record<EventType, number>> {
    const { data, error } = await this.supabase
      .from('events_log')
      .select('event_type')
      .then(({ data }) => {
        const stats: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          stats[row.event_type] = (stats[row.event_type] || 0) + 1;
        });
        return { data: stats, error: null };
      });

    if (error) throw error;
    return data as Record<EventType, number>;
  }
}

export default EventBus;
