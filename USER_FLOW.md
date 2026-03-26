# AEGIS-AI User Flow Documentation

## Overview
AEGIS-AI supports multiple user roles with distinct workflows for Gender-Based Violence (GBV) case management, intelligence gathering, and resource coordination.

---

## User Roles

1. **Survivor** - Victim seeking help and support
2. **Counselor** - Provides psychological support
3. **Police Officer** - Handles legal/criminal aspects
4. **NGO Worker** - Coordinates resources and support
5. **Justice Official** - Manages legal proceedings
6. **Analyst** - Reviews data and patterns
7. **Admin** - System administration
8. **Policy Maker** - Views aggregated insights

---

## 1. Survivor User Flow

### A. Initial Access (Multiple Channels)

```
┌─────────────────────────────────────────────────────────────┐
│                    SURVIVOR ENTRY POINTS                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Web/Mobile  │    │  USSD Code   │    │  WhatsApp    │
│   Browser    │    │  *120*XXX#   │    │   Message    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  Landing Page   │
                  │  • Anonymous    │
                  │  • Secure       │
                  │  • Multi-lang   │
                  └────────┬────────┘
                           │
                           ▼
```

### B. Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRATION PROCESS                      │
└─────────────────────────────────────────────────────────────┘

Step 1: Choose Registration Method
┌──────────────────────────────────────┐
│  • Anonymous (No personal info)      │
│  • Username-based (Pseudonym)        │
│  • Phone number (SMS verification)   │
└──────────────┬───────────────────────┘
               │
               ▼
Step 2: Create Secure Credentials
┌──────────────────────────────────────┐
│  • Set password (min 8 chars)        │
│  • Optional: Enable MFA (TOTP)       │
│  • Security questions                │
└──────────────┬───────────────────────┘
               │
               ▼
Step 3: Profile Setup
┌──────────────────────────────────────┐
│  • Preferred language                │
│  • Location (optional, for matching) │
│  • Communication preferences         │
│  • Consent acknowledgment            │
└──────────────┬───────────────────────┘
               │
               ▼
Step 4: Safety Planning
┌──────────────────────────────────────┐
│  • Set up quick exit button          │
│  • Emergency contacts                │
│  • Safe word/phrase                  │
│  • Disguise mode settings            │
└──────────────┬───────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  Dashboard   │
        └──────────────┘
```

### C. Case Reporting Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REPORT INCIDENT                           │
└─────────────────────────────────────────────────────────────┘

Step 1: Initiate Report
┌──────────────────────────────────────┐
│  Dashboard → "Report Incident"       │
│  • Quick Report (Emergency)          │
│  • Detailed Report (Safe)            │
└──────────────┬───────────────────────┘
               │
               ▼
Step 2: Incident Details
┌──────────────────────────────────────┐
│  • Type of violence                  │
│  • Date/time of incident             │
│  • Location (optional)               │
│  • Description (text/voice)          │
│  • Evidence upload (photos/docs)     │
└──────────────┬───────────────────────┘
               │
               ▼
Step 3: Risk Assessment (Auto)
┌──────────────────────────────────────┐
│  System analyzes:                    │
│  • Severity indicators               │
│  • Pattern matching                  │
│  • Geographic risk factors           │
│  • Historical data                   │
│  → Risk Score: Low/Medium/High       │
└──────────────┬───────────────────────┘
               │
               ▼
Step 4: Immediate Response
┌──────────────────────────────────────┐
│  IF High Risk:                       │
│  • Auto-escalate to police           │
│  • Notify emergency contacts         │
│  • Provide safety resources          │
│                                      │
│  IF Medium/Low Risk:                 │
│  • Assign counselor                  │
│  • Provide support resources         │
│  • Schedule follow-up                │
└──────────────┬───────────────────────┘
               │
               ▼
Step 5: Case Created
┌──────────────────────────────────────┐
│  • Case ID generated                 │
│  • Encrypted and stored              │
│  • Notifications sent                │
│  • Survivor receives confirmation    │
└──────────────┬───────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  Track Case  │
        └──────────────┘
```

### D. Ongoing Support Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SURVIVOR DASHBOARD                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│  My Cases                            │
│  ├─ Active Cases (status tracking)   │
│  ├─ Messages (secure chat)           │
│  ├─ Appointments (calendar)          │
│  └─ Documents (encrypted storage)    │
└──────────────┬───────────────────────┘
               │
┌──────────────┴───────────────────────┐
│  Resources                           │
│  ├─ Safety Planning                  │
│  ├─ Legal Information                │
│  ├─ Support Groups                   │
│  ├─ Hotlines                         │
│  └─ Nearby Services (geo-matched)    │
└──────────────┬───────────────────────┘
               │
