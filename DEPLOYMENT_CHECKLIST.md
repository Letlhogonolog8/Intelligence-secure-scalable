# 📋 Deployment Checklist - Backlog Fixes

## Pre-Deployment Verification

### ✅ Code Quality
- [ ] Run type check: `npm run typecheck`
- [ ] Run tests: `npm run test`
- [ ] Run build: `npm run build`
- [ ] Review build output for warnings
- [ ] Check bundle sizes in `dist/assets/js/`

### ✅ Configuration Files
- [ ] Verify `config/prometheus.yml` for Kubernetes
- [ ] Verify `config/prometheus.docker.yml` for Docker Compose
- [ ] Check `.env` has required variables
- [ ] Review `server/index.ts` for console.* (should be none)

### ✅ New Features
- [ ] Circuit breaker file exists: `server/utils/circuitBreaker.ts`
- [ ] Circuit breaker integrated in risk scoring
- [ ] Load balancer wired in `server/index.ts`
- [ ] Test files created and passing

---

## Staging Deployment

### Environment Setup
- [ ] Set `NODE_ENV=staging`
- [ ] Set `LOG_LEVEL=info`
- [ ] Optional: Set `INSTANCE_URLS` if using load balancer
- [ ] Optional: Set `HUGGINGFACE_API_TOKEN` if available

### Kubernetes Deployment
- [ ] Update Prometheus ConfigMap with new config
  ```bash
  kubectl create configmap prometheus-config --from-file=config/prometheus.yml --dry-run=client -o yaml | kubectl apply -f -
  ```
- [ ] Deploy application
  ```bash
  kubectl rollout restart deployment/aegis-api
  ```
- [ ] Verify pods are running
  ```bash
  kubectl get pods -l app=aegis-api
  ```
- [ ] Check pod logs
  ```bash
  kubectl logs -f deployment/aegis-api
  ```

### Docker Compose Deployment
- [ ] Update `docker-compose.yml` to use `prometheus.docker.yml`
  ```yaml
  prometheus:
    volumes:
      - ./config/prometheus.docker.yml:/etc/prometheus/prometheus.yml
  ```
- [ ] Deploy
  ```bash
  docker-compose up -d
  ```
- [ ] Check container status
  ```bash
  docker-compose ps
  ```
- [ ] Check logs
  ```bash
  docker-compose logs -f aegis-api
  ```

---

## Post-Deployment Verification

### Health Checks
- [ ] API health: `curl http://localhost:3001/health`
- [ ] Readiness: `curl http://localhost:3001/health/ready`
- [ ] Metrics: `curl http://localhost:3001/metrics`

### Circuit Breaker
- [ ] Check logs for circuit breaker initialization
  ```bash
  grep "Circuit breaker" logs/app.log
  ```
- [ ] Test risk assessment endpoint
  ```bash
  curl -X POST http://localhost:3001/api/intelligence/assess-risk \
    -H "Content-Type: application/json" \
    -d '{"caseId":"test","description":"test incident"}'
  ```
- [ ] Verify fallback works (disconnect HF API if possible)

### Prometheus
- [ ] Verify Prometheus can scrape metrics
  ```bash
  curl http://prometheus:9090/api/v1/targets
  ```
- [ ] Check for `aegis-api` target in Prometheus UI
- [ ] Verify metrics are being collected

### Structured Logging
- [ ] Check log format is JSON
  ```bash
  tail -f logs/app.log | jq .
  ```
- [ ] Verify request IDs are present
  ```bash
  grep "requestId" logs/app.log
  ```
- [ ] Check log levels are working
  ```bash
  grep '"level":"error"' logs/app.log
  ```

### Load Balancer (if enabled)
- [ ] Verify instances are registered
  ```bash
  # Check logs for "Server added to load balancer"
  grep "load balancer" logs/app.log
  ```
- [ ] Check health checks are running
- [ ] Verify requests are distributed

### Bundle Size
- [ ] Check main bundle size
  ```bash
  ls -lh dist/assets/js/index-*.js
  ```
- [ ] Verify chunks are under 400KB
- [ ] Test page load speed

---

## Monitoring (First 24 Hours)

### Metrics to Watch
- [ ] Circuit breaker state (should be CLOSED)
- [ ] Circuit breaker failure count
- [ ] API response times
- [ ] Error rates
- [ ] Memory usage
- [ ] CPU usage

### Alerts to Configure
- [ ] Alert on circuit breaker OPEN state
- [ ] Alert on high error rate (> 5%)
- [ ] Alert on slow response times (> 2s)
- [ ] Alert on Prometheus scrape failures

### Log Monitoring
- [ ] Watch for circuit breaker state changes
- [ ] Monitor for HuggingFace API failures
- [ ] Check for load balancer health check failures
- [ ] Review error logs

---

## Rollback Plan

### If Issues Occur
1. [ ] Identify the issue
2. [ ] Check if it's related to new changes
3. [ ] Review logs and metrics

### Rollback Steps
```bash
# Kubernetes
kubectl rollout undo deployment/aegis-api

# Docker Compose
git checkout HEAD~1
docker-compose up -d
```

### Rollback Verification
- [ ] Verify old version is running
- [ ] Check health endpoints
- [ ] Verify functionality restored

---

## Production Deployment

### Prerequisites
- [ ] Staging deployment successful
- [ ] 24-48 hours of stable operation in staging
- [ ] No critical issues found
- [ ] Performance metrics acceptable
- [ ] All stakeholders notified

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=warn` or `info`
- [ ] Enable all monitoring and alerting
- [ ] Backup current production state
- [ ] Schedule maintenance window (if needed)
- [ ] Notify users of deployment

### Post-Production
- [ ] Monitor for 1 hour after deployment
- [ ] Check all health endpoints
- [ ] Verify metrics collection
- [ ] Review error logs
- [ ] Confirm with stakeholders

---

## Sign-Off

### Staging Deployment
- [ ] Deployed by: ________________
- [ ] Date: ________________
- [ ] Verified by: ________________
- [ ] Issues found: ________________

### Production Deployment
- [ ] Deployed by: ________________
- [ ] Date: ________________
- [ ] Verified by: ________________
- [ ] Issues found: ________________

---

## Support Contacts

- **DevOps**: [Contact Info]
- **Backend Team**: [Contact Info]
- **On-Call**: [Contact Info]

---

## Documentation References

- Full Details: `BACKLOG_RESOLUTION.md`
- Quick Reference: `BACKLOG_QUICK_REF.md`
- Action Summary: `ACTION_SUMMARY.md`
- This Checklist: `DEPLOYMENT_CHECKLIST.md`

---

**Last Updated**: 2024  
**Version**: 1.0
