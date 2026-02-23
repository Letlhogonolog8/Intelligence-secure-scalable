# AEGIS-AI Quick Start Guide

**Start here if you want to go from zero to deployed in the shortest time.**

---

## ⏱️ Time Estimates

- **Local Development**: 5-10 minutes
- **Docker Build & Test**: 15-20 minutes
- **Kubernetes Deployment**: 30-45 minutes (if cluster exists)
- **Full Phase 1 Security**: 4 weeks

---

## 🚨 CRITICAL: Read This First

**Your app has security issues that MUST be fixed before any public deployment:**

1. ✅ **Secrets exposed in Git** → Fix in 30 minutes (see below)
2. ✅ **TypeScript type safety disabled** → Fix in 2-3 days
3. ✅ **No API authentication** → Fix in 1-2 weeks
4. ✅ **Weak encryption** → Fix in 3-5 days

**For internal/testing only**: You can skip these temporarily.  
**For production deployment**: Complete Phase 1 first (4 weeks).

Read: [`CRITICAL_ISSUES_SUMMARY.md`](./CRITICAL_ISSUES_SUMMARY.md)

---

## 🔴 STEP 0: Fix Exposed Secrets (30 minutes)

### 0.1 Rotate Secrets

```bash
# Go to Supabase Dashboard: https://app.supabase.com
# Settings → API Keys
# Click "Regenerate" on both keys

# Generate new encryption key
openssl rand -hex 32

# Update .env with new values
# DO NOT commit .env to Git
```

### 0.2 Clean Git History

```bash
# Install BFG Repo-Cleaner
brew install bfg  # macOS
# or download: https://rclone.org/downloads/

# Clean git history
git clone --mirror https://github.com/YOUR_ORG/intelligence-secure-scalable.git temp-clone
cd temp-clone
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin
```

### 0.3 Verify Fix

```bash
# Should return nothing (no secrets found)
git log -p --all -S "VITE_SUPABASE_KEY" | head
```

---

## 📋 STEP 1: Verify Prerequisites

```bash
# Run pre-deployment checklist
chmod +x scripts/pre-deployment-checklist.sh
./scripts/pre-deployment-checklist.sh

# Should see green checkmarks for all critical items
# Fix any red X items before proceeding
```

---

## 🐳 STEP 2: Local Docker Development (5 min)

### 2.1 Build and Run

```bash
# Install Docker if not present: https://www.docker.com/products/docker-desktop

# Build and run locally
docker-compose -f docker-compose.yml up --build

# Wait for "services running" message
```

### 2.2 Test the Application

```bash
# In another terminal, test frontend
curl http://localhost:8080

# Test backend
curl http://localhost:3001/api/health

# Should see: { "status": "ok", "timestamp": "..." }
```

### 2.3 View Logs

```bash
# View real-time logs
docker-compose logs -f

# View specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 2.4 Stop Services

```bash
docker-compose down

# Remove volumes
docker-compose down -v
```

---

## 🏗️ STEP 3: Build Production Images (20 min)

### 3.1 Make Build Script Executable

```bash
chmod +x scripts/docker-build.sh
```

### 3.2 Build Images Locally

```bash
# Build both frontend and backend
./scripts/docker-build.sh --version 1.0.0

# Images are now in Docker daemon
docker images | grep aegis
```

### 3.3 Test Production Build

```bash
# Run production environment locally
docker-compose -f docker-compose.prod.yml up -d

# Check services
docker-compose ps

# Test frontend
curl http://localhost:8080

# Test backend
curl http://localhost:3001/api/health

# View logs
docker-compose logs aegis-backend

# Cleanup
docker-compose down
```

---

## 📤 STEP 4: Push to Registry (Optional)

### 4.1 Setup Docker Registry

```bash
# Option A: Docker Hub
docker login

# Option B: Private Registry
docker login your-registry.com

# Option C: AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
```

### 4.2 Build and Push

```bash
# Build with version and push to registry
./scripts/docker-build.sh \
  --version 1.0.0 \
  --registry your-registry.com \
  --namespace aegis-ai \
  --push

