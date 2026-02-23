# AEGIS-AI Phase 4 - Kubernetes Production Setup

**Estimated Time**: 4-6 hours  
**Prerequisites**: Kubernetes cluster (1.24+), kubectl configured, Helm (optional)

---

## 🎯 Objectives

1. Kubernetes deployment manifests
2. Service discovery and networking
3. ConfigMap & Secret management
4. StatefulSets for persistent services
5. Network policies and security
6. Resource limits and scaling

---

## 1. Namespace Setup

Create `kubernetes/01-namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aegis
  labels:
    name: aegis
    monitoring: enabled
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: aegis-quota
  namespace: aegis
spec:
  hard:
    requests.cpu: "100"
    requests.memory: "200Gi"
    limits.cpu: "200"
    limits.memory: "400Gi"
    pods: "100"
---
apiVersion: v1
kind: NetworkPolicy
metadata:
  name: aegis-default-deny
  namespace: aegis
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: v1
kind: NetworkPolicy
metadata:
  name: aegis-allow-internal
  namespace: aegis
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}
  egress:
  - to:
    - podSelector: {}
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

---

## 2. ConfigMap & Secrets

Create `kubernetes/02-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aegis-config
  namespace: aegis
data:
  ENVIRONMENT: "production"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  VITE_API_URL: "https://api.aegis-ai.co.za"
  VITE_DATADOG_ENABLED: "true"
  VITE_DATADOG_ENV: "production"
  VITE_DATADOG_VERSION: "1.0.0"
  VITE_DEPLOYMENT_REGION: "af-south-1"
  VITE_COUNTRY_CODE: "ZA"
  VITE_COMPLIANCE_FRAMEWORK: "POPIA"
  JWT_EXPIRY: "15m"
  REFRESH_TOKEN_EXPIRY: "7d"
  RATE_LIMIT_WINDOW_SECONDS: "900"
  RATE_LIMIT_MAX_REQUESTS: "50"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "aegis_db"
  CSP_REPORT_URI: "https://api.aegis-ai.co.za/api/csp-report"
---
apiVersion: v1
kind: Secret
metadata:
  name: aegis-secrets
  namespace: aegis
type: Opaque
stringData:
  VITE_SUPABASE_URL: "https://your-project.supabase.co"
  VITE_SUPABASE_KEY: "your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY: "your-service-role-key"
  ENCRYPTION_KEY: "your-32-byte-hex-key"
  CHAT_ENCRYPTION_KEY: "your-32-byte-hex-key"
  JWT_SECRET: "your-jwt-secret"
  REFRESH_TOKEN_SECRET: "your-refresh-token-secret"
  TELKOM_WEBHOOK_SECRET: "your-telkom-secret"
  REDIS_PASSWORD: "your-redis-password"
  DB_USER: "aegis_user"
  DB_PASSWORD: "your-database-password"
  DATADOG_API_KEY: "your-datadog-api-key"
  VITE_DATADOG_APPLICATION_ID: "your-datadog-app-id"
  VITE_DATADOG_CLIENT_TOKEN: "your-datadog-client-token"
---
apiVersion: v1
kind: Secret
metadata:
  name: tls-certificate
  namespace: aegis
type: kubernetes.io/tls
data:
  tls.crt: base64-encoded-certificate
  tls.key: base64-encoded-key
```

---

## 3. PostgreSQL StatefulSet

Create `kubernetes/03-postgres.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: aegis
  labels:
    app: postgres
spec:
  ports:
  - port: 5432
    targetPort: 5432
    name: postgres
  clusterIP: None
  selector:
    app: postgres
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: aegis
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: DB_PASSWORD
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 1
          failureThreshold: 3
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
          subPath: postgres
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: aegis
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
```

---

## 4. Redis StatefulSet

Create `kubernetes/04-redis.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: aegis
spec:
  ports:
  - port: 6379
    targetPort: 6379
  clusterIP: None
  selector:
    app: redis
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: aegis
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - "--requirepass"
        - "$(REDIS_PASSWORD)"
        - "--maxmemory"
        - "512mb"
        - "--maxmemory-policy"
        - "allkeys-lru"
        ports:
        - containerPort: 6379
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: REDIS_PASSWORD
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "500m"
            memory: "1Gi"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 1
          failureThreshold: 3
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 5Gi
      storageClassName: fast-ssd
