# Monitoring Stack Startup Log

**Started**: 2026-02-23 10:25 UTC+2  
**Command**: `docker-compose -f docker-compose.monitoring.yml up -d`  
**Status**: ✅ STARTED SUCCESSFULLY

---

## ✅ Services Started

The following services have been started in detached mode:

### 1. **Prometheus** (Port 9090)
- **Purpose**: Metrics collection and time-series database
- **URL**: http://localhost:9090
- **Status**: Starting...
- **Health Check**: `wget --spider -q http://localhost:9090/-/healthy`
- **Features**:
  - Scrapes metrics from AEGIS API every 30 seconds
  - Evaluates alert rules every 30 seconds
  - Stores metrics for 7 days
  - Console UI for querying metrics

### 2. **AlertManager** (Port 9093)
- **Purpose**: Alert routing and notification management
- **URL**: http://localhost:9093
- **Status**: Starting...
- **Health Check**: `wget --spider -q http://localhost:9093/-/healthy`
- **Features**:
  - Routes alerts to Slack, PagerDuty, email
  - Groups related alerts
  - Handles alert deduplication
  - Web UI for alert management

### 3. **Grafana** (Port 3001)
- **Purpose**: Metrics visualization and dashboarding
- **URL**: http://localhost:3001
- **Credentials**: `admin` / `admin`
- **Status**: Starting...
- **Health Check**: `wget --spider -q http://localhost:3000/api/health`
- **Features**:
  - Pre-configured Prometheus data source
  - Auto-provisioned dashboards
  - User management
  - Alert notification channels

### 4. **Node Exporter** (Port 9100)
- **Purpose**: System metrics collection (CPU, memory, disk, network)
- **URL**: http://localhost:9100/metrics
- **Status**: Starting...
- **Features**:
  - Collects system metrics
  - Exposes in Prometheus format
  - Low overhead

### 5. **cAdvisor** (Port 8080)
- **Purpose**: Container metrics collection
- **URL**: http://localhost:8080
- **Status**: Starting...
- **Features**:
  - Collects Docker container metrics
  - Memory, CPU, network usage per container
  - Historical data

### 6. **Redis** (Port 6379)
- **Purpose**: Cache and data store for testing
- **URL**: localhost:6379
- **Status**: Starting...
- **Health Check**: `redis-cli --raw incr ping`
- **Password**: (from REDIS_PASSWORD environment variable)

### 7. **PostgreSQL** (Port 5432)
- **Purpose**: Database for testing and data storage
- **URL**: localhost:5432
- **Status**: Starting...
- **Health Check**: `pg_isready -U aegis_user -d aegis_db`
- **Credentials**:
  - User: `aegis_user`
  - Password: (from DB_PASSWORD environment variable)
  - Database: `aegis_db`

---

## 📊 Accessing the Monitoring Stack

### Prometheus (Metrics & Alerts)
```
URL: http://localhost:9090
Path: /
Query Examples:
  - http_request_duration_ms (request latency)
  - rate(http_requests_total[5m]) (request rate)
  - http_requests_total{status=~"5.."} (error count)
  - db_query_duration_ms (database queries)
  - ussd_sessions_active (USSD sessions)
```

### Grafana (Dashboards)
```
URL: http://localhost:3001
Credentials: admin / admin

Dashboards available:
  - API Performance (request latency, error rate)
  - Database Metrics (query times, connection pool)
  - System Metrics (CPU, memory, disk)
  - Business Logic (escalations, MFA, USSD)
  - Infrastructure (containers, services)
```

### AlertManager (Alert Routing)
```
URL: http://localhost:9093
View:
  - Current firing alerts
  - Alert groups and inhibitions
  - Routing tree
  - Notifications sent
```

### Node Exporter (System Metrics)
```
URL: http://localhost:9100/metrics
Metrics:
  - CPU usage
  - Memory available/used
  - Disk space
  - Network interfaces
  - System uptime
```

### cAdvisor (Container Metrics)
```
URL: http://localhost:8080
Metrics:
  - Container CPU usage
  - Container memory usage
  - Container network I/O
  - Container filesystem usage
```

---

## 🔍 Verification Steps

### 1. Check Container Status
```bash
# List all running aegis services
docker ps --filter "name=aegis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Example output:
# NAMES                  STATUS                  PORTS
# aegis-prometheus       Up 2 minutes (healthy)  0.0.0.0:9090->9090/tcp
# aegis-alertmanager     Up 2 minutes (healthy)  0.0.0.0:9093->9093/tcp
# aegis-grafana          Up 2 minutes (healthy)  0.0.0.0:3001->3000/tcp
# aegis-node-exporter    Up 2 minutes            0.0.0.0:9100->9100/tcp
# aegis-cadvisor         Up 2 minutes            0.0.0.0:8080->8080/tcp
# aegis-redis            Up 2 minutes (healthy)  0.0.0.0:6379->6379/tcp
# aegis-postgres         Up 2 minutes (healthy)  0.0.0.0:5432->5432/tcp
```

