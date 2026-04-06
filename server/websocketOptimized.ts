import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { cacheManager } from '../utils/cacheManager';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  organizationId?: string;
}

interface CachedAuth {
  userId: string;
  role?: string;
  organizationId?: string;
}

interface MessageBatch {
  event: string;
  payload: unknown;
  rooms: string[];
  timestamp: number;
}

export class WebSocketManagerOptimized {
  private io: SocketIOServer;
  private supabase: SupabaseClient;
  private connectedUsers: Map<string, Set<string>> = new Map();
  private adapterPubClient: RedisClientType | null = null;
  private adapterSubClient: RedisClientType | null = null;
  private adapterEnabled = false;
  private messageBatch: MessageBatch[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 50;
  private readonly AUTH_CACHE_TTL = 300;

  constructor(httpServer: HTTPServer, supabase: SupabaseClient) {
    this.supabase = supabase;
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('WebSocket CORS policy violation'));
          }
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 20000,
      maxHttpBufferSize: 1e6,
      perMessageDeflate: {
        threshold: 1024,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startMessageBatching();
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

        const cached = await this.getCachedAuth(token);
        if (cached) {
          socket.userId = cached.userId;
          socket.userRole = cached.role;
          socket.organizationId = cached.organizationId;
          return next();
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
          .maybeSingle();

        if (profile) {
          socket.userRole = profile.role;
          socket.organizationId = profile.organization_id;
        }

        await this.cacheAuth(token, {
          userId: user.id,
          role: profile?.role,
          organizationId: profile?.organization_id,
        });

        next();
      } catch (_err) {
        next(new Error('WebSocket authentication failed'));
      }
    });
  }

  private async getCachedAuth(token: string): Promise<CachedAuth | null> {
    const key = `ws:auth:${this.hashToken(token)}`;
    return await cacheManager.get<CachedAuth>(key);
  }

  private async cacheAuth(token: string, auth: CachedAuth): Promise<void> {
    const key = `ws:auth:${this.hashToken(token)}`;
    await cacheManager.set(key, auth, { ttl: this.AUTH_CACHE_TTL });
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
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

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('error', (error: Error) => {
        console.error(`❌ WebSocket error for ${socket.userId}:`, error.message);
      });
    });
  }

  private startMessageBatching(): void {
    this.batchInterval = setInterval(() => {
      this.flushMessageBatch();
    }, this.BATCH_INTERVAL_MS);
  }

  private flushMessageBatch(): void {
    if (this.messageBatch.length === 0) return;

    const batch = [...this.messageBatch];
    this.messageBatch = [];

    const grouped = new Map<string, MessageBatch[]>();
    batch.forEach(msg => {
      const key = `${msg.event}:${msg.rooms.join(',')}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(msg);
    });

    grouped.forEach((messages, key) => {
      const [event, roomsStr] = key.split(':');
      const rooms = roomsStr.split(',');
      
      if (messages.length === 1) {
        rooms.forEach(room => this.io.to(room).emit(event, messages[0].payload));
      } else {
        const payloads = messages.map(m => m.payload);
        rooms.forEach(room => this.io.to(room).emit(`${event}:batch`, payloads));
      }
    });
  }

  public broadcastCaseUpdate(caseId: string, update: Record<string, unknown>): void {
    this.messageBatch.push({
      event: 'case:updated',
      payload: { caseId, timestamp: new Date().toISOString(), ...update },
      rooms: [`case:${caseId}`],
      timestamp: Date.now(),
    });
  }

  public broadcastAlert(alert: Record<string, unknown>, targetRoles: string[]): void {
    const rooms = targetRoles.flatMap(role => [`role:${role}`, `alerts:${role}`]);
    this.messageBatch.push({
      event: 'alert:new',
      payload: { timestamp: new Date().toISOString(), ...alert },
      rooms,
      timestamp: Date.now(),
    });
  }

  private subscribeToCases(socket: AuthenticatedSocket, caseIds: string[]): void {
    caseIds.forEach((caseId) => {
      socket.join(`case:${caseId}`);
    });
    console.log(`📋 User ${socket.userId} subscribed to ${caseIds.length} cases`);
  }

  private subscribeToAlerts(socket: AuthenticatedSocket): void {
    if (socket.userRole) socket.join(`alerts:${socket.userRole}`);
    if (socket.organizationId) socket.join(`alerts:${socket.organizationId}`);
    console.log(`🔔 User ${socket.userId} subscribed to alerts`);
  }

  private trackUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private joinScopedRooms(socket: AuthenticatedSocket): void {
    if (socket.userId) socket.join(`user:${socket.userId}`);
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
      socket.join(`alerts:${socket.userRole}`);
    }
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      socket.join(`alerts:${socket.organizationId}`);
    }
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
    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    if (!process.env.REDIS_HOST) return null;

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
        if (client.isOpen) await client.quit();
      })
    );

    this.adapterPubClient = null;
    this.adapterSubClient = null;
    this.adapterEnabled = false;
  }

  public getHealthStatus() {
    return {
      adapter: this.adapterEnabled ? 'redis' : 'local',
      adapterReady: this.adapterEnabled,
      redisConfigured: Boolean(this.resolveRedisUrl()),
      socketCount: this.io.engine.clientsCount,
      userCount: this.connectedUsers.size,
      batchQueueSize: this.messageBatch.length,
    };
  }

  public async shutdown(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    this.flushMessageBatch();
    await this.closeAdapterClients();
    await new Promise<void>((resolve) => {
      this.io.close(() => resolve());
    });
  }
}
