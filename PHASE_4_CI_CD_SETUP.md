# AEGIS-AI Phase 4 - CI/CD Pipeline Setup

**Estimated Time**: 6-8 hours  
**Prerequisites**: GitHub repository, Docker Hub/ECR account, Kubernetes cluster

---

## 🎯 Objectives

1. Automated testing on pull requests
2. Automated builds and Docker image creation
3. Automated deployment to staging
4. Manual approval for production
5. Secrets management in CI/CD
6. Performance and security scanning

---

## 1. GitHub Actions Workflow

Create `.github/workflows/ci-cd.yml`:

```yaml
name: AEGIS-AI CI/CD Pipeline

on:
  push:
    branches:
      - main
      - develop
    tags:
      - 'v*'
  pull_request:
    branches:
      - main
      - develop

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ============================================================================
  # LINT & TYPE CHECK
  # ============================================================================
  lint-and-typecheck:
    runs-on: ubuntu-latest
    name: Lint & TypeScript Check
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint
    
    - name: Run TypeScript check
      run: npm run typecheck
    
    - name: Upload lint results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: lint-results
        path: |
          eslint-report.json
          typecheck-report.json

  # ============================================================================
  # SECURITY SCANNING
  # ============================================================================
  security-scan:
    runs-on: ubuntu-latest
    name: Security Scanning
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run npm audit
      continue-on-error: true
      run: npm audit --audit-level=moderate
    
    - name: SAST with Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/typescript
          p/react
    
    - name: Trivy vulnerability scan
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy results
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

  # ============================================================================
  # TESTING
  # ============================================================================
  test:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    name: Unit & Integration Tests
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: aegis_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests with coverage
      run: npm run test:coverage
      env:
        DB_HOST: localhost
        DB_PORT: 5432
        DB_USER: postgres
        DB_PASSWORD: testpass
        DB_NAME: aegis_test
        REDIS_HOST: localhost
        REDIS_PORT: 6379
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json
        flags: unittests
        name: codecov-umbrella
    
    - name: Check coverage threshold
      run: |
        COVERAGE=$(cat coverage/coverage-final.json | grep -o '"lines":{[^}]*}' | grep -o '[0-9]*\.[0-9]*' | head -1)
        echo "Line coverage: $COVERAGE%"
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage is below 80%"
          exit 1
        fi

  # ============================================================================
  # BUILD DOCKER IMAGES
  # ============================================================================
  build-images:
    needs: [lint-and-typecheck, test]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    name: Build Docker Images
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha
    
    - name: Build and push backend image
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./Dockerfile.backend
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:buildcache,mode=max
    
    - name: Build and push frontend image
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./Dockerfile.frontend
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:buildcache,mode=max

  # ============================================================================
  # DEPLOY TO STAGING
  # ============================================================================
  deploy-staging:
    needs: build-images
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    name: Deploy to Staging
    environment:
      name: staging
      url: https://staging-api.aegis-ai.co.za
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.27.0'
    
    - name: Configure kubectl
      run: |
        mkdir -p $HOME/.kube
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > $HOME/.kube/config
        chmod 600 $HOME/.kube/config
    
    - name: Update image tags
      run: |
        kubectl set image deployment/aegis-api \
          -n aegis \
          api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:develop \
          --record
        
        kubectl set image deployment/aegis-frontend \
          -n aegis \
          frontend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:develop \
          --record
    
    - name: Wait for rollout
      run: |
        kubectl rollout status deployment/aegis-api -n aegis --timeout=5m
        kubectl rollout status deployment/aegis-frontend -n aegis --timeout=5m
    
    - name: Verify deployment
      run: |
        kubectl get pods -n aegis
        kubectl get svc -n aegis
        kubectl get ingress -n aegis
    
    - name: Smoke test
      run: |
        sleep 30
        curl -f https://staging-api.aegis-ai.co.za/health/ready || exit 1
    
    - name: Notify Slack
      if: always()
      uses: slackapi/slack-github-action@v1
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "Staging deployment ${{ job.status }}",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Staging Deployment*\nStatus: ${{ job.status }}\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                }
              }
            ]
          }

  # ============================================================================
  # DEPLOY TO PRODUCTION
  # ============================================================================
  deploy-production:
    needs: build-images
    if: github.ref == 'refs/heads/main' && startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    name: Deploy to Production
    environment:
      name: production
      url: https://api.aegis-ai.co.za
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.27.0'
    
    - name: Configure kubectl
      run: |
        mkdir -p $HOME/.kube
        echo "${{ secrets.KUBE_CONFIG_PRODUCTION }}" | base64 -d > $HOME/.kube/config
        chmod 600 $HOME/.kube/config
    
    - name: Create backup
      run: |
        kubectl exec -n aegis -it postgres-0 -- \
          pg_dump -U ${{ secrets.DB_USER }} aegis_db > backup-$(date +%s).sql
    
    - name: Update image tags
      run: |
        TAG=${{ github.ref_name }}
        kubectl set image deployment/aegis-api \
          -n aegis \
          api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${TAG} \
          --record
        
        kubectl set image deployment/aegis-frontend \
          -n aegis \
          frontend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${TAG} \
          --record
    
    - name: Wait for rollout
      run: |
        kubectl rollout status deployment/aegis-api -n aegis --timeout=5m
        kubectl rollout status deployment/aegis-frontend -n aegis --timeout=5m
    
    - name: Run smoke tests
      run: |
        sleep 30
        curl -f https://api.aegis-ai.co.za/health/ready || exit 1
        curl -f https://aegis-ai.co.za || exit 1
    
    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref_name }}
        release_name: Release ${{ github.ref_name }}
        body: |
          Production deployment successful
          - Image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.ref_name }}
          - Timestamp: $(date)
        draft: false
        prerelease: false
    
    - name: Notify Slack
      if: always()
      uses: slackapi/slack-github-action@v1
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "Production deployment ${{ job.status }}",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Production Deployment*\nStatus: ${{ job.status }}\nVersion: ${{ github.ref_name }}\nAuthor: ${{ github.actor }}"
                }
              }
            ]
          }

  # ============================================================================
  # PERFORMANCE TEST (Post-deployment)
  # ============================================================================
  performance-test:
    needs: deploy-staging
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    name: Performance Testing
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup k6
      uses: grafana/setup-k6-action@v1
    
    - name: Run k6 load test
      run: k6 run scripts/performance-test.js
      env:
        K6_VUS: 100
        K6_DURATION: 5m
        API_URL: https://staging-api.aegis-ai.co.za
    
    - name: Upload results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: results.json

  # ============================================================================
  # COST MONITORING
  # ============================================================================
  cost-monitoring:
    runs-on: ubuntu-latest
    name: Cost Monitoring
    if: github.event_name == 'push'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Estimate infrastructure costs
      run: |
        echo "API Pods: 3 x $500/month = $1500"
        echo "Frontend Pods: 3 x $100/month = $300"
        echo "Database: 20GB = $200/month"
        echo "Redis: 5GB = $50/month"
        echo "Monitoring: $100/month"
        echo "Total Estimated: $2150/month"

```