┌──────────────┴───────────────────────┐
│  Communication                       │
│  ├─ Chat with Counselor              │
│  ├─ Video Call (scheduled)           │
│  ├─ Voice Messages                   │
│  └─ Anonymous Forum                  │
└──────────────────────────────────────┘
```

---

## 2. Counselor User Flow

### A. Login & Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    COUNSELOR WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

Login → MFA Verification → Dashboard

┌──────────────────────────────────────┐
│  Dashboard Overview                  │
│  ├─ Assigned Cases (priority queue)  │
│  ├─ Pending Messages                 │
│  ├─ Today's Appointments             │
│  ├─ Alerts & Notifications           │
│  └─ Performance Metrics              │
└──────────────┬───────────────────────┘
               │
               ▼
```

### B. Case Management Flow

```
Step 1: Case Assignment
┌──────────────────────────────────────┐
│  • Auto-assigned based on:           │
│    - Availability                    │
│    - Specialization                  │
│    - Geographic proximity            │
│    - Workload balance                │
│  • Notification received             │
└──────────────┬───────────────────────┘
               │
               ▼
Step 2: Initial Assessment
┌──────────────────────────────────────┐
│  • Review case details               │
│  • Check risk score                  │
│  • Review survivor profile           │
│  • Identify immediate needs          │
└──────────────┬───────────────────────┘
               │
               ▼
Step 3: Create Support Plan
┌──────────────────────────────────────┐
│  • Set goals and milestones          │
│  • Schedule sessions                 │
│  • Coordinate with other services    │
│  • Document plan (encrypted)         │
└──────────────┬───────────────────────┘
               │
               ▼
Step 4: Ongoing Support
┌──────────────────────────────────────┐
│  • Conduct sessions (chat/video)     │
│  • Update case notes                 │
│  • Monitor progress                  │
│  • Adjust support plan               │
│  • Escalate if needed                │
└──────────────┬───────────────────────┘
               │
               ▼
Step 5: Case Closure
┌──────────────────────────────────────┐
│  • Final assessment                  │
│  • Closure documentation             │
│  • Follow-up plan                    │
│  • Archive case                      │
└──────────────────────────────────────┘
```

---

## 3. Police Officer User Flow

### A. Case Reception

```
┌─────────────────────────────────────────────────────────────┐
│                    POLICE WORKFLOW                           │
└─────────────────────────────────────────────────────────────┘

Step 1: Alert Received
┌──────────────────────────────────────┐
│  • High-risk case escalated          │
│  • SMS/App notification              │
│  • Case details (encrypted)          │
└──────────────┬───────────────────────┘
               │
               ▼
Step 2: Case Review
┌──────────────────────────────────────┐
│  • Risk assessment details           │
│  • Incident information              │
│  • Evidence (if available)           │
│  • Location data                     │
└──────────────┬───────────────────────┘
               │
               ▼
Step 3: Action Decision
┌──────────────────────────────────────┐
│  Options:                            │
│  • Accept case (immediate action)    │
│  • Request more information          │
│  • Coordinate with other units       │
│  • Escalate to specialized unit      │
└──────────────┬───────────────────────┘
               │
               ▼
Step 4: Investigation
┌──────────────────────────────────────┐
│  • Update case status                │
│  • Add investigation notes           │
│  • Upload evidence                   │
│  • Coordinate with justice system    │
│  • Communicate with survivor         │
└──────────────┬───────────────────────┘
               │
               ▼
Step 5: Case Resolution
┌──────────────────────────────────────┐
│  • Final report                      │
│  • Legal proceedings initiated       │
│  • Case handoff to justice           │
│  • Update all stakeholders           │
└──────────────────────────────────────┘
```

---

## 4. NGO Worker User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    NGO WORKER WORKFLOW                       │
└─────────────────────────────────────────────────────────────┘

Dashboard
├─ Resource Management
│  ├─ Available services
│  ├─ Capacity tracking
│  ├─ Inventory management
│  └─ Partner coordination
│
├─ Case Coordination
│  ├─ Referrals received
│  ├─ Service provision
│  ├─ Progress tracking
│  └─ Multi-agency collaboration
│
├─ Community Outreach
│  ├─ Awareness campaigns
│  ├─ Training programs
│  ├─ Support groups
│  └─ Prevention initiatives
│
└─ Reporting
   ├─ Service delivery metrics
   ├─ Impact assessment
   ├─ Funding reports
   └─ Stakeholder updates
```

---

## 5. Analyst User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ANALYST WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘

Dashboard
├─ Data Analytics
│  ├─ Trend analysis
│  ├─ Pattern detection
│  ├─ Geographic hotspots
│  ├─ Temporal patterns
│  └─ Risk factor correlation
│
├─ Intelligence Reports
│  ├─ Weekly summaries
│  ├─ Monthly trends
│  ├─ Predictive insights
│  ├─ Anomaly alerts
│  └─ Custom reports
│
├─ Visualization
│  ├─ Interactive dashboards
│  ├─ Heat maps
│  ├─ Time series charts
│  ├─ Network graphs
│  └─ Export capabilities
│
└─ Recommendations
   ├─ Resource allocation
   ├─ Prevention strategies
   ├─ Policy suggestions
   └─ System improvements
```

