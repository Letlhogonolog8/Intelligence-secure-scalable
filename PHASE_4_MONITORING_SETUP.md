# AEGIS-AI Phase 4 - Monitoring & Observability Setup

**Estimated Time**: 3-4 hours  
**Prerequisites**: Kubernetes cluster or Docker setup, Prometheus/Datadog accounts

---

## 🎯 Objectives

1. Real-time metrics collection (Prometheus)
2. Log aggregation & analysis (Datadog/ELK)
3. Alert configuration for SLOs
4. Dashboard creation for incident response
5. APM (Application Performance Monitoring) setup

---

## 1. Prometheus Metrics Setup

### 1.1 Add Prometheus Client Library

```bash
npm install prom-client
```

### 1.2 Create Metrics Exporter

Create `server/utils/prometheus.ts`:

```typescript
import client from 'prom-client';

// Default metrics
client.collectDefaultMetrics();

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['query', 'status'],
  buckets: [0.1, 5, 15, 50, 100, 500, 1000]
});

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type']
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type']
});

export const ussdSessions = new client.Gauge({
  name: 'ussd_sessions_active',
  help: 'Active USSD sessions',
  labelNames: ['provider']
});

export const escalations = new client.Counter({
  name: 'escalations_total',
  help: 'Total escalations',
  labelNames: ['severity', 'category']
});

// Export metrics endpoint
export const metricsHandler = async (_req: any, res: any) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
};
```

### 1.3 Integrate into server/index.ts

```typescript
import { metricsHandler, httpRequestDuration } from './utils/prometheus';

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Middleware to track request duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});
```

### 1.4 Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'aegis-ai'
    environment: 'production'

scrape_configs:
  - job_name: 'aegis-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'alerts.yml'
```

### 1.5 Alert Rules

Create `alerts.yml`:

```yaml
groups:
  - name: aegis_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_ms) > 500
        for: 5m
        annotations:
          summary: "High API latency"
          description: "P95 latency is {{ $value }}ms"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        annotations:
          summary: "Database is down"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        annotations:
          summary: "Redis is down"

      - alert: DiskSpaceRunningOut
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        annotations:
          summary: "Disk space running out"
          description: "Only {{ $value | humanizePercentage }} disk space available"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 500
        for: 5m
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB"
```

---

## 2. Datadog Integration

### 2.1 Install Datadog Agent

```bash
npm install @datadog/browser-rum @datadog/browser-logs
```

### 2.2 Initialize Datadog (Frontend)

Create `src/lib/datadog.ts`:

```typescript
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

