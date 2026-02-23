# Docker Setup Guide - AEGIS-AI Platform

Complete Docker containerization for the AEGIS-AI GBV Protection Platform.

---

## 📋 Prerequisites

- **Docker Desktop** (v20.10+) - [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (v1.29+) - Usually included with Docker Desktop
- **.env file** with production keys configured
- **Port availability**: 8080 (frontend), 3001 (backend), 5432 (postgres), 6379 (redis)

Verify installation:
```bash
docker --version
docker compose --version
```

---

## 🚀 Quick Start (Development)

### 1. Build and Run with Docker Compose

```bash
# Clone or navigate to project directory
cd intelligence-secure-scalable

# Build images from scratch
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service health
docker compose ps
```

### 2. Verify Services

```bash
# Frontend health check
curl http://localhost:8080

# Backend health check
curl http://localhost:3001/api/health

# WebSocket connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3001/socket.io
```

### 3. Access Applications

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001/api
- **API Health**: http://localhost:3001/api/health

### 4. Stop Services

```bash
# Stop all containers
docker compose down

# Stop and remove volumes
docker compose down -v

# Stop without removing
docker compose stop

# Resume after stop
docker compose up
```

---

## 🏭 Production Deployment

### 1. Configure Environment Variables

Create `.env.prod` file:

```bash
# Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Encryption (from generate-keys.cjs output)
ENCRYPTION_KEY=3eb5831576f62e6a6fb512053855b7bc20c0c0431dd816aef6516699cee558a0
CHAT_ENCRYPTION_KEY=be8af519809efcc7e7ed740d15ba5c2329abf93de1a52e34b2c6df6c1a82fb76

# API Configuration
CORS_ORIGIN=https://yourdomain.com

# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number

# Sentry Error Tracking (optional)
SENTRY_DSN=your_sentry_dsn

# Database
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password

# MFA
MFA_ISSUER=AEGIS
```

### 2. Build Production Images

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Tag for registry
docker tag aegis-frontend:latest your-registry/aegis-frontend:latest
docker tag aegis-backend:latest your-registry/aegis-backend:latest

# Push to registry (Docker Hub, ECR, GCR, etc.)
docker push your-registry/aegis-frontend:latest
docker push your-registry/aegis-backend:latest
```

### 3. Deploy Production Stack

```bash
# Load environment from .env.prod
export $(cat .env.prod | xargs)

# Start production services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Check health
docker compose -f docker-compose.prod.yml ps
```

### 4. Monitor Production

```bash
# View real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Inspect service
docker compose -f docker-compose.prod.yml exec backend npm run typecheck

# Execute command in container
docker compose -f docker-compose.prod.yml exec backend node -e "console.log('Server OK')"

# Backup database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U aegis aegis_cache > backup.sql
```

---

## 🔧 Common Commands

### Image Management

```bash
# List all images
docker images

# Remove image
docker rmi aegis-frontend:latest

# Remove unused images
docker image prune -a

# Inspect image
docker inspect aegis-backend:latest

# Tag image
docker tag aegis-backend:latest aegis-backend:v1.0.0
```

### Container Management

```bash
# List containers
docker ps -a

# View container logs
docker logs -f aegis-backend-dev

# Execute command in running container
docker exec -it aegis-backend-dev sh

# Copy files from container
docker cp aegis-backend-dev:/app/dist ./local-dist

# Restart service
docker compose restart backend
```

### Network & Debugging

```bash
# List networks
docker network ls

# Inspect network
docker network inspect aegis-network

# Check container IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' aegis-backend-dev

# Test connectivity between containers
docker compose exec frontend wget http://backend:3001/api/health
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect intelligence-secure-scalable_postgres_data

# Clean up unused volumes
docker volume prune

# Backup volume
docker run --rm -v aegis_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

---

## 📊 Docker Compose Services

### Frontend
- **Image**: Built from `Dockerfile.frontend`
- **Port**: 8080
- **Base**: Nginx Alpine
- **Health Check**: HTTP GET / (30s interval)

### Backend
- **Image**: Built from `Dockerfile.backend`
- **Port**: 3001
- **Base**: Node 22 Alpine
- **Health Check**: HTTP /api/health (30s interval)
- **Volumes** (dev): Server code hot-reload

### PostgreSQL (Production)
- **Image**: postgres:16-alpine
- **Port**: 5432
- **Volume**: postgres_data
- **Health Check**: pg_isready

### Redis (Production)
- **Image**: redis:7-alpine
- **Port**: 6379
- **Volume**: redis_data
- **Health Check**: redis-cli ping

---

## 🔐 Security Best Practices

### Development

```bash
# Use .env file (never commit!)
# Keep ENCRYPTION_KEY and credentials secure
# Don't expose ports unnecessarily
```

### Production

```bash
# Use Docker secrets for sensitive data
docker secret create encryption_key -
docker secret create db_password -

# Use read-only root filesystem
# Drop unnecessary capabilities
# Run as non-root user
# Enable security scanning
docker scan aegis-backend:latest

# Use private registry
# Enable image signing
# Scan for vulnerabilities regularly
```

### Network Security

```bash
# Use internal networks (not exposed)
# Enable firewall rules
# Use TLS/SSL for external connections
# Implement rate limiting at gateway
```

---

## 🚨 Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs backend

# Validate compose file
docker compose config

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

### Port conflicts

```bash
# Find process using port
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Change port in docker-compose.yml
# Or stop conflicting service
docker stop container_name
```

### Database connectivity

```bash
# Test from backend container
docker compose exec backend ping postgres

# Check environment variables
docker compose exec backend env | grep POSTGRES

# Test psql connection
docker compose exec postgres psql -U aegis -d aegis_cache -c "SELECT 1;"
```

### Memory/CPU issues

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

---

## 📈 Scaling in Production

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
    # Requires swarm or Kubernetes
```

### Using Kubernetes

```bash
# Export compose to Kubernetes manifests
kompose convert -f docker-compose.prod.yml

# Deploy to Kubernetes
kubectl apply -f backend-service.yaml
kubectl apply -f frontend-service.yaml
```

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml aegis

# Scale service
docker service scale aegis_backend=3

# Monitor
docker service ls
docker service ps aegis_backend
```

---

## 📦 CI/CD Integration

### GitHub Actions

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      
      - name: Login to Docker Hub
        uses: docker/login-action@v1
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push Backend
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.backend
          push: true
          tags: your-org/aegis-backend:latest
      
      - name: Build and push Frontend
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.frontend
          push: true
          tags: your-org/aegis-frontend:latest
```

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)

---

## ✅ Deployment Checklist

- [ ] All environment variables configured in `.env.prod`
- [ ] Encryption keys generated and stored securely
- [ ] Database credentials updated
- [ ] Docker images built and tested locally
- [ ] Images pushed to private registry
- [ ] Network and firewall rules configured
- [ ] Health checks passing for all services
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan tested
- [ ] SSL/TLS certificates installed
- [ ] CORS and security headers verified

---

Generated: 2026-02-22
Status: PRODUCTION READY