# Verify push
docker manifest inspect your-registry.com/aegis-ai/frontend:1.0.0
```

---

## ☸️ STEP 5: Kubernetes Deployment (30 min)

### 5.1 Prerequisites

```bash
# You need a Kubernetes cluster running
# Options:
# - Minikube (local): minikube start
# - EKS (AWS): aws eks create-cluster
# - GKE (Google): gcloud container clusters create
# - AKS (Azure): az aks create
# - K8s managed service in South Africa

# Verify kubectl access
kubectl cluster-info
kubectl get nodes
```

### 5.2 Install Required Controllers

```bash
# Install Helm (if not present)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Helm repos
helm repo add jetstack https://charts.jetstack.io
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install Cert-Manager (for HTTPS)
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true \
  --wait

# Install Nginx Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --wait
```

### 5.3 Create Namespace & Secrets

```bash
# Create aegis namespace
kubectl create namespace aegis

# Create secrets (update with YOUR actual values)
kubectl create secret generic aegis-secrets \
  --from-literal=supabase-url=https://your-project.supabase.co \
  --from-literal=supabase-anon-key=YOUR_ANON_KEY \
  --from-literal=supabase-service-key=YOUR_SERVICE_KEY \
  --from-literal=encryption-key=$(openssl rand -hex 32) \
  --from-literal=chat-encryption-key=$(openssl rand -hex 32) \
  -n aegis

# Verify secrets created
kubectl get secrets -n aegis
```

### 5.4 Deploy Application

```bash
# Update image references to your registry
sed -i 's|aegis-ai/|your-registry.com/aegis-ai/|g' kubernetes/deployment.yaml

# Deploy
kubectl apply -f kubernetes/deployment.yaml -n aegis
kubectl apply -f kubernetes/ingress.yaml -n aegis

# Wait for deployments to be ready
kubectl rollout status deployment/aegis-frontend -n aegis
kubectl rollout status deployment/aegis-backend -n aegis
```

### 5.5 Verify Deployment

```bash
# Check all resources
kubectl get all -n aegis

# Check pods
kubectl get pods -n aegis

# Check services
kubectl get svc -n aegis

# Check ingress
kubectl get ingress -n aegis

# View logs
kubectl logs -f deployment/aegis-backend -n aegis

# Port forward to test locally
kubectl port-forward svc/aegis-backend 3001:3001 -n aegis
# In another terminal: curl http://localhost:3001/api/health
```

### 5.6 Configure Domain DNS

```bash
# Get Ingress IP/FQDN
kubectl get ingress aegis-ingress -n aegis

# Example output:
# NAME                CLASS    HOSTS              ADDRESS        PORTS   AGE
# aegis-ingress       nginx    aegis-ai.co.za    34.123.45.67   80, 443 5m

# Update DNS to point to ingress IP:
# In your DNS provider, create A record:
# aegis-ai.co.za → 34.123.45.67

# Wait for DNS propagation (5-30 minutes)
nslookup aegis-ai.co.za

# Test HTTPS
curl https://aegis-ai.co.za
```

---

## 🔒 Security Scanning (Optional but Recommended)

```bash
# Install Trivy (vulnerability scanner)
brew install aquasecurity/trivy/trivy  # macOS
# or download: https://github.com/aquasecurity/trivy

# Scan images before pushing
./scripts/docker-build.sh \
  --version 1.0.0 \
  --scan \
  --push

# Scan cluster for security issues
trivy k8s cluster -n aegis
```

---

## 📊 Common Tasks

### View Application Logs

```bash
# Docker Compose
docker-compose logs -f <service>

# Kubernetes
kubectl logs -f deployment/<deployment-name> -n aegis
kubectl logs -f pod/<pod-name> -n aegis
```

### Update Application

```bash
# Docker Compose
# Build new image, update docker-compose.yml, run up

# Kubernetes
# Push new image to registry
./scripts/docker-build.sh --version 1.1.0 --push

# Update deployment
kubectl set image deployment/aegis-backend \
  backend=your-registry.com/aegis-ai/backend:1.1.0 \
  -n aegis