export const initDatadog = () => {
  if (process.env.VITE_DATADOG_ENABLED !== 'true') {
    return;
  }

  datadogRum.init({
    applicationId: process.env.VITE_DATADOG_APPLICATION_ID || '',
    clientToken: process.env.VITE_DATADOG_CLIENT_TOKEN || '',
    site: 'datadoghq.com',
    service: 'aegis-web',
    env: process.env.VITE_DATADOG_ENV || 'development',
    version: process.env.VITE_DATADOG_VERSION || '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });

  datadogRum.startSessionReplayRecording();

  datadogLogs.init({
    clientToken: process.env.VITE_DATADOG_CLIENT_TOKEN || '',
    site: 'datadoghq.com',
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });
};

export const { datadogRum: rum, datadogLogs: logs } = { datadogRum, datadogLogs };
```

### 2.3 Backend Integration

Create `server/utils/datadog.ts`:

```typescript
import StatsD from 'node-statsd';

const statsd = new StatsD({
  host: process.env.DATADOG_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'aegis.',
  cacheDns: true,
});

export const trackMetric = (metric: string, value: number, tags?: string[]) => {
  statsd.gauge(metric, value, tags);
};

export const incrementCounter = (metric: string, tags?: string[]) => {
  statsd.increment(metric, 1, tags);
};

export const trackTiming = (metric: string, ms: number, tags?: string[]) => {
  statsd.timing(metric, ms, tags);
};

export const closeDatadog = () => {
  statsd.close(() => {
    console.log('Datadog client closed');
  });
};
```

### 2.4 Datadog Configuration (.env)

```
DATADOG_ENABLED=true
DATADOG_AGENT_HOST=localhost
DATADOG_AGENT_PORT=8125
DATADOG_SERVICE=aegis-ai
DATADOG_ENV=production
DATADOG_VERSION=1.0.0
DATADOG_SITE=datadoghq.com
DATADOG_API_KEY=[your-api-key]
VITE_DATADOG_APPLICATION_ID=[your-app-id]
VITE_DATADOG_CLIENT_TOKEN=[your-client-token]
```

---

## 3. ELK Stack Setup (Alternative to Datadog)

### 3.1 Docker Compose for ELK

Create `docker-compose.elk.yml`:

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.0.0
    volumes:
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: filebeat -e -strict.perms=false
    depends_on:
      - elasticsearch

  metricbeat:
    image: docker.elastic.co/beats/metricbeat:8.0.0
    volumes:
      - ./metricbeat.yml:/usr/share/metricbeat/metricbeat.yml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: metricbeat -e -strict.perms=false
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### 3.2 Filebeat Configuration

Create `filebeat.yml`:

```yaml
filebeat.inputs:
  - type: container
    enabled: true
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
      - add_kubernetes_metadata:

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "filebeat-%{+yyyy.MM.dd}"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
```

---

## 4. Dashboard Creation

### 4.1 Prometheus Dashboards (Grafana)

Create `grafana-dashboard.json`:

```json
{
  "dashboard": {
    "title": "AEGIS-AI Performance Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_ms)"
          }
        ]
      },
      {
        "title": "Active USSD Sessions",
        "targets": [
          {
            "expr": "ussd_sessions_active"
          }
        ]
      },
      {
        "title": "Database Query Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, db_query_duration_ms)"
          }
        ]
      }
    ]
  }
}
```

### 4.2 Datadog Dashboards

Via Datadog UI:
1. Create new dashboard
2. Add widgets for:
   - Request latency (p50, p95, p99)
   - Error rate
   - USSD session count
   - Database connections
   - Cache hit ratio
   - Escalation volume

---

## 5. Health Check Endpoints

Update `server/index.ts`:

```typescript
// Liveness probe - Is service alive?
app.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - Can service handle requests?
app.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check Supabase
    const { error: dbError } = await supabase
      .from('audit_logs')
      .select('count(*)', { count: 'exact', head: true });

    if (dbError) {
      return res.status(503).json({ ready: false, reason: 'database' });
    }

    // Check Redis
    if (redisClient && !redisClient.isOpen) {
      return res.status(503).json({ ready: false, reason: 'redis' });
    }

    res.status(200).json({
      ready: true,
      checks: {
        database: 'ok',
        redis: 'ok',
        services: ['mfa', 'encryption', 'ussd', 'audit'].length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
});

// Metrics endpoint
app.get('/metrics', metricsHandler);
```

---

## 6. Kubernetes Health Probes

Update Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: aegis-api:latest
        
        # Liveness probe - restart if dead
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness probe - remove from load balancer if not ready
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

        # Startup probe - allow time to initialize
        startupProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 30
```

---

## 7. Alerting Strategy

### 7.1 Critical Alerts (Page On-Call)
- API downtime (30 seconds)
- Error rate > 5%
- Database unavailable
- Data loss detected

### 7.2 High Priority Alerts (Immediate Action)
- High latency (P95 > 1 second)
- Memory usage > 80%
- Disk space < 10%
- Cache miss ratio > 50%

### 7.3 Medium Priority Alerts (Regular Review)
- High escalation volume
- Slow database queries
- High concurrent sessions
- Backup failures

### 7.4 Low Priority Alerts (Informational)
- Deployment events
- Config changes
- Routine maintenance

---

## 8. Testing Monitoring

```bash
# Test Prometheus endpoint
curl http://localhost:3000/metrics | grep http_request_duration

# Test health checks
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready

# Generate test metrics
while true; do curl -s http://localhost:3000/api/health > /dev/null; sleep 1; done

# View Prometheus graphs
http://localhost:9090
```

---

## ✅ Checklist

- [ ] Prometheus installed and scraping metrics
- [ ] Grafana dashboards created
- [ ] Datadog integration (or ELK) working
- [ ] Alert rules configured
- [ ] Health check endpoints responding
- [ ] Kubernetes probes updated
- [ ] Team trained on dashboard usage
- [ ] On-call alerts configured

---

**Estimated Completion**: 3-4 hours  
**Next**: Kubernetes configuration