```

---

## 5. API Backend Deployment

Create `kubernetes/05-api-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-api
  namespace: aegis
  labels:
    app: aegis-api
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: aegis-api
  template:
    metadata:
      labels:
        app: aegis-api
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: aegis-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - aegis-api
              topologyKey: kubernetes.io/hostname
      
      containers:
      - name: api
        image: aegis-api:latest
        imagePullPolicy: Always
        
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        - name: metrics
          containerPort: 3000
          protocol: TCP
        
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: PORT
        - name: VITE_SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: VITE_SUPABASE_URL
        - name: SUPABASE_SERVICE_ROLE_KEY
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: SUPABASE_SERVICE_ROLE_KEY
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: ENCRYPTION_KEY
        - name: CHAT_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: CHAT_ENCRYPTION_KEY
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: JWT_SECRET
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: REDIS_HOST
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: REDIS_PORT
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aegis-secrets
              key: REDIS_PASSWORD
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: DB_PORT
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: aegis-config
              key: LOG_LEVEL
        
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        startupProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 30
        
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          capabilities:
            drop:
            - ALL
        
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/.cache
      
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: aegis-api-service
  namespace: aegis
  labels:
    app: aegis-api
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: http
    protocol: TCP
    name: http
  - port: 3001
    targetPort: metrics
    protocol: TCP
    name: metrics
  selector:
    app: aegis-api
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: aegis-api-hpa
  namespace: aegis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: aegis-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 60
```

---

## 6. Frontend (React) Deployment

Create `kubernetes/06-frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-frontend
  namespace: aegis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aegis-frontend
  template:
    metadata:
      labels:
        app: aegis-frontend
    spec:
      containers:
      - name: frontend
        image: aegis-frontend:latest
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: aegis-frontend-service
  namespace: aegis
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: http
  selector:
    app: aegis-frontend
```

---

## 7. Ingress Configuration

Create `kubernetes/07-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aegis-ingress
  namespace: aegis
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - aegis-ai.co.za
    - api.aegis-ai.co.za
    secretName: tls-certificate
  rules:
  - host: aegis-ai.co.za
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: aegis-frontend-service
            port:
              number: 80
  - host: api.aegis-ai.co.za
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: aegis-api-service
            port:
              number: 3000
```

---

## 8. RBAC Configuration

Create `kubernetes/08-rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aegis-api
  namespace: aegis
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: aegis-api-role
  namespace: aegis
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: aegis-api-rolebinding
  namespace: aegis
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: aegis-api-role
subjects:
- kind: ServiceAccount
  name: aegis-api
  namespace: aegis
```

---

## 9. Deployment Commands

```bash
# Apply all manifests
kubectl apply -f kubernetes/

# Verify deployment
kubectl get ns aegis
kubectl get pods -n aegis
kubectl get svc -n aegis
kubectl get ingress -n aegis

# Check logs
kubectl logs -n aegis deployment/aegis-api --tail=100 -f

# Scale deployment
kubectl scale deployment aegis-api -n aegis --replicas=5

# Rolling update
kubectl set image deployment/aegis-api -n aegis api=aegis-api:v1.0.1

# Check resources
kubectl describe node
kubectl top pods -n aegis
```

---

## 10. Monitoring in Kubernetes

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring

# Install Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana -n monitoring

# Port forward for local access
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
kubectl port-forward svc/grafana 3000:80 -n monitoring
```

---

## ✅ Checklist

- [ ] Kubernetes manifests created
- [ ] ConfigMaps and Secrets configured
- [ ] PostgreSQL StatefulSet deployed
- [ ] Redis StatefulSet deployed
- [ ] API Deployment with HPA configured
- [ ] Frontend Deployment configured
- [ ] Ingress configured with TLS
- [ ] RBAC roles configured
- [ ] Network policies applied
- [ ] Health checks verified
- [ ] Monitoring integrated
- [ ] Auto-scaling tested

---

**Estimated Completion**: 4-6 hours  
**Next**: CI/CD Pipeline setup

