# AEGIS-AI Deployment Guide

## 🚀 Overview

This guide covers deploying AEGIS-AI in Docker and Kubernetes environments for production use.

---

## 📦 Docker Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+ (for local development)
- Docker registry credentials (for pushing images)

### Local Development

```bash
# Build and run locally
docker-compose -f docker-compose.yml up --build

# Access the application
# Frontend: http://localhost:8080
# Backend: http://localhost:3001/api/health
```

### Production Deployment

#### 1. Build Images

```bash
# Make build script executable
chmod +x scripts/docker-build.sh

# Build both images
./scripts/docker-build.sh --version 1.0.0

# Build and push to registry
./scripts/docker-build.sh --version 1.0.0 --push

# Build with security scanning
./scripts/docker-build.sh --version 1.0.0 --scan --push

# Build only backend with Nginx frontend
./scripts/docker-build.sh --frontend-nginx --backend --push
```

#### 2. Run with Docker Compose (Production)

```bash
# Create .env.production file with actual values
cp .env .env.production

# Start services
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.yml up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down
```

#### 3. Publish to Registry

```bash
# Tag images for your registry
docker tag aegis-ai/frontend:1.0.0 your-registry.com/aegis/frontend:1.0.0
docker tag aegis-ai/backend:1.0.0 your-registry.com/aegis/backend:1.0.0

# Login to registry
docker login your-registry.com

# Push images
docker push your-registry.com/aegis/frontend:1.0.0
docker push your-registry.com/aegis/backend:1.0.0

# Verify
docker manifest inspect your-registry.com/aegis/frontend:1.0.0
```

---

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster 1.24+
- kubectl configured with cluster access
- Helm 3.x (optional, for package management)
- Cert-manager (for TLS certificates)
- Nginx Ingress Controller

### Setup

#### 1. Install Prerequisites

```bash
# Add and update Helm repos
helm repo add jetstack https://charts.jetstack.io
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install Cert-Manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Install Nginx Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.resources.requests.cpu=200m \
  --set controller.resources.requests.memory=256Mi
```

#### 2. Create Secrets

```bash
# Create namespace
kubectl create namespace aegis

# Create image pull secret (if using private registry)
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.com \
  --docker-username=your-username \
  --docker-password=your-password \
  -n aegis

# Create secrets for environment variables
kubectl create secret generic aegis-secrets \
  --from-literal=supabase-url=https://your-project.supabase.co \
  --from-literal=supabase-anon-key=YOUR_KEY \
  --from-literal=supabase-service-key=YOUR_KEY \
  --from-literal=encryption-key=$(openssl rand -hex 32) \
  --from-literal=chat-encryption-key=$(openssl rand -hex 32) \
  -n aegis
```

#### 3. Deploy Application

```bash
# Update image references in deployment.yaml
sed -i 's|aegis-ai/|your-registry.com/aegis/|g' kubernetes/deployment.yaml

# Apply manifests
kubectl apply -f kubernetes/deployment.yaml -n aegis
kubectl apply -f kubernetes/ingress.yaml -n aegis

# Check deployment status
kubectl get deployments -n aegis
kubectl get services -n aegis
kubectl get ingress -n aegis

# Check pod status
kubectl get pods -n aegis
kubectl logs -f deployment/aegis-frontend -n aegis
kubectl logs -f deployment/aegis-backend -n aegis
```

#### 4. Verify Deployment

```bash
# Check all resources
kubectl get all -n aegis

# Test frontend
kubectl port-forward svc/aegis-frontend 8080:80 -n aegis
# Access http://localhost:8080

# Test backend
kubectl port-forward svc/aegis-backend 3001:3001 -n aegis
# Access http://localhost:3001/api/health

# Check ingress
kubectl describe ingress aegis-ingress -n aegis
```

### Scaling

```bash
# Manually scale deployments
kubectl scale deployment aegis-frontend --replicas=5 -n aegis
kubectl scale deployment aegis-backend --replicas=5 -n aegis

# HPA will automatically scale based on metrics (configured in ingress.yaml)
kubectl get hpa -n aegis
kubectl describe hpa aegis-frontend-hpa -n aegis
```

### Health Checks

```bash
# Check cluster health
kubectl cluster-info

# Check pod health
kubectl get pods -n aegis --field-selector=status.phase!=Running

# Check events for errors
kubectl get events -n aegis --sort-by='.lastTimestamp'

# Describe problematic resources
kubectl describe pod <pod-name> -n aegis
kubectl logs <pod-name> -n aegis
```