### 2. Test Prometheus
```bash
# Query API request latency
curl "http://localhost:9090/api/v1/query?query=http_request_duration_ms"

# Expected response: JSON with metric data
```

### 3. View Alerts (if API is running)
```bash
# Access Prometheus Alerts UI
open http://localhost:9090/alerts

# Check AlertManager for alert routing
open http://localhost:9093
```

### 4. Check Logs
```bash
# Prometheus logs
docker logs aegis-prometheus

# Grafana logs
docker logs aegis-grafana

# AlertManager logs
docker logs aegis-alertmanager
```

---

## 🚀 Integration with AEGIS API

### 1. Ensure API is Running
```bash
npm run dev:server
# API starts on http://localhost:3000
# Metrics endpoint: http://localhost:3000/metrics
```

### 2. Prometheus Will Automatically Scrape
```
Every 30 seconds:
- Prometheus scrapes http://localhost:3000/metrics
- Collects all AEGIS metrics (requests, database, cache, business logic)
- Stores in time-series database
```

### 3. Create Test Traffic
```bash
# Generate some API requests
for i in {1..10}; do
  curl http://localhost:3000/api/health
  sleep 1
done

# Check metrics in Prometheus
# http://localhost:9090/graph?expr=http_requests_total
```

### 4. Alerts Will Fire
```
When thresholds are exceeded:
- AlertManager receives alerts from Prometheus
- Routes to Slack/PagerDuty (if configured)
- Groups related alerts
- Deduplicates duplicates
```

---

## 📋 Configuration Details

### Prometheus Scrape Configuration
- **Target**: `http://localhost:3000/metrics`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Labels Added**:
  - `cluster`: aegis-ai
  - `environment`: production
  - `service`: aegis-platform

### Alert Rules
- **Location**: `/config/alerts.yml`
- **Rules**: 25+ including:
  - Critical: API down, high error rate, database down
  - Warning: High latency, auth failures, rate limiting
  - Info: Backup status, maintenance window

### Recording Rules
- **Location**: `/config/recording_rules.yml`
- **Rules**: 40+ pre-computed metrics:
  - Latency percentiles (p50, p95, p99)
  - Error rates
  - Success rates
  - Cache hit ratios

---

## 🛑 Stopping the Stack

```bash
# Stop all services gracefully
docker-compose -f docker-compose.monitoring.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.monitoring.yml down -v

# View logs before stopping
docker-compose -f docker-compose.monitoring.yml logs

# View specific service logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

---

## 📖 Next Steps

1. **Access Prometheus** (http://localhost:9090)
   - Verify metrics are being collected
   - Query request latency: `http_request_duration_ms`
   - Check targets: Status > Targets

2. **Access Grafana** (http://localhost:3001)
   - Login with admin/admin
   - Review pre-configured dashboards
   - Create custom dashboards if needed

3. **Configure AlertManager**
   - Set Slack webhook: `SLACK_WEBHOOK_URL`
   - Set PagerDuty key: `PAGERDUTY_SERVICE_KEY`
   - Test alerts

4. **Start AEGIS API**
   ```bash
   npm run dev:server
   ```

5. **Generate Test Traffic**
   ```bash
   # Open Prometheus at http://localhost:9090
   # Execute sample requests to generate metrics
   ```

6. **Monitor Alerts**
   - Watch AlertManager at http://localhost:9093
   - Check Grafana dashboards
   - Review email/Slack notifications

---

## 🆘 Troubleshooting

### Containers Not Starting
```bash
# Check Docker daemon
docker ps

# Check specific container logs
docker logs aegis-prometheus
docker logs aegis-grafana

# Restart all services
docker-compose -f docker-compose.monitoring.yml restart
```

### Prometheus Not Scraping Metrics
```bash
# Check Prometheus targets
# http://localhost:9090/targets

# Verify API is running
curl http://localhost:3000/metrics

# Check Prometheus logs
docker logs aegis-prometheus
```

### Grafana Not Loading
```bash
# Check Grafana logs
docker logs aegis-grafana

# Reset admin password
docker exec aegis-grafana grafana-cli admin reset-admin-password newpassword

# Access: http://localhost:3001
```

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :9090

# Kill process (get PID from above)
taskkill /PID <PID> /F

# Or change docker-compose ports
```

---

## ✅ Monitoring Stack Status

| Service | Port | Status | Health |
|---------|------|--------|--------|
| Prometheus | 9090 | ✅ Running | Checking |
| AlertManager | 9093 | ✅ Running | Checking |
| Grafana | 3001 | ✅ Running | Checking |
| Node Exporter | 9100 | ✅ Running | N/A |
| cAdvisor | 8080 | ✅ Running | N/A |
| Redis | 6379 | ✅ Running | Checking |
| PostgreSQL | 5432 | ✅ Running | Checking |

---

**Startup Command Executed**: `docker-compose -f docker-compose.monitoring.yml up -d`  
**Exit Code**: 0 (Success)  
**Services**: 7 containers started  
**Estimated Startup Time**: 30-60 seconds  

**Note**: Services are starting in background. Health checks will pass once initialization completes (1-2 minutes).

