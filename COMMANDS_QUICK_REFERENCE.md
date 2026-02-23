# AEGIS-AI Commands Quick Reference

## 🚀 START APPLICATION (Pick One)

### Option 1: Easiest (Windows Explorer)
1. Open: `c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable`
2. Double-click: `start-docker.bat`
3. Wait 30 seconds

### Option 2: PowerShell
```powershell
cd 'c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable'
docker compose up --build
```

### Option 3: Git Bash
```bash
cd "/c/Users/mudau/Desktop/New Apps/intelligence-secure-scalable"
docker-compose up --build
```

---

## 🌐 TEST APPLICATION

| Service | URL | Expected |
|---------|-----|----------|
| Frontend | http://localhost:8080 | AEGIS-AI page loads |
| Backend | http://localhost:3001/api/health | `{"status":"ok"}` |

---

## 🐳 DOCKER COMMANDS

```powershell
# View running containers
docker-compose ps

# View logs
docker-compose logs

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services (keep data)
docker-compose down

# Stop and delete everything
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Rebuild and start
docker-compose up --build

# Start in background
docker-compose up -d --build
```

---

## 📦 BUILD IMAGES FOR PRODUCTION

```bash
# Build images
bash scripts/docker-build.sh --version 1.0.0

# Build and push to registry
bash scripts/docker-build.sh --version 1.0.0 --push

# Build with security scanning
bash scripts/docker-build.sh --version 1.0.0 --scan --push
```

---

## ✅ PRE-DEPLOYMENT CHECKLIST

```bash
# Run validation
bash scripts/pre-deployment-checklist.sh
```

Checks:
- TypeScript strict mode
- ESLint compliance
- Secret exposure scan
- Dependencies (Docker, Node, npm)
- Environment configuration
- Database migrations
- Testing setup
- Security configuration

---

## 🔐 SECURITY COMMANDS

```powershell
# Rotate Supabase keys
# Go to: https://app.supabase.com
# Settings → API Keys → Regenerate

# Generate new encryption key
openssl rand -hex 32

# Scan Docker image for vulnerabilities
trivy image aegis-ai/backend:1.0.0
```

---

## 📊 KUBERNETES COMMANDS

```bash
# Create namespace
kubectl create namespace aegis

# Deploy application
kubectl apply -f kubernetes/deployment.yaml -n aegis

# Check deployments
kubectl get deployments -n aegis
kubectl get services -n aegis
kubectl get pods -n aegis

# View logs
kubectl logs -f deployment/aegis-backend -n aegis

# Scale replicas
kubectl scale deployment aegis-frontend --replicas=5 -n aegis

# Port forward for testing
kubectl port-forward svc/aegis-frontend 8080:80 -n aegis

# Delete deployment
kubectl delete namespace aegis
```

---

## 🧪 DEVELOPMENT COMMANDS

```powershell
# Install dependencies
npm install

# Run dev server (standalone, no Docker)
npm run dev

# TypeScript check
npm run typecheck

# Lint code
npm run lint

# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔧 TROUBLESHOOTING COMMANDS

```powershell
# Check Docker version
docker --version
docker compose version

# Check if Docker is running
docker ps

# Check port usage
netstat -ano | findstr :8080
netstat -ano | findstr :3001

# Kill process using port (replace PID)
taskkill /PID 1234 /F

# Clean Docker system
docker system prune
docker system prune -a
docker volume prune

# View Docker Desktop logs
# Open Docker Desktop → Troubleshoot → View logs

# Restart Docker Desktop
# Close Docker Desktop and reopen
```

---

## 📝 ENVIRONMENT SETUP

```powershell
# View current environment
Get-Content .env

# Test environment variables
Write-Host $env:VITE_SUPABASE_URL

# Set temporary environment variable
$env:VITE_API_URL="http://localhost:3001/api"

