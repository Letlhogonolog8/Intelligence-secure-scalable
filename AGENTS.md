---
description: Repository Information Overview
alwaysApply: true
---

# AEGIS-AI Information

## Summary

AEGIS-AI is a single-repository, full-stack TypeScript application with a React/Vite frontend and a Node/Express backend. The project includes Supabase edge functions, monitoring configuration (Prometheus/Grafana), and deployment assets for Docker and Kubernetes.

## Structure

- **`src/`**: React frontend application (pages, components, hooks, stores, tests).
- **`server/`**: Node/Express backend (security, middleware, workflows, observability, routes).
- **`supabase/`**: Supabase edge functions and migrations.
- **`public/`**: Static frontend assets.
- **`config/`**: Monitoring configuration (Prometheus, Grafana provisioning, alerting).
- **`scripts/`**: Seed data and automation scripts.
- **`kubernetes/`**: Deployment, ingress, and supporting manifests.

## Language & Runtime

**Language**: TypeScript (frontend + backend)  
**Runtime**: Node.js (Dockerfiles use `node:20-alpine`)  
**Build System**: Vite + TypeScript compiler (`tsc`)  
**Package name**: `aegis-ai` (`package.json`)  
**Package Manager**: `npm` (package-lock.json present)

## Dependencies

**Main Dependencies**:

- React 18, React Router, TanStack Query
- Vite, Express, Socket.IO
- Supabase JS, PostgreSQL (`pg`), Redis, Twilio
- Security/observability: `helmet`, `jsonwebtoken`, `prom-client`, `@sentry/node`
- UI tooling: Radix UI, `framer-motion`, `recharts`, Tailwind utilities

**Development Dependencies**:

- TypeScript, ESLint, Prettier
- Vitest + Testing Library, JSDOM
- `tsx`, `concurrently`, `@vitejs/plugin-react-swc`

## Build & Installation

```bash
npm install

# Development (frontend + backend)
npm run dev

# Build server and client
npm run build:all

# Start compiled backend
npm run start

# Lint / typecheck
npm run lint
npm run typecheck
```

## Docker

**Dockerfiles**:

- `Dockerfile.backend`: multi-stage Node 20 build; compiles server with `tsc` and runs `dist/server/index.js`.
- `Dockerfile.frontend`: Node 20 build + `http-server` runtime for `dist`.
- `Dockerfile.frontend.nginx`: Node 20 build + Nginx 1.25 runtime, uses `nginx.conf`.

**Compose Files**:

- `docker-compose.yml`: dev frontend (8080) + backend (3001) with mounted source.
- `docker-compose.prod.yml`: production frontend/backend with optional Postgres/Redis.
- `docker-compose.monitoring.yml`: Prometheus, Alertmanager, Grafana, node-exporter, cAdvisor, Redis, Postgres.

**Nginx Configuration**:

- `nginx.conf` configures SPA routing, `/api` proxy to backend, TLS/SSL placeholders, and security headers.

## Testing

**Framework**: Vitest + Testing Library  
**Test Location**: `src/__tests__/` and `src/**/*.test.{ts,tsx}`  
**Configuration**: `vitest.config.ts` (jsdom, setup file `src/__tests__/setup.ts`, coverage rules)

**Run Command**:

```bash
npm run test
```

## Main Entry Points & Application Structure

- **Frontend entry**: `src/main.tsx` renders `App.tsx`.
- **Backend entry**: `server/index.ts` initializes Express, WebSocket manager, security services, and routes.
- **Supabase functions**: `supabase/functions/*/index.ts` (e.g., `aegis-survivor-chat`, `ussd-gateway`, `register_survivor`).