---

## 2. Environment Secrets Setup

In GitHub repository settings, add these secrets:

```
# Docker Registry
DOCKER_USERNAME: your-docker-username
DOCKER_PASSWORD: your-docker-token

# Kubernetes
KUBE_CONFIG_STAGING: base64-encoded-kubeconfig
KUBE_CONFIG_PRODUCTION: base64-encoded-kubeconfig

# Database
DB_USER: aegis_user
DB_PASSWORD: secure-password

# API Secrets
JWT_SECRET: secure-jwt-secret
ENCRYPTION_KEY: secure-encryption-key

# Notifications
SLACK_WEBHOOK: https://hooks.slack.com/services/...
```

---

## 3. Branch Protection Rules

Configure in GitHub repository settings:

```
Branch: main
- Require pull request reviews (2 approvals)
- Require status checks to pass (lint, tests, security)
- Require branches to be up to date before merging
- Require CODEOWNERS review
- Block force pushes
- Allow auto-merge

Branch: develop
- Require pull request reviews (1 approval)
- Require status checks to pass
- Allow auto-merge
```

---

## 4. Performance Testing Script

Create `scripts/performance-test.js`:

```javascript
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3000';

export let options = {
  vus: parseInt(__ENV.K6_VUS || 10),
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  group('Health Check', () => {
    let res = http.get(`${API_URL}/health/ready`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('API Endpoints', () => {
    // Test USSD endpoint
    let ussdRes = http.post(`${API_URL}/api/ussd/test`, {
      phoneNumber: '+27123456789',
      userInput: 'test',
      language: 'en',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(ussdRes, {
      'USSD response status': (r) => r.status === 200 || r.status === 400,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(1);
}
```

