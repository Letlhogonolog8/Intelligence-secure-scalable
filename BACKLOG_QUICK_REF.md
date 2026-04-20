# Quick Reference: Backlog Fixes

## 🔴 Circuit Breaker (HuggingFace Protection)

### Usage
```typescript
import { CircuitBreaker } from './utils/circuitBreaker';

const breaker = new CircuitBreaker('my-service', {
  failureThreshold: 3,
  resetTimeout: 30000,
});

const result = await breaker.execute(
  () => apiCall(),
  () => fallbackValue
);
```

### Check Status
```typescript
const stats = breaker.getStats();
console.log(stats.state); // CLOSED, OPEN, or HALF_OPEN
```

---

## 🔴 Prometheus Configuration

### Kubernetes
Use: `config/prometheus.yml`
```yaml
- targets: ['aegis-api:3001']
```

### Docker Compose
Use: `config/prometheus.docker.yml`
```yaml
- targets: ['host.docker.internal:3001']
```

Update `docker-compose.yml`:
```yaml
prometheus:
  volumes:
    - ./config/prometheus.docker.yml:/etc/prometheus/prometheus.yml
```

---

## 🟡 Structured Logging

### Replace Console Calls
```bash
# Automated replacement
tsx scripts/replace-console-logs.ts
```

### Manual Usage
```typescript
import { createLogger } from './utils/logger';

const logger = createLogger('module-name');

logger.info('Message', { key: 'value' }, requestId);
logger.warn('Warning', { key: 'value' }, requestId);
logger.error('Error', error, { key: 'value' }, requestId);
```

---

## 🟡 Load Balancer

### Enable Load Balancer
```env
# .env
INSTANCE_URLS=http://instance-1:3001,http://instance-2:3001
```

### Check Status
```typescript
import { loadBalancer } from './utils/loadBalancer';

const stats = loadBalancer.getStats();
console.log(stats.healthyServers);
```

### Algorithms
- `least-connections` (default)
- `round-robin`
- `weighted-round-robin`

---

## 🟡 Bundle Size Optimization

### Build Production Bundle
```bash
npm run build
```

### Check Bundle Size
```bash
# After build, check dist/ folder
ls -lh dist/assets/js/
```

### Optimizations Applied
- Tree-shaking enhanced
- Terser compression (2 passes)
- Chunk size optimization
- CSS code splitting

---

## 🟢 Test Coverage

### Run Tests
```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
```

### New Test Files
- `src/__tests__/server/circuitBreaker.test.ts`
- `src/__tests__/server/loadBalancer.test.ts`

---

## 🚀 Quick Deploy Commands

```bash
# 1. Type check
npm run typecheck

# 2. Run tests
npm run test

# 3. Build
npm run build

# 4. Deploy
# (Use your deployment method)
```

---

## 📊 Monitoring Endpoints

### Circuit Breaker Stats
```bash
# Via application logs
grep "Circuit breaker" logs/app.log
```

### Load Balancer Stats
```bash
# Via application endpoint (if exposed)
curl http://localhost:3001/api/admin/load-balancer/stats
```

### Prometheus Metrics
```bash
curl http://localhost:3001/metrics
```

---

## ⚠️ Troubleshooting

### Circuit Breaker Stuck Open
```typescript
// Check stats
const stats = breaker.getStats();
console.log(stats.nextAttemptTime); // When it will retry

// Manual reset (if needed)
// Create new instance or wait for resetTimeout
```

### Load Balancer No Healthy Servers
```bash
# Check health endpoints
curl http://instance-1:3001/health
curl http://instance-2:3001/health

# Check logs
grep "Health check failed" logs/app.log
```

### Bundle Size Too Large
```bash
# Analyze bundle
npm run build -- --mode production

# Check for large dependencies
npx vite-bundle-visualizer
```

---

## 📞 Support

For issues or questions:
1. Check logs: `logs/app.log`
2. Review metrics: `/metrics` endpoint
3. Check documentation: `BACKLOG_RESOLUTION.md`
