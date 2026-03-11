import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  organizationId?: string;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private supabase: SupabaseClient;
  private connectedUsers: Map<string, Set<string>> = new Map();
  private adapterPubClient: RedisClientType | null = null;
  private adapterSubClient: RedisClientType | null = null;
  private adapterEnabled = false;

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

  public async initializeScaling(): Promise<void> {
    const redisUrl = this.resolveRedisUrl();

    if (!redisUrl) {
      console.warn('⚠️  Redis not configured for WebSocket scaling. Using local Socket.IO adapter.');
      this.adapterEnabled = false;
      return;
    }

    try {
      this.adapterPubClient = createClient({ url: redisUrl });
      this.adapterSubClient = this.adapterPubClient.duplicate();

      this.adapterPubClient.on('error', (error) => {
        this.adapterEnabled = false;
        console.error('❌ WebSocket Redis pub client error:', error);
      });

      this.adapterSubClient.on('error', (error) => {
        this.adapterEnabled = false;
        console.error('❌ WebSocket Redis sub client error:', error);
      });

      await Promise.all([this.adapterPubClient.connect(), this.adapterSubClient.connect()]);
      this.io.adapter(createAdapter(this.adapterPubClient, this.adapterSubClient));
      this.adapterEnabled = true;

      console.log('✅ WebSocket Redis adapter enabled for multi-instance delivery');
    } catch (error) {
      this.adapterEnabled = false;
      console.warn('⚠️  Failed to initialize WebSocket Redis adapter. Falling back to local delivery.', error);
      await this.closeAdapterClients();
    }
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
      } catch (_err) {
        next(new Error('WebSocket authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔗 User connected: ${socket.userId} (Role: ${socket.userRole})`);

      this.trackUserConnection(socket.userId!, socket.id);
      this.joinScopedRooms(socket);

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

  public broadcastCaseUpdate(caseId: string, update: Record<string, unknown>): void {
    this.io.to(`case:${caseId}`).emit('case:updated', {
      caseId,
      timestamp: new Date().toISOString(),
      ...update,
    });
  }

  public broadcastAlert(alert: Record<string, unknown>, targetRoles: string[]): void {
    const payload = {
      timestamp: new Date().toISOString(),
      ...alert,
    };

    this.emitToRoles('alert:new', payload, targetRoles, {
      includeAlertRooms: true,
    });
  }

  public broadcastEmergencyEscalation(escalation: Record<string, unknown>): void {
    this.emitToRoles('emergency:escalation', {
      timestamp: new Date().toISOString(),
      ...escalation,
    }, ['police', 'admin']);
  }

  public notifyCounselorAssignment(counselorId: string, assignment: Record<string, unknown>): void {
    this.io.to(`user:${counselorId}`).emit('assignment:new', {
      timestamp: new Date().toISOString(),
      ...assignment,
    });
  }

  public notifySurvivorCaseUpdate(survivorId: string, caseUpdate: Record<string, unknown>): void {
    this.io.to(`user:${survivorId}`).emit('case:status', {
      timestamp: new Date().toISOString(),
      ...caseUpdate,
    });
  }

  private subscribeToCases(socket: AuthenticatedSocket, caseIds: string[]): void {
    caseIds.forEach((caseId) => {
      socket.join(`case:${caseId}`);
    });
    console.log(`📋 User ${socket.userId} subscribed to ${caseIds.length} cases`);
  }

  private subscribeToAlerts(socket: AuthenticatedSocket): void {
    if (socket.userRole) {
      socket.join(`alerts:${socket.userRole}`);
    }
    if (socket.organizationId) {
      socket.join(`alerts:${socket.organizationId}`);
    }
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

  private joinScopedRooms(socket: AuthenticatedSocket): void {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
      socket.join(`alerts:${socket.userRole}`);
    }

    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      socket.join(`alerts:${socket.organizationId}`);
    }
  }

  private emitToRoles(
    event: string,
    payload: unknown,
    targetRoles: string[],
    options?: { includeAlertRooms?: boolean }
  ): void {
    const uniqueRoles = [...new Set(targetRoles.filter(Boolean))];

    uniqueRoles.forEach((role) => {
      this.io.to(`role:${role}`).emit(event, payload);

      if (options?.includeAlertRooms) {
        this.io.to(`alerts:${role}`).emit(event, payload);
      }
    });
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

  private resolveRedisUrl(): string | null {
    if (process.env.REDIS_URL) {
      return process.env.REDIS_URL;
    }

    if (!process.env.REDIS_HOST) {
      return null;
    }

    const protocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
    const credentials = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
    const port = process.env.REDIS_PORT || '6379';

    return `${protocol}://${credentials}${process.env.REDIS_HOST}:${port}`;
  }

  private async closeAdapterClients(): Promise<void> {
    const clients = [this.adapterPubClient, this.adapterSubClient].filter(
      (client): client is RedisClientType => Boolean(client)
    );

    await Promise.allSettled(
      clients.map(async (client) => {
        if (client.isOpen) {
          await client.quit();
        }
      })
    );

    this.adapterPubClient = null;
    this.adapterSubClient = null;
    this.adapterEnabled = false;
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }

  public getHealthStatus(): {
    adapter: 'redis' | 'local';
    adapterReady: boolean;
    redisConfigured: boolean;
    socketCount: number;
    userCount: number;
  } {
    return {
      adapter: this.adapterEnabled ? 'redis' : 'local',
      adapterReady: this.adapterEnabled,
      redisConfigured: Boolean(this.resolveRedisUrl()),
      socketCount: this.io.engine.clientsCount,
      userCount: this.connectedUsers.size,
    };
  }

  public getServer(): SocketIOServer {
    return this.io;
  }

  public async shutdown(): Promise<void> {
    await this.closeAdapterClients();
    await new Promise<void>((resolve) => {
      this.io.close(() => resolve());
    });
  }
}

export default WebSocketManager;
