# AEGIS-AI System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Web App    │  │  Mobile PWA  │  │  USSD/SMS    │  │  WhatsApp    │   │
│  │  (React +    │  │  (Offline    │  │  (Feature    │  │  Integration │   │
│  │   Vite)      │  │   Support)   │  │   Phone)     │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │                  │            │
└─────────┼─────────────────┼──────────────────┼──────────────────┼────────────┘
          │                 │                  │                  │
          └─────────────────┴──────────────────┴──────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Express.js API Server                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Helmet     │  │    CORS      │  │  Rate Limit  │                 │ │
│  │  │  (Security)  │  │  (Origin)    │  │  (Redis)     │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  │                                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │     JWT      │  │     MFA      │  │  Validation  │                 │ │
│  │  │    Auth      │  │   (TOTP)     │  │    (Joi)     │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │   Route Handlers    │  │   Business Logic    │  │   Workflows        │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├────────────────────┤  │
│  │ • USSD Routes       │  │ • Risk Scoring      │  │ • Escalation       │  │
│  │ • Escalation Routes │  │ • Geo Matching      │  │ • Case Assignment  │  │
│  │ • Intelligence      │  │ • Intelligence      │  │ • Notification     │  │
│  │ • WhatsApp Routes   │  │ • Analytics         │  │ • Alert Dispatch   │  │
│  │ • AGI Governance    │  │ • Prediction        │  │                    │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────┘  │
│                                                                               │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   Security       │  │   Intelligence   │  │   Communication  │          │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤          │
│  │ • Encryption     │  │ • Risk Scoring   │  │ • Twilio (SMS)   │          │
│  │   (AES-256-GCM)  │  │ • Geo Matching   │  │ • WhatsApp       │          │
│  │ • MFA Service    │  │ • ML Prediction  │  │ • USSD Gateway   │          │
│  │ • Audit Logging  │  │ • Pattern Detect │  │ • Email          │          │
│  │ • Session Mgmt   │  │ • Anomaly Detect │  │                  │          │
│  │ • Intrusion Det  │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   Compliance     │  │   Observability  │  │   Real-time      │          │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤          │
│  │ • GDPR Module    │  │ • Error Tracking │  │ • WebSocket      │          │
│  │ • POPIA Module   │  │ • Monitoring     │  │ • Event Bus      │          │
│  │ • Data Rights    │  │ • Logging        │  │ • Redis Pub/Sub  │          │
│  │ • Retention      │  │ • Metrics        │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Supabase (PostgreSQL)                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   Cases    │  │  Profiles  │  │ Escalation │  │   Audit    │    │   │
│  │  │            │  │            │  │   Events   │  │    Logs    │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   USSD     │  │ Notification│ │   Alerts   │  │ Resources  │    │   │
│  │  │  Sessions  │  │   Queue    │  │            │  │            │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│  │                                                                       │   │
│  │  Features: RLS Policies, PII Encryption, Triggers, Functions        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Redis Cache & Queue                              │   │
│  │  • Session Storage  • Rate Limiting  • WebSocket Adapter             │   │
│  │  • Offline Cache    • Job Queue      • Pub/Sub Messaging             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MONITORING & OBSERVABILITY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Prometheus  │  │   Grafana    │  │   Datadog    │  │    Sentry    │   │
│  │  (Metrics)   │  │ (Dashboard)  │  │   (APM)      │  │   (Errors)   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ AlertManager │  │  Custom Log  │                                         │
│  │  (Alerts)    │  │  Aggregation │                                         │
│  └──────────────┘  └──────────────┘                                         │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT & INFRASTRUCTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Kubernetes Cluster                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │  Frontend  │  │   Backend  │  │ PostgreSQL │  │   Redis    │    │   │
│  │  │    Pod     │  │    Pod     │  │ StatefulSet│  │StatefulSet │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│  │                                                                       │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │   │
│  │  │  Ingress   │  │ ConfigMaps │  │  Secrets   │                     │   │
│  │  │ Controller │  │            │  │            │                     │   │
│  │  └────────────┘  └────────────┘  └────────────┘                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CI/CD Pipeline                                   │   │
│  │  GitHub Actions → Build → Test → Security Scan → Deploy             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Client Layer
- **Web Application**: React + TypeScript + Vite with PWA support
- **Mobile Support**: Offline-first architecture with service workers
- **USSD Interface**: Feature phone accessibility for low-connectivity areas
- **WhatsApp Integration**: Conversational interface for reporting

### 2. API Gateway
- **Security**: Helmet.js, CORS, Rate Limiting (Redis-backed)
- **Authentication**: JWT with refresh tokens, MFA (TOTP)
- **Validation**: Joi schema validation

### 3. Application Services
- **Risk Scoring Engine**: ML-based threat assessment
- **Geo Matching**: Location-based resource allocation
- **Escalation Workflow**: Automated case prioritization
- **Intelligence Module**: Pattern detection and analytics

### 4. Security & Compliance
- **Encryption**: AES-256-GCM for PII
- **Audit Logging**: Immutable blockchain-style logs
- **GDPR/POPIA**: Data rights and retention policies
- **Intrusion Detection**: Real-time threat monitoring

### 5. Data Storage
- **Primary DB**: Supabase (PostgreSQL) with RLS
- **Cache**: Redis for sessions, rate limiting, queues
- **Offline Storage**: Local IndexedDB with sync

### 6. Monitoring
- **Metrics**: Prometheus + Grafana
- **APM**: Datadog
- **Error Tracking**: Sentry
- **Logging**: Structured JSON logs

## Key Features

### Security
- End-to-end encryption
- Multi-factor authentication
- Role-based access control (RBAC)
- Session anomaly detection
- Audit trail with chain verification

### Intelligence
- Risk scoring algorithms
- Geo-spatial matching
- Predictive analytics
- Pattern recognition
- Anomaly detection

### Communication
- SMS/USSD (Twilio + Telkom)
- WhatsApp Business API
- Real-time WebSocket notifications
- Email alerts

### Compliance
- GDPR data rights
- POPIA compliance
- Data retention policies
- Consent management
- Right to erasure

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Supabase), Redis |
| Auth | JWT, TOTP MFA, Supabase Auth |
| Real-time | Socket.io, Redis Adapter |
| ML/AI | Xenova Transformers, Custom Risk Models |
| Monitoring | Prometheus, Grafana, Datadog, Sentry |
| Deployment | Docker, Kubernetes, GitHub Actions |
| Security | Helmet, CORS, Rate Limiting, AES-256-GCM |

## Scalability Features

1. **Horizontal Scaling**: Kubernetes pod autoscaling
2. **Load Balancing**: Ingress controller with multiple replicas
3. **Caching**: Redis for session and data caching
4. **Database**: Connection pooling and read replicas
5. **WebSocket**: Redis adapter for multi-instance support
6. **Queue**: Background job processing with Redis
7. **CDN**: Static asset distribution
8. **Monitoring**: Real-time performance tracking