---

## 6. Admin User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN WORKFLOW                            │
└─────────────────────────────────────────────────────────────┘

Dashboard
├─ User Management
│  ├─ Create/edit users
│  ├─ Role assignment
│  ├─ Access control
│  ├─ MFA enforcement
│  └─ Account suspension
│
├─ System Configuration
│  ├─ Organization settings
│  ├─ Integration setup
│  ├─ Notification rules
│  ├─ Escalation policies
│  └─ Security settings
│
├─ Monitoring
│  ├─ System health
│  ├─ Performance metrics
│  ├─ Security alerts
│  ├─ Audit logs
│  └─ Error tracking
│
└─ Compliance
   ├─ Data retention
   ├─ Privacy settings
   ├─ Consent management
   ├─ Audit reports
   └─ Regulatory compliance
```

---

## Cross-Cutting User Flows

### A. Emergency Escalation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    EMERGENCY ESCALATION                      │
└─────────────────────────────────────────────────────────────┘

Trigger Event (High Risk Detected)
        │
        ▼
┌──────────────────────────────────────┐
│  Automatic Actions (Parallel)        │
│  ├─ Alert police (SMS + App)         │
│  ├─ Notify emergency contacts        │
│  ├─ Assign crisis counselor          │
│  ├─ Activate safety protocol         │
│  └─ Log all actions (audit)          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Real-time Coordination              │
│  • WebSocket notifications           │
│  • Status updates                    │
│  • Resource mobilization             │
│  • Communication channel opened      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Response Tracking                   │
│  • Acknowledgment required           │
│  • Action timeline                   │
│  • Outcome documentation             │
│  • Post-incident review              │
└──────────────────────────────────────┘
```

### B. Multi-Agency Collaboration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    COLLABORATION WORKFLOW                    │
└─────────────────────────────────────────────────────────────┘

Case Requires Multiple Services
        │
        ▼
┌──────────────────────────────────────┐
│  Coordination Hub Created            │
│  • Shared case view (role-based)    │
│  • Secure messaging                  │
│  • Task assignment                   │
│  • Document sharing                  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Service Providers Join              │
│  • Counselor (psychological)         │
│  • Police (legal/safety)             │
│  • NGO (resources/shelter)           │
│  • Justice (legal proceedings)       │
│  • Medical (healthcare)              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Coordinated Response                │
│  • Each updates their section        │
│  • Real-time status sync             │
│  • Avoid duplication                 │
│  • Holistic support                  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Case Resolution                     │
│  • All services completed            │
│  • Survivor feedback                 │
│  • Lessons learned                   │
│  • Archive collaboration             │
└──────────────────────────────────────┘
```

### C. Offline-to-Online Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFLINE SUPPORT                           │
└─────────────────────────────────────────────────────────────┘

User in Low/No Connectivity Area
        │
        ▼
┌──────────────────────────────────────┐
│  Offline Mode Activated              │
│  • Local data cached (IndexedDB)     │
│  • Forms available offline           │
│  • Queue actions locally             │
│  • Visual indicator shown            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  User Actions Queued                 │
│  • Report incident                   │
│  • Send message                      │
│  • Update case                       │
│  • All timestamped                   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Connection Restored                 │
│  • Auto-detect connectivity          │
│  • Sync queue in order               │
│  • Conflict resolution               │
│  • Update local cache                │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Sync Complete                       │
│  • User notified                     │
│  • All data current                  │
│  • Queue cleared                     │
└──────────────────────────────────────┘
```

---

## Key User Experience Principles

### 1. Security & Privacy
- End-to-end encryption for all sensitive data
- Anonymous reporting options
- Quick exit/disguise mode
- No tracking of survivor location without consent

### 2. Accessibility
- Multi-channel access (web, mobile, USSD, WhatsApp)
- Multi-language support
- Screen reader compatible
- Low-bandwidth optimization

### 3. Trauma-Informed Design
- Non-judgmental language
- Clear, simple navigation
- Progress saving at each step
- Option to pause and return
- Empowering choices

### 4. Real-time Responsiveness
- Instant notifications for critical events
- WebSocket for live updates
- Status tracking for all actions
- Acknowledgment confirmations

### 5. Collaboration
- Role-based access control
- Secure inter-agency communication
- Shared case views (privacy-preserved)
- Coordinated workflows

---

## User Journey Metrics

### Survivor Journey
- Time to first response: < 5 minutes (high risk)
- Case assignment: < 30 minutes
- First counselor contact: < 24 hours
- Resource connection: < 48 hours

### Professional Journey
- Alert acknowledgment: < 2 minutes
- Case review: < 15 minutes
- Initial action: < 1 hour
- Case updates: Daily minimum

### System Performance
- Page load time: < 2 seconds
- Offline sync: < 30 seconds
- Notification delivery: < 5 seconds
- Search response: < 1 second