# Test Supabase connection
curl https://jtohnfeqztmiamqmaiod.supabase.co
```

---

## 📚 DOCUMENTATION COMMANDS

```powershell
# Read key documentation
Get-Content WINDOWS_DEPLOYMENT_START.md
Get-Content QUICK_START.md
Get-Content CRITICAL_ISSUES_SUMMARY.md
Get-Content ROLE_BASED_NAVIGATION.md

# View file list
Get-ChildItem -Filter "*.md"
Get-ChildItem -Filter "Dockerfile*"
Get-ChildItem scripts\
```

---

## 🚨 EMERGENCY COMMANDS

```powershell
# Complete reset
docker-compose down -v
docker system prune -a
docker-compose up --build

# Free up disk space
docker image prune
docker volume prune
docker container prune

# Kill all Docker containers
docker kill $(docker ps -q)

# Remove all unused resources
docker system prune -a --volumes
```

---

## 🔄 GIT COMMANDS

```bash
# Rotate secrets (remove from history)
# Install BFG: brew install bfg (macOS) or https://rclone.org/downloads/

git clone --mirror https://github.com/YOUR_ORG/intelligence-secure-scalable.git temp-clone
cd temp-clone
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin
```

---

## 📱 MOBILE TESTING

```powershell
# Get your local IP
ipconfig

# Access from phone on same network
# http://<YOUR_IP>:8080

# Example if IP is 192.168.1.100:
# http://192.168.1.100:8080
```

---

## 🌍 DEPLOYMENT TO CLOUD

```bash
# Deploy to Kubernetes cluster
kubectl apply -f kubernetes/deployment.yaml -n aegis
kubectl apply -f kubernetes/ingress.yaml -n aegis

# Deploy to Docker Swarm
docker stack deploy -c docker-compose.prod.yml aegis

# Deploy to AWS/Azure/GCP
# See DEPLOYMENT_GUIDE.md for cloud-specific instructions
```

---

## 💾 BACKUP & RESTORE

```bash
# Backup PostgreSQL database
docker-compose exec postgres pg_dump -U postgres aegis > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres aegis < backup.sql

# Backup volumes
docker run --rm -v aegis-data:/data -v $(pwd):/backup alpine tar czf /backup/volumes.tar.gz -C /data .

# Restore volumes
docker run --rm -v aegis-data:/data -v $(pwd):/backup alpine tar xzf /backup/volumes.tar.gz -C /data
```

---

## 📊 MONITORING COMMANDS

```bash
# View container stats
docker stats

# View container health
docker inspect --format='{{.State.Health.Status}}' container-name

# View all logs with timestamp
docker-compose logs -f --timestamps

# Monitor specific service
watch 'docker-compose ps'
```

---

## 🎯 PHASE 1 SECURITY FIX COMMANDS

```bash
# 1. Rotate secrets
# Manual: Go to https://app.supabase.com → Settings → Regenerate

# 2. Clean Git history
bash scripts/pre-deployment-checklist.sh

# 3. Enable TypeScript strict mode
# Edit tsconfig.json: "strict": true

# 4. Run linting
npm run lint

# 5. Run type checking
npm run typecheck

# 6. Run tests
npm run test
```

---

## 🚀 ONE-LINER CHEATSHEET

```powershell
# Start everything
docker-compose up --build

# Stop everything
docker-compose down

# Rebuild everything
docker-compose down -v && docker-compose up --build

# View logs
docker-compose logs -f

# Scale backend to 3 replicas
kubectl scale deployment aegis-backend --replicas=3

# SSH into container
docker-compose exec backend bash

# Run command in container
docker-compose exec backend npm run build

# View environment
docker-compose exec backend env | grep VITE

# Cleanup
docker system prune -a --volumes
```

---

## 📖 NEXT STEPS

1. **Run**: `docker-compose up --build`
2. **Test**: http://localhost:8080 and http://localhost:3001/api/health
3. **Read**: `CRITICAL_ISSUES_SUMMARY.md`
4. **Plan**: Phase 1 security fixes (4 weeks)

---

**Last Updated**: February 22, 2026  
**For More Info**: See `WINDOWS_DEPLOYMENT_START.md` and `QUICK_START.md`
