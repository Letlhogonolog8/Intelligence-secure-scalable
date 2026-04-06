# AEGIS-AI Performance Optimization - Quick Reference

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Install dependencies
npm install ioredis bullmq rollup-plugin-visualizer

# 2. Start Redis
docker run -d -p 6379:6379 redis:alpine

# 3. Update .env
echo "REDIS_URL=redis://localhost:6379" >> .env

# 4. Apply optimizations (see below)

# 5. Build and test
npm run build
npm run dev
```

---

## 📊 Performance Monitoring Commands

```bash
# Check application health
curl http://localhost:3000/health/ready

# View Prometheus metrics
curl http://localhost:3000/metrics

# Check database pool stats
curl http://localhost:3000/api/performance/stats

# Monitor WebSocket connections
curl http://localhost:3000/api/websocket/stats

# Analyze bundle size
npm run build && open dist/stats.html
```

---

## 🔧 Common Optimizations

### 1. Database Query Optimization

**Before:**
```typescript
const { data } = await supabase
  .from('cases')
  .select('*')
  .eq('status', 'active');
```

**After:**
```typescript
// Use connection pool
const result = await dbPool.query(
  'SELECT id, title, status FROM cases WHERE status = $1',
  ['active']
);

// Add caching
const cacheKey = 'cases:active';
const cached = await cacheManager.get(cacheKey);
if (cached) return cached;

const result = await dbPool.query(...);
await cacheManager.set(cacheKey, result.rows, { ttl: 60 });
```

### 2. WebSocket Message Optimization

**Before:**
```typescript
socket.emit('case:updated', { caseId, data });
```

**After:**
```typescript
// Messages are automatically batched every 50ms
wsManager.broadcastCaseUpdate(caseId, data);
```

### 3. React Component Optimization

**Before:**
```typescript
function CaseList({ cases }) {
  return cases.map(c => <CaseCard key={c.id} case={c} />);
}
```

**After:**
```typescript
const CaseList = React.memo(({ cases }) => {
  const sortedCases = useMemo(
    () => cases.sort((a, b) => b.createdAt - a.createdAt),
    [cases]
  );
  
  return sortedCases.map(c => <CaseCard key={c.id} case={c} />);
});
```

### 4. API Request Optimization

**Before:**
```typescript
// Multiple requests
const user = await fetch('/api/users/1');
const profile = await fetch('/api/profiles/1');
const cases = await fetch('/api/cases?userId=1');
```

**After:**
```typescript
// Single batched request
const [user, profile, cases] = await Promise.all([
  fetch('/api/users/1'),
  fetch('/api/profiles/1'),
  fetch('/api/cases?userId=1'),
]);

// Or use GraphQL
const { data } = await graphql(`
  query {
    user(id: 1) {
      profile { ... }
      cases { ... }
    }
  }
`);
```

---

## 🐛 Troubleshooting

### Issue: High Memory Usage

```bash
# Check memory usage
curl http://localhost:3000/api/performance/stats

# Force garbage collection (if enabled)
kill -USR2 $(pgrep -f "node.*server")

# Monitor memory over time
watch -n 5 'curl -s http://localhost:3000/api/performance/stats | jq .memory'
```

**Solution:**
```typescript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) {
    logger.warn('High memory usage', usage);
    global.gc?.();
  }
}, 60000);
```

### Issue: Slow Database Queries

```bash
# Enable query logging
export DEBUG=db:query

# Check slow queries
curl http://localhost:3000/api/performance/slow-queries
```

**Solution:**
```sql
-- Add indexes
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM cases WHERE status = 'active';
```

### Issue: WebSocket Disconnections

```bash
# Check WebSocket health
curl http://localhost:3000/api/websocket/stats

# Monitor connections
watch -n 2 'curl -s http://localhost:3000/api/websocket/stats | jq'
```

**Solution:**
```typescript
// Add reconnection logic
socket.on('disconnect', () => {
  setTimeout(() => socket.connect(), 1000);
});

// Increase ping timeout
const io = new Server(httpServer, {
  pingInterval: 25000,
  pingTimeout: 60000,
});
```

### Issue: High API Latency

```bash
# Check API response times
curl http://localhost:3000/metrics | grep http_request_duration