# Monitor rollout
kubectl rollout status deployment/aegis-backend -n aegis
```

### Scale Application

```bash
# Kubernetes manual scaling
kubectl scale deployment aegis-frontend --replicas=5 -n aegis

# Or let HPA (Horizontal Pod Autoscaler) do it automatically
# HPA configured in ingress.yaml, scales based on CPU/memory
kubectl get hpa -n aegis
```

### Rollback Failed Deployment

```bash
# Kubernetes
kubectl rollout undo deployment/aegis-backend -n aegis
kubectl rollout status deployment/aegis-backend -n aegis
```

---

## 🆘 Troubleshooting

### Docker Issues

```bash
# Images not building?
docker build -f Dockerfile.backend --no-cache .

# Container not starting?
docker logs <container-id>

# Network issues?
docker network ls
docker inspect <network-id>
```

### Kubernetes Issues

```bash
# Pod not starting?
kubectl describe pod <pod-name> -n aegis
kubectl logs <pod-name> -n aegis

# Service not responding?
kubectl port-forward svc/<service> 3001:3001 -n aegis
curl http://localhost:3001/api/health

# Check cluster health
kubectl cluster-info
kubectl get nodes
kubectl get events -n aegis
```

### Database Connection

```bash
# Verify secrets
kubectl get secret aegis-secrets -n aegis -o yaml | grep supabase

# Test from pod
kubectl exec -it deployment/aegis-backend -n aegis -- \
  node -e "console.log(process.env.VITE_SUPABASE_URL)"
```

---

## 📖 Full Documentation

- **Detailed Deployment Guide**: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
- **System Audit Report**: [`SYSTEM_AUDIT_REPORT.md`](./SYSTEM_AUDIT_REPORT.md)
- **Phase 1 Implementation**: [`PHASE1_IMPLEMENTATION_GUIDE.md`](./PHASE1_IMPLEMENTATION_GUIDE.md)
- **South Africa Compliance**: [`SOUTH_AFRICA_COMPLIANCE_GUIDE.md`](./SOUTH_AFRICA_COMPLIANCE_GUIDE.md)
- **Critical Issues**: [`CRITICAL_ISSUES_SUMMARY.md`](./CRITICAL_ISSUES_SUMMARY.md)

---

## ✅ Deployment Checklist

- [ ] Fix exposed secrets (Step 0)
- [ ] Run pre-deployment checklist (Step 1)
- [ ] Test local Docker (Step 2)
- [ ] Build production images (Step 3)
- [ ] Push to registry (Step 4, optional)
- [ ] Setup Kubernetes cluster (Step 5.1-5.2)
- [ ] Deploy to Kubernetes (Step 5.3-5.5)
- [ ] Configure DNS (Step 5.6)
- [ ] Verify HTTPS working
- [ ] Run security scan
- [ ] Load test application
- [ ] Setup monitoring & alerting

---

## 🚀 What's Next?

### Immediate (This Week)
1. ✅ Deploy to staging environment
2. ✅ Run security scanning
3. ✅ Performance testing
4. ✅ Team training

### Short-term (Weeks 2-4)
1. ✅ Fix critical security issues (Phase 1)
2. ✅ Setup monitoring & logging
3. ✅ Disaster recovery testing

### Medium-term (Weeks 5-8)
1. ✅ Enhanced testing framework
2. ✅ Advanced RBAC implementation
3. ✅ CI/CD security enhancements

---

## 💡 Tips

- **Use environment files**: Create separate `.env.local`, `.env.staging`, `.env.production`
- **Tag images properly**: Include version, git commit, build date
- **Monitor continuously**: Setup alerts for health checks, errors, performance
- **Document everything**: Keep runbooks for common tasks
- **Test regularly**: Run load tests, security scans, disaster recovery drills
- **Update dependencies**: Keep Node, Docker, Kubernetes versions current

---

**Last Updated**: February 2026  
**For Help**: See troubleshooting section or contact development team  
**For Production**: Complete Phase 1 security fixes first
