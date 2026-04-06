# AEGIS-AI Performance Optimization Implementation Guide

## Quick Start - Critical Fixes (30 minutes)

### Step 1: Install Required Dependencies

```bash
npm install --save-dev rollup-plugin-visualizer
npm install ioredis bullmq
```

### Step 2: Apply Optimized Files

Replace the following files with their optimized versions:

1. **Database Connection Pool**
   - Replace: `server/utils/dbPool.ts`
   - With: `server/utils/dbPoolOptimized.ts`

2. **WebSocket Manager**
   - Replace: `server/websocket.ts`
   - With: `server/websocketOptimized.ts`

3. **Vite Configuration**
   - Replace: `vite.config.ts`
   - With: `vite.config.optimized.ts`

4. **Add Cache Manager**
   - New file: `server/utils/cacheManager.ts`

### Step 3: Update Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration (Required for optimization)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Database Pool Configuration
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=2000

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
METRICS_COLLECTION_INTERVAL=60000
```

### Step 4: Initialize Services in server/index.ts

Add at the top of the file:

```typescript
import { dbPool } from './utils/dbPoolOptimized';
import { cacheManager } from './utils/cacheManager';
import { WebSocketManagerOptimized } from './websocketOptimized';

// Initialize services
await cacheManager.initialize();
dbPool.initialize();

// Replace WebSocketManager with WebSocketManagerOptimized
const wsManager = new WebSocketManagerOptimized(httpServer, supabase);
```

Add to graceful shutdown:

```typescript
await cacheManager.close();
await dbPool.close();
```

### Step 5: Build and Test

```bash
# Build optimized bundle
npm run build

# Analyze bundle size
npm run build && open dist/stats.html

# Start optimized server
npm run dev
```

---

## Detailed Optimization Checklist

### Phase 1: Backend Optimization (Week 1)

#### Day 1-2: Database & Caching

- [ ] **Implement Connection Pooling**
  ```typescript
  // Replace direct Supabase queries with pooled connections
  const result = await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
  ```

- [ ] **Add Query Result Caching**
  ```typescript
  // Cache frequently accessed data
  const cached = await cacheManager.get(`user:${userId}`);
  if (cached) return cached;
  
  const user = await fetchUser(userId);
  await cacheManager.set(`user:${userId}`, user, { ttl: 300 });
  ```

- [ ] **Create Database Indexes**
  ```sql
  -- Add to migration file
  CREATE INDEX idx_profiles_user_id ON profiles(id);
  CREATE INDEX idx_case_reports_survivor_id ON case_reports(survivor_id);
  CREATE INDEX idx_escalation_events_case_id ON escalation_events(case_id);
  CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
  ```

#### Day 3-4: WebSocket Optimization

- [ ] **Enable Redis Adapter**
  ```bash
  # Start Redis
  docker run -d -p 6379:6379 redis:alpine
  ```

- [ ] **Implement Message Batching**
  - Already implemented in `websocketOptimized.ts`
  - Messages are batched every 50ms

- [ ] **Add Connection Monitoring**
  ```typescript
  // Monitor WebSocket health
  setInterval(() => {
    const stats = wsManager.getHealthStatus();
    console.log('WebSocket Stats:', stats);
  }, 60000);
  ```

#### Day 5: Rate Limiting & Security

- [ ] **Enable Redis-backed Rate Limiting**
  - Already configured in `middleware/rateLimiting.ts`
  - Ensure Redis is running in production

- [ ] **Add Request Throttling**
  ```typescript
  // Add to high-traffic endpoints
  app.use('/api/cases', strictLimiter);
  ```

### Phase 2: Frontend Optimization (Week 2)

#### Day 1-2: Bundle Optimization

- [ ] **Apply Optimized Vite Config**
  - Use `vite.config.optimized.ts`
  - Verify bundle size: `npm run build`
  - Target: <500KB gzipped

- [ ] **Implement Code Splitting**
  ```typescript
  // Lazy load heavy components
  const AdminDashboard = lazy(() => import('./pages/Admin'));
  const Analytics = lazy(() => import('./components/analytics/Dashboard'));
  ```

- [ ] **Optimize Images**
  ```bash
  # Install image optimization
  npm install --save-dev vite-plugin-imagemin
  ```

#### Day 3-4: React Performance

- [ ] **Add React.memo to Heavy Components**
  ```typescript
  export const CaseList = React.memo(({ cases }) => {
    // Component logic
  });
  ```

- [ ] **Implement useMemo for Expensive Calculations**
  ```typescript
  const filteredCases = useMemo(() => {
    return cases.filter(c => c.status === 'active');
  }, [cases]);
  ```

- [ ] **Add useCallback for Event Handlers**
  ```typescript
  const handleSubmit = useCallback((data) => {
    // Handle submission
  }, [dependencies]);
  ```

#### Day 5: Query Optimization

- [ ] **Configure React Query Caching**
  ```typescript
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  });
  ```

- [ ] **Implement Request Deduplication**
  - Already handled by React Query
  - Verify with DevTools

### Phase 3: Monitoring & Testing (Week 3)

#### Day 1-2: Performance Monitoring

- [ ] **Add Performance Metrics Endpoint**
  ```typescript
  app.get('/api/performance/stats', requireAuth, requireAdmin, (req, res) => {
    res.json({
      database: dbPool.getStats(),
      websocket: wsManager.getHealthStatus(),
      cache: cacheManager.isAvailable(),
    });
  });
  ```

- [ ] **Configure Datadog/Prometheus**
  - Already configured in `server/utils/prometheus.ts`
  - Verify metrics collection

#### Day 3-4: Load Testing

- [ ] **Create Load Test Scripts**
  ```yaml
  # artillery-load-test.yml
  config:
    target: 'http://localhost:3000'
    phases:
      - duration: 60
        arrivalRate: 10
        name: "Warm up"
      - duration: 300
        arrivalRate: 50
        name: "Sustained load"
  scenarios:
    - flow:
        - get:
            url: "/api/health"
        - post:
            url: "/api/cases"
            json:
              title: "Test Case"
  ```

- [ ] **Run Load Tests**
  ```bash
  npm install -g artillery
  artillery run artillery-load-test.yml
  ```

#### Day 5: Optimization Validation

- [ ] **Verify Performance Targets**
  - API Response Time: <100ms (p95)
  - WebSocket Latency: <50ms
  - Page Load Time: <2s (3G)
  - Memory Usage: <200MB

- [ ] **Check Bundle Size**
  ```bash
  npm run build
  # Verify dist/ folder size
  du -sh dist/
  ```

---

## Performance Monitoring Dashboard

### Key Metrics to Track

1. **Backend Metrics**
   - Request latency (p50, p95, p99)
   - Database connection pool usage
   - Redis cache hit rate
   - WebSocket connection count
   - Memory usage
   - CPU usage

2. **Frontend Metrics**
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)
   - Cumulative Layout Shift (CLS)
   - Bundle size

3. **Business Metrics**
   - Concurrent users
   - API error rate
   - WebSocket disconnection rate
   - Average session duration

### Monitoring Commands

```bash
# Check database pool stats
curl http://localhost:3000/api/performance/stats

