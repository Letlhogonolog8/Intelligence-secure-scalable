import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoadBalancer } from '../../../server/utils/loadBalancer';

describe('LoadBalancer', () => {
  let balancer: LoadBalancer;

  beforeEach(() => {
    balancer = new LoadBalancer({
      healthCheckInterval: 5000,
      healthCheckTimeout: 2000,
      maxRetries: 3,
      algorithm: 'least-connections',
    });
  });

  afterEach(() => {
    balancer.shutdown();
  });

  it('should add server to pool', () => {
    balancer.addServer('server-1', 'http://localhost:3001', 1);
    const stats = balancer.getStats();

    expect(stats.totalServers).toBe(1);
    expect(stats.servers[0].id).toBe('server-1');
    expect(stats.servers[0].url).toBe('http://localhost:3001');
  });

  it('should remove server from pool', () => {
    balancer.addServer('server-1', 'http://localhost:3001');
    balancer.removeServer('server-1');
    const stats = balancer.getStats();

    expect(stats.totalServers).toBe(0);
  });

  it('should return null when no healthy servers available', () => {
    const server = balancer.getNextServer();
    expect(server).toBeNull();
  });

  it('should use least-connections algorithm', () => {
    balancer.addServer('server-1', 'http://localhost:3001');
    balancer.addServer('server-2', 'http://localhost:3002');

    // Simulate connections
    balancer.incrementConnections('server-1');
    balancer.incrementConnections('server-1');
    balancer.incrementConnections('server-2');

    const server = balancer.getNextServer();
    expect(server?.id).toBe('server-2'); // Should pick server with fewer connections
  });

  it('should use round-robin algorithm', () => {
    const rrBalancer = new LoadBalancer({ algorithm: 'round-robin' });
    rrBalancer.addServer('server-1', 'http://localhost:3001');
    rrBalancer.addServer('server-2', 'http://localhost:3002');

    const first = rrBalancer.getNextServer();
    const second = rrBalancer.getNextServer();
    const third = rrBalancer.getNextServer();

    expect(first?.id).toBe('server-1');
    expect(second?.id).toBe('server-2');
    expect(third?.id).toBe('server-1'); // Should cycle back

    rrBalancer.shutdown();
  });

  it('should increment and decrement connections', () => {
    balancer.addServer('server-1', 'http://localhost:3001');

    balancer.incrementConnections('server-1');
    balancer.incrementConnections('server-1');

    let stats = balancer.getStats();
    expect(stats.servers[0].activeConnections).toBe(2);

    balancer.decrementConnections('server-1');

    stats = balancer.getStats();
    expect(stats.servers[0].activeConnections).toBe(1);
  });

  it('should update response time', () => {
    balancer.addServer('server-1', 'http://localhost:3001');

    balancer.updateResponseTime('server-1', 100);
    balancer.updateResponseTime('server-1', 200);

    const stats = balancer.getStats();
    expect(stats.servers[0].responseTime).toBeGreaterThan(0);
  });

  it('should mark server as unhealthy', () => {
    balancer.addServer('server-1', 'http://localhost:3001');
    balancer.markUnhealthy('server-1');

    const stats = balancer.getStats();
    expect(stats.servers[0].healthy).toBe(false);
    expect(stats.unhealthyServers).toBe(1);
  });

  it('should mark server as healthy', () => {
    balancer.addServer('server-1', 'http://localhost:3001');
    balancer.markUnhealthy('server-1');
    balancer.markHealthy('server-1');

    const stats = balancer.getStats();
    expect(stats.servers[0].healthy).toBe(true);
    expect(stats.healthyServers).toBe(1);
  });

  it('should calculate average response time', () => {
    balancer.addServer('server-1', 'http://localhost:3001');
    balancer.addServer('server-2', 'http://localhost:3002');

    balancer.updateResponseTime('server-1', 100);
    balancer.updateResponseTime('server-2', 200);

    const stats = balancer.getStats();
    expect(stats.avgResponseTime).toBeGreaterThan(0);
  });

  it('should use weighted round-robin algorithm', () => {
    const wrrBalancer = new LoadBalancer({ algorithm: 'weighted-round-robin' });
    wrrBalancer.addServer('server-1', 'http://localhost:3001', 3);
    wrrBalancer.addServer('server-2', 'http://localhost:3002', 1);

    const selections: Record<string, number> = {};

    // Run multiple selections
    for (let i = 0; i < 100; i++) {
      const server = wrrBalancer.getNextServer();
      if (server) {
        selections[server.id] = (selections[server.id] || 0) + 1;
      }
    }

    // Server-1 should be selected more often due to higher weight
    expect(selections['server-1']).toBeGreaterThan(selections['server-2']);

    wrrBalancer.shutdown();
  });
});
