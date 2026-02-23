/**
 * AEGIS WebSocket Server
 * server/websocket.ts
 * 
 * Real-time communication layer for live updates, emergency escalations,
 * and case status notifications.
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  organizationId?: string;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private supabase: SupabaseClient;
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(httpServer: HTTPServer, supabase: SupabaseClient) {
    this.supabase = supabase;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const {
          data: { user },
          error,
        } = await this.supabase.auth.getUser(token);

        if (error || !user) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.userId = user.id;

        const { data: profile } = await this.supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          socket.userRole = profile.role;
          socket.organizationId = profile.organization_id;
        }

        next();
      } catch (err) {
        next(new Error('WebSocket authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔗 User connected: ${socket.userId} (Role: ${socket.userRole})`);

      this.trackUserConnection(socket.userId!, socket.id);

      socket.on('subscribe:cases', (data: { caseIds: string[] }) => {
        this.subscribeToCases(socket, data.caseIds);
      });

      socket.on('subscribe:alerts', () => {
        this.subscribeToAlerts(socket);
      });

      socket.on('subscribe:location', (data: { latitude: number; longitude: number }) => {
        this.subscribeToLocationUpdates(socket, data);
      });

      socket.on('escalation:acknowledge', async (data: { escalationId: string }) => {
        await this.handleEscalationAcknowledge(socket, data.escalationId);
      });

      socket.on('dispatch:update', async (data: { caseId: string; status: string }) => {
        await this.handleDispatchUpdate(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('error', (error: Error) => {
        console.error(`❌ WebSocket error for ${socket.userId}:`, error.message);
      });
    });
  }

  /**
   * Broadcast case update to subscribed clients
   */
  public broadcastCaseUpdate(caseId: string, update: any): void {
    this.io.to(`case:${caseId}`).emit('case:updated', {
      caseId,
      timestamp: new Date().toISOString(),
      ...update,
    });
  }

  /**
   * Broadcast alert to specific roles
   */
  public broadcastAlert(alert: any, targetRoles: string[]): void {
    this.io.emit('alert:new', alert, (socket: any) => {
      return targetRoles.includes(socket.userRole);
    });
  }

  /**
   * Send emergency escalation to police/admins
   */
  public broadcastEmergencyEscalation(escalation: any): void {
    this.io.emit('emergency:escalation', {
      timestamp: new Date().toISOString(),
      ...escalation,
    }, (socket: any) => {
      return ['police', 'admin'].includes(socket.userRole);
    });
  }

  /**
   * Notify counselor of new assignment
   */
  public notifyCounselorAssignment(counselorId: string, assignment: any): void {
    this.io.to(`user:${counselorId}`).emit('assignment:new', {
      timestamp: new Date().toISOString(),
      ...assignment,
    });
  }

  /**
   * Update survivor on case status
   */
  public notifySurvivorCaseUpdate(survivorId: string, caseUpdate: any): void {
    this.io.to(`user:${survivorId}`).emit('case:status', {
      timestamp: new Date().toISOString(),
      ...caseUpdate,
    });
  }

  // Private helper methods

  private subscribeToCases(socket: AuthenticatedSocket, caseIds: string[]): void {
    caseIds.forEach((caseId) => {
      socket.join(`case:${caseId}`);
    });
    console.log(`📋 User ${socket.userId} subscribed to ${caseIds.length} cases`);
  }

  private subscribeToAlerts(socket: AuthenticatedSocket): void {
    socket.join(`alerts:${socket.userRole}`);
    socket.join(`alerts:${socket.organizationId}`);
    console.log(`🔔 User ${socket.userId} subscribed to alerts`);
  }

  private subscribeToLocationUpdates(
    socket: AuthenticatedSocket,
    data: { latitude: number; longitude: number }
  ): void {
    socket.data.location = data;
    socket.join('location:live');
    console.log(`📍 User ${socket.userId} sharing location`);
  }

  private async handleEscalationAcknowledge(
    socket: AuthenticatedSocket,
    escalationId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('escalation_events')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: socket.userId,
        })
        .eq('id', escalationId);

      if (error) throw error;

      this.io.emit('escalation:acknowledged', {
        escalationId,
        acknowledgedBy: socket.userId,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Escalation ${escalationId} acknowledged by ${socket.userId}`);
    } catch (err) {
      console.error('Failed to acknowledge escalation:', err);
      socket.emit('error', { message: 'Failed to acknowledge escalation' });
    }
  }

  private async handleDispatchUpdate(
    socket: AuthenticatedSocket,
    data: { caseId: string; status: string }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('case_reports')
        .update({
          status: data.status,
          updated_at: new Date().toISOString(),
          updated_by: socket.userId,
        })
        .eq('id', data.caseId);

      if (error) throw error;

      this.broadcastCaseUpdate(data.caseId, {
        status: data.status,
        updatedBy: socket.userId,
      });

      console.log(`🚨 Dispatch updated for case ${data.caseId}: ${data.status}`);
    } catch (err) {
      console.error('Failed to update dispatch:', err);
      socket.emit('error', { message: 'Failed to update dispatch' });
    }
  }

  private trackUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.userId) {
      const userSockets = this.connectedUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(socket.userId);
        }
      }
      console.log(`❌ User disconnected: ${socket.userId}`);
    }
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }

  public getServer(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketManager;