# Profile specific endpoint
curl -w "@curl-format.txt" http://localhost:3000/api/cases
```

**Solution:**
```typescript
// Add caching
app.get('/api/cases', async (req, res) => {
  const cacheKey = `cases:${req.query.status}`;
  const cached = await cacheManager.get(cacheKey);
  if (cached) return res.json(cached);
  
  const cases = await fetchCases(req.query);
  await cacheManager.set(cacheKey, cases, { ttl: 60 });
  res.json(cases);
});
```

---

## 📈 Performance Targets

| Metric | Target | Command to Check |
|--------|--------|------------------|
| API Response (p95) | <100ms | `curl http://localhost:3000/metrics \| grep http_request_duration_seconds` |
| WebSocket Latency | <50ms | `curl http://localhost:3000/api/websocket/stats` |
| Memory Usage | <200MB | `curl http://localhost:3000/api/performance/stats \| jq .memory` |
| Bundle Size | <500KB | `du -sh dist/assets/js/*.js` |
| Database Pool | >80% idle | `curl http://localhost:3000/api/performance/stats \| jq .database` |

---

## 🔍 Load Testing

```bash
# Install artillery
npm install -g artillery

# Run basic load test
artillery quick --count 100 --num 10 http://localhost:3000/api/health

# Run comprehensive test
artillery run load-test.yml

# Generate report
artillery run --output report.json load-test.yml
artillery report report.json
```

**load-test.yml:**
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/api/cases"
      - post:
          url: "/api/cases"
          json:
            title: "Test Case"
            status: "active"
```

---

## 🚨 Emergency Procedures

### Application Crash
```bash
# Check logs
docker logs aegis-backend-dev --tail 100

# Restart services
docker-compose restart

# Check health
curl http://localhost:3000/health/ready
```

### Database Connection Issues
```bash
# Check database pool
curl http://localhost:3000/api/performance/stats | jq .database

# Reset connections
docker-compose restart backend

# Check Supabase status
curl https://status.supabase.com/api/v2/status.json
```

### Redis Connection Issues
```bash
# Check Redis
docker exec -it redis redis-cli ping

# Restart Redis
docker restart redis

# Check cache status
curl http://localhost:3000/api/performance/stats | jq .cache
```

---

## 📚 Documentation Links

- **Full Audit Report:** `PERFORMANCE_AUDIT_REPORT.md`
- **Implementation Guide:** `OPTIMIZATION_IMPLEMENTATION_GUIDE.md`
- **Feature Recommendations:** `REALTIME_FEATURES_RECOMMENDATIONS.md`
- **Executive Summary:** `EXECUTIVE_SUMMARY.md`

---

## 🎯 Quick Wins (30 Minutes)

1. **Enable Redis Caching**
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   echo "REDIS_URL=redis://localhost:6379" >> .env
   ```

2. **Add Database Indexes**
   ```sql
   CREATE INDEX idx_cases_status ON cases(status);
   CREATE INDEX idx_profiles_user_id ON profiles(id);
   ```

3. **Optimize Bundle Size**
   ```bash
   cp vite.config.optimized.ts vite.config.ts
   npm run build
   ```

4. **Enable Compression**
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

---

## 💡 Pro Tips

1. **Always use connection pooling** for database queries
2. **Cache frequently accessed data** (users, profiles, configs)
3. **Batch WebSocket messages** instead of individual emits
4. **Use React.memo** for expensive components
5. **Implement request deduplication** for POST/PUT endpoints
6. **Monitor performance metrics** in production
7. **Set up alerts** for performance degradation
8. **Run load tests** before deployment

---

## 🔗 Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview                # Preview production build

# Testing
npm run test                   # Run tests
npm run test:coverage          # Generate coverage report
npm run lint                   # Run linter

# Monitoring
npm run metrics                # View metrics
npm run health                 # Check health status

# Docker
docker-compose up -d           # Start all services
docker-compose logs -f         # View logs
docker-compose down            # Stop all services
```

---

**Last Updated:** 2024  
**Version:** 1.0.0  
**Status:** Ready for Use
