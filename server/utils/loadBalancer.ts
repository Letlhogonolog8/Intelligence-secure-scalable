import { createLogger } from './logger';

const logger = createLogger('load-balancer');

interface ServerInstance {
  id: string;
  url: string;
  healthy: boolean;
  activeConnections: number;
  lastHealthCheck: Date;
  responseTime: number;
  weight: number;
}

interface LoadBalancerConfig {
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  maxRetries?: number;
  algorithm?: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash';
}

/**
 * Load Balancer for Horizontal Scaling
 * Distributes requests across multiple server instances
 */
export class LoadBalancer {
  private servers: Map<string, ServerInstance> = new Map();
  private currentIndex = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: Required<LoadBalancerConfig>;

  constructor(config: LoadBalancerConfig = {}) {
    this.config = {
      healthCheckInterval: config.healthCheckInterval || 30000,
      healthCheckTimeout: config.healthCheckTimeout || 5000,
      maxRetries: config.maxRetries || 3,
      algorithm: config.algorithm || 'least-connections',
    };
  }

  /**
   * Add server instance to the pool
   */
  addServer(id: string, url: string, weight = 1): void {
    this.servers.set(id, {
      id,
      url,
      healthy: true,
      activeConnections: 0,
      lastHealthCheck: new Date(),
      responseTime: 0,
      weight,
    });
    logger.info('Server added to load balancer', { id, url, weight });
  }

  /**
   * Remove server instance from the pool
   */
  removeServer(id: string): void {
    this.servers.delete(id);
    logger.info('Server removed from load balancer', { id });
  }

  /**
   * Get next available server based on algorithm
   */
  getNextServer(): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy);
    
    if (healthyServers.length === 0) {
      logger.error('No healthy servers available');
      return null;
    }

    switch (this.config.algorithm) {
      case 'round-robin':
        return this.roundRobin(healthyServers);
      case 'least-connections':
        return this.leastConnections(healthyServers);
      case 'weighted-round-robin':
        return this.weightedRoundRobin(healthyServers);
      default:
        return this.leastConnections(healthyServers);
    }
  }

  /**
   * Round-robin algorithm
   */
  private roundRobin(servers: ServerInstance[]): ServerInstance {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }

  /**
   * Least connections algorithm
   */
  private leastConnections(servers: ServerInstance[]): ServerInstance {
    return servers.reduce((min, server) => 
      server.activeConnections < min.activeConnections ? server : min
    );
  }

  /**
   * Weighted round-robin algorithm
   */
  private weightedRoundRobin(servers: ServerInstance[]): ServerInstance {
    const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) return server;
    }
    
    return servers[0];
  }

  /**
   * Increment active connections for a server
   */
  incrementConnections(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.activeConnections++;
    }
  }

  /**
   * Decrement active connections for a server
   */
  decrementConnections(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.activeConnections = Math.max(0, server.activeConnections - 1);
    }
  }

  /**
   * Update server response time
   */
  updateResponseTime(serverId: string, responseTime: number): void {
    const server = this.servers.get(serverId);
    if (server) {
      // Exponential moving average
      server.responseTime = server.responseTime === 0
        ? responseTime
        : server.responseTime * 0.7 + responseTime * 0.3;
    }
  }

  /**
   * Mark server as unhealthy
   */
  markUnhealthy(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.healthy = false;
      logger.warn('Server marked as unhealthy', { serverId });
    }
  }

  /**
   * Mark server as healthy
   */
  markHealthy(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.healthy = true;
      logger.info('Server marked as healthy', { serverId });
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    logger.info('Health checks started', { interval: this.config.healthCheckInterval });
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health checks stopped');
    }
  }

  /**
   * Perform health checks on all servers
   */
  private async performHealthChecks(): Promise<void> {
    const checks = Array.from(this.servers.values()).map(server =>
      this.checkServerHealth(server)
    );
    await Promise.allSettled(checks);
  }

  /**
   * Check individual server health
   */
  private async checkServerHealth(server: ServerInstance): Promise<void> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);

      const response = await fetch(`${server.url}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const responseTime = Date.now() - start;
        this.updateResponseTime(server.id, responseTime);
        this.markHealthy(server.id);
        server.lastHealthCheck = new Date();
      } else {
        this.markUnhealthy(server.id);
      }
    } catch (error) {
      logger.error('Health check failed', error, { serverId: server.id });
      this.markUnhealthy(server.id);
    }
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    const servers = Array.from(this.servers.values());
    return {
      totalServers: servers.length,
      healthyServers: servers.filter(s => s.healthy).length,
      unhealthyServers: servers.filter(s => !s.healthy).length,
      totalConnections: servers.reduce((sum, s) => sum + s.activeConnections, 0),
      avgResponseTime: servers.length > 0
        ? servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length
        : 0,
      servers: servers.map(s => ({
        id: s.id,
        url: s.url,
        healthy: s.healthy,
        activeConnections: s.activeConnections,
        responseTime: s.responseTime,
        weight: s.weight,
        lastHealthCheck: s.lastHealthCheck,
      })),
    };
  }

  /**
   * Shutdown load balancer
   */
  async shutdown(): Promise<void> {
    this.stopHealthChecks();
    this.servers.clear();
    logger.info('Load balancer shutdown');
  }
}

// Singleton instance
export const loadBalancer = new LoadBalancer();