---

## 5. Secrets Management Best Practices

### 5.1 GitHub Secrets Rotation Schedule

```
Every 90 days:
- Rotate JWT_SECRET
- Rotate ENCRYPTION_KEY
- Rotate CHAT_ENCRYPTION_KEY
- Rotate database password

Every 30 days:
- Rotate Docker credentials
- Rotate Kubernetes config
- Rotate API keys
```

### 5.2 Secret Scanning Prevention

```yaml
# In .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
```

### 5.3 Secret Scanning in CI/CD

```yaml
# In CI/CD workflow
- name: Detect Secrets
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: main
    head: HEAD
```

---

## 6. Deployment Strategy

### 6.1 Blue-Green Deployment

```yaml
# kubernetes/blue-green-deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: aegis-api-blue
spec:
  selector:
    version: blue
  ports:
  - port: 3000

---
apiVersion: v1
kind: Service
metadata:
  name: aegis-api-green
spec:
  selector:
    version: green
  ports:
  - port: 3001

---
# Ingress switches between blue and green
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aegis-api-ingress
spec:
  rules:
  - host: api.aegis-ai.co.za
    http:
      paths:
      - path: /
        backend:
          serviceName: aegis-api-blue  # Switch to aegis-api-green for rollout
          servicePort: 3000
```

### 6.2 Canary Deployment

```yaml
# Using Flagger for canary deployments
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: aegis-api
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: aegis-api
  service:
    port: 3000
  analysis:
    interval: 1m
    threshold: 10
    canaryWeight: 20
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
    - name: request-duration
      thresholdRange:
        max: 500
  webhooks:
  - name: smoke-tests
    url: http://flagger-loadtester/
    timeout: 5s
    metadata:
      type: smoke
      cmd: "curl -s http://aegis-api:3000/health/ready"
```

---

## 7. Rollback Procedures

```bash
# Automatic rollback on deployment failure
# Configured in deployment strategy

# Manual rollback
kubectl rollout undo deployment/aegis-api -n aegis --to-revision=2

# Check rollout history
kubectl rollout history deployment/aegis-api -n aegis

# Detailed revision info
kubectl rollout history deployment/aegis-api -n aegis --revision=2

# Instant rollback (during incident)
kubectl set image deployment/aegis-api -n aegis \
  api=registry/aegis-api:stable --record
```

---

## 8. Deployment Checklist

```
Before Deployment:
- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Security scan passed
- [ ] Code coverage > 80%
- [ ] No critical dependencies upgrades
- [ ] Database migrations tested
- [ ] Backup created
- [ ] Runbook reviewed

During Deployment:
- [ ] Monitor logs in real-time
- [ ] Check error rates (should remain < 1%)
- [ ] Monitor CPU/memory usage
- [ ] Verify health checks passing
- [ ] Check all services responding

After Deployment:
- [ ] Run smoke tests
- [ ] Verify all endpoints
- [ ] Check database integrity
- [ ] Review monitoring dashboards
- [ ] Notify team of completion
```

---

## ✅ Checklist

- [ ] GitHub Actions workflow created
- [ ] Secrets configured in GitHub
- [ ] Branch protection rules enabled
- [ ] Docker images building successfully
- [ ] Staging deployment working
- [ ] Performance tests passing
- [ ] Rollback procedure tested
- [ ] Team trained on deployment process
- [ ] Incident response plan updated

---

**Estimated Completion**: 6-8 hours  
**Next**: Load testing & performance tuning, Team training & runbooks