### Updates & Rollbacks

```bash
# Update image (rolling update)
kubectl set image deployment/aegis-backend \
  backend=your-registry.com/aegis/backend:1.1.0 \
  -n aegis

# Monitor rollout
kubectl rollout status deployment/aegis-backend -n aegis

# Rollback to previous version
kubectl rollout undo deployment/aegis-backend -n aegis

# View rollout history
kubectl rollout history deployment/aegis-backend -n aegis
```

---

## 🔐 Security Best Practices

### Image Security

```bash
# Scan images for vulnerabilities
trivy image your-registry.com/aegis/backend:1.0.0

# Sign images (optional but recommended)
cosign sign --key cosign.key your-registry.com/aegis/backend:1.0.0

# Use image pull policy and imagePullSecrets
# (configured in deployment.yaml)
```

### Pod Security

```bash
# Apply Pod Security Standards
kubectl label namespace aegis \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted

# Check SecurityContext in deployment.yaml
# - runAsNonRoot: true
# - allowPrivilegeEscalation: false
# - readOnlyRootFilesystem: true
```

### Network Security

```bash
# NetworkPolicy is configured in ingress.yaml
# Restricts pod-to-pod communication

# View network policies
kubectl get networkpolicies -n aegis
kubectl describe networkpolicy aegis-network-policy -n aegis
```

### Secrets Management

```bash
# Use external secrets (recommended for production)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace

# Or use sealed secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml -n kube-system
```

---

## 📊 Monitoring & Logging

### Prometheus Metrics

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace

# Access Prometheus dashboard
kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring
# Visit http://localhost:9090
```

### Logging Stack

```bash
# Install Loki Stack
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  -n logging \
  --create-namespace \
  -f loki-values.yaml

# View logs
kubectl logs -f deployment/aegis-backend -n aegis
```

### Grafana Dashboards

```bash
# Install Grafana
helm install grafana grafana/grafana \
  -n monitoring \
  --set adminPassword=<your-password>

# Port forward
kubectl port-forward svc/grafana 3000:80 -n monitoring
# Visit http://localhost:3000
```

---

## 🚨 Troubleshooting

### Pod Crashes

```bash
# Check pod events
kubectl describe pod <pod-name> -n aegis

# View logs
kubectl logs <pod-name> -n aegis
kubectl logs <pod-name> -n aegis --previous

# Check resource limits
kubectl top pod <pod-name> -n aegis
```

### Database Connection Issues

```bash
# Verify secrets
kubectl get secret aegis-secrets -n aegis -o yaml

# Test connectivity
kubectl exec -it deployment/aegis-backend -n aegis -- \
  node -e "console.log(process.env.VITE_SUPABASE_URL)"
```

### Ingress Issues

```bash
# Check ingress status
kubectl describe ingress aegis-ingress -n aegis

# Check cert status
kubectl describe certificate aegis-tls-cert -n aegis
kubectl get certificaterequest -n aegis

# Verify DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup aegis-ai.co.za

# Test ingress connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://aegis-frontend -H "Host: aegis-ai.co.za"
```

---

## 🧹 Cleanup

```bash
# Delete application
kubectl delete namespace aegis

# Delete ingress controller
helm uninstall ingress-nginx -n ingress-nginx

# Delete cert-manager
helm uninstall cert-manager -n cert-manager
kubectl delete namespace ingress-nginx cert-manager

# Delete monitoring stack
helm uninstall prometheus -n monitoring
helm uninstall loki -n logging
```

---

## 📋 Checklist

- [ ] Docker images built and pushed to registry
- [ ] Kubernetes cluster configured and accessible
- [ ] Secrets created and populated with actual values
- [ ] Cert-manager and Ingress controller installed
- [ ] Domain DNS records pointing to ingress IP
- [ ] TLS certificate issued and active
- [ ] Frontend accessible via HTTPS
- [ ] Backend API responding to requests
- [ ] Monitoring and logging configured
- [ ] Backups and disaster recovery tested
- [ ] Security scanning passed
- [ ] Load testing completed

---

## 🤝 Support

For issues or questions:
1. Check troubleshooting section above
2. Review Kubernetes events: `kubectl get events -n aegis`
3. Check application logs: `kubectl logs -f deployment/aegis-<service>`
4. Contact the development team

---

**Last Updated**: February 2026  
**Kubernetes Version**: 1.24+  
**Image Registry**: configurable via environment