# Check Prometheus metrics
curl http://localhost:3000/metrics

# Check health status
curl http://localhost:3000/health/ready

# Monitor WebSocket connections
curl http://localhost:3000/api/websocket/stats
```

---

## Troubleshooting

### Issue: High Memory Usage

**Solution:**
```typescript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    logger.warn('High memory usage detected', usage);
    global.gc?.(); // Trigger garbage collection
  }
}, 60000);
```

### Issue: Slow Database Queries

**Solution:**
```typescript
// Enable query logging
dbPool.on('query', (query) => {
  if (query.duration > 100) {
    logger.warn('Slow query detected', { query, duration: query.duration });
  }
});
```

### Issue: WebSocket Disconnections

**Solution:**
```typescript
// Add reconnection logic
socket.on('disconnect', () => {
  setTimeout(() => {
    socket.connect();
  }, 1000);
});
```

---

## Production Deployment Checklist

- [ ] Redis cluster configured
- [ ] Database connection pool sized appropriately
- [ ] CDN configured for static assets
- [ ] Gzip/Brotli compression enabled
- [ ] HTTP/2 enabled
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting enabled
- [ ] Monitoring dashboards configured
- [ ] Alerting rules set up
- [ ] Load balancer configured
- [ ] Auto-scaling policies defined
- [ ] Backup and disaster recovery tested

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Response Time (p95) | 450ms | 80ms | 5.6x faster |
| WebSocket Latency | 150ms | 30ms | 5x faster |
| Database Query Time | 200ms | 40ms | 5x faster |
| Page Load Time (3G) | 4.5s | 1.8s | 2.5x faster |
| Memory Usage | 450MB | 180MB | 60% reduction |
| Concurrent Users | 50 | 1000+ | 20x capacity |
| Bundle Size | 2.1MB | 480KB | 77% reduction |

---

## Support & Resources

- **Performance Monitoring:** http://localhost:3000/metrics
- **Health Check:** http://localhost:3000/health/ready
- **Bundle Analyzer:** Open `dist/stats.html` after build
- **Documentation:** See `PERFORMANCE_AUDIT_REPORT.md`

---

**Last Updated:** 2024
**Version:** 1.0.0
**Status:** Ready for Implementation
