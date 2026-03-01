# Resonance Self-Hosting Migration Plan

## Purpose
This document inventories current cloud dependencies in Resonance and defines a concrete migration path to a fully self-hosted deployment profile.

---

## 1) Current Cloud Dependency Inventory

### Runtime dependency map

| Component | Where used in code | Current dependency/behavior | Env vars / config |
|---|---|---|---|
| Authentication + org context (Clerk) | `src/app/layout.tsx`, `src/proxy.ts`, `src/trpc/init.ts`, `src/app/api/**` | App auth, route protection, org scoping, UI auth flows are all Clerk-coupled via `@clerk/nextjs` and `auth()` | Clerk runtime vars (not validated in `src/lib/env.ts`): typically `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and optional sign-in/up URLs |
| Billing + subscription gating (Polar) | `src/lib/polar.ts`, `src/trpc/routers/billing.ts`, `src/trpc/routers/generations.ts`, `src/app/api/voices/create/route.ts` | Checkout/session creation, active subscription checks, usage event ingest | `POLAR_ACCESS_TOKEN`, `POLAR_SERVER`, `POLAR_PRODUCT_ID`, `APP_URL` |
| Object storage (Cloudflare R2 via S3 API) | `src/lib/r2.ts`, `src/app/api/voices/create/route.ts`, `src/trpc/routers/generations.ts`, `scripts/seed-system-voices.ts` | Voice/generation audio persisted in R2 and read back via signed URLs | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` |
| Inference API (Chatterbox service endpoint) | `src/lib/chatterbox-client.ts`, `src/trpc/routers/generations.ts`, `scripts/sync-api.ts`, `src/types/chatterbox-api.d.ts` | App performs TTS generation by HTTP call to external Chatterbox API | `CHATTERBOX_API_URL`, `CHATTERBOX_API_KEY` |
| Error + tracing telemetry (Sentry) | `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`, `src/trpc/*` | Sentry SDK initialized on client/server/edge with DSN hardcoded in repo | Hardcoded DSN in code today (no env indirection currently) |
| Relational database host (Postgres) | `src/lib/db.ts`, `scripts/seed-system-voices.ts`, Prisma schema in `prisma/schema.prisma` | Primary app state (voices, generations), org-linked data | `DATABASE_URL` |

### Observed lock-point evidence

- **Clerk lock point:** auth middleware and org requirements are enforced globally in `src/proxy.ts`.
- **Polar lock point:** checkout + subscription checks are synchronous gates for generation and custom voice creation.
- **R2 lock point:** audio persistence APIs are hardwired to Cloudflare account endpoint pattern `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
- **Chatterbox lock point:** generation path is blocked on `chatterbox.POST("/generate")`.
- **Sentry lock point:** instrumentation is integrated deeply and currently bound to a hosted DSN.
- **DB host lock point:** all data access routes through `DATABASE_URL` and Prisma Postgres adapter.

---

## 2) Self-Host Replacement Matrix

### Recommended path (with alternatives)

| Current cloud dependency | Recommended self-host target | Alternatives | Notes |
|---|---|---|---|
| Clerk | **Authelia + OIDC provider (e.g., Zitadel or Keycloak)** behind reverse proxy | Keycloak only, Zitadel only, Authentik | Need org/tenant model + Next.js middleware migration from Clerk helpers to generic OIDC/session layer (Auth.js or custom). |
| Polar | **Lago (self-host billing/metering) + Stripe self-managed integration OR custom usage ledger** | Kill Bill, OpenMeter + custom checkout UI, Chargebee/Stripe hosted fallback | Polar-specific SDK calls should be abstracted behind `BillingService` interface first. |
| Cloudflare R2 | **MinIO (S3-compatible)** | SeaweedFS S3 gateway, Ceph RGW, AWS S3 (if hybrid accepted) | Existing AWS SDK client can target MinIO with minimal code changes (`endpoint`, `forcePathStyle`, creds). |
| Chatterbox API (remote) | **Local/self-hosted Chatterbox inference service** (Docker/Modal replacement with FastAPI/gunicorn) | Coqui TTS service, Piper + wrapper API, Kokoro/XTTS | Keep same `/generate` contract to avoid app changes; deploy GPU optional. |
| Sentry Cloud | **Self-hosted Sentry** or **OpenTelemetry + Grafana/Loki/Tempo** | GlitchTip, Better Stack self-host modes | First step: move DSN to env; then swap endpoint/backend. |
| Managed Postgres host | **Local/Postgres container (or dedicated VM Postgres)** | Timescale/Postgres HA via Patroni, Crunchy, Supabase self-host | Existing Prisma + pg adapter is already portable. |

---

## 3) Risk / Effort Scoring

Scoring scale: 1 (low) to 5 (high).

| Component | Lock-in risk | Migration effort | Runtime risk after migration | Rationale |
|---|---:|---:|---:|---|
| Clerk (auth/org model) | 5 | 5 | 4 | Deep integration in middleware and APIs; org semantics are central to authorization and billing linkage. |
| Polar (billing/subscription) | 4 | 4 | 4 | Billing controls access to key features; replacement requires entitlements + metering parity. |
| R2 (object store) | 2 | 2 | 2 | S3-compatible APIs already used; MinIO drop-in is straightforward. |
| Chatterbox API | 3 | 3 | 4 | API surface is narrow, but model serving/perf/stability is operationally complex. |
| Sentry | 2 | 2 | 2 | Instrumentation already isolated; biggest change is backend endpoint and retention operations. |
| DB host (Postgres) | 3 | 2 | 3 | Migration is operational (backup/restore/HA), not major app-code change. |

---

## 4) Phased Rollout Plan

## Phase 0 — Bootstrap (foundations + abstractions)

### Objectives
- Introduce runtime toggles/abstractions so cloud and self-host providers can coexist.
- Stand up local infra baseline (Postgres + MinIO + app).

### Work items
- Add provider interfaces in app code:
  - `AuthService`
  - `BillingService`
  - `StorageService`
  - `InferenceService`
  - `TelemetryService`
- Add config profile for `SELFHOST_MODE=true`.
- Move Sentry DSN/config to env-based settings.
- Create docker-compose baseline for local stack.

### Definition of Done (Phase 0)
- [ ] `.env.selfhost.example` exists with all required placeholders.
- [ ] `docker-compose.selfhost.yml` launches `postgres`, `minio`, and `app`.
- [ ] App can boot in self-host profile without immediate cloud credentials for disabled providers.
- [ ] README references self-host docs and startup path.

## Phase 1 — Core runtime (DB + object storage)

### Objectives
- Eliminate dependence on hosted DB/R2 for core content lifecycle.

### Work items
- Point `DATABASE_URL` to self-hosted Postgres.
- Replace R2 settings with MinIO endpoint/credentials and ensure signed URL compatibility.
- Validate upload/download/delete flows for voices and generated audio.
- Validate seeding script against local object store.

### Definition of Done (Phase 1)
- [ ] `prisma migrate deploy` and CRUD operations succeed on local Postgres.
- [ ] Voice upload, generation audio storage, and retrieval work via MinIO.
- [ ] No Cloudflare R2 credentials required in self-host mode.
- [ ] Backups documented for DB and object storage.

## Phase 2 — Auth, billing, inference

### Objectives
- Remove core SaaS lock-in for identity, monetization, and generation path.

### Work items
- Migrate Clerk auth middleware/session usage to OIDC-based provider.
- Replace Polar SDK calls with billing adapter implementation.
- Deploy local Chatterbox-compatible generation service (same `/generate` contract).
- Preserve org-level access checks and subscription gating semantics.

### Definition of Done (Phase 2)
- [ ] User sign-in, org selection, and protected routes work without Clerk.
- [ ] Checkout/entitlement gating and usage metering work without Polar.
- [ ] `create generation` and `create voice` paths run end-to-end with local inference + local storage.
- [ ] Regression tests cover unauthorized, unsubscribed, and happy-path scenarios.

## Phase 3 — Hardening + operations

### Objectives
- Production-grade reliability, observability, and security in self-host mode.

### Work items
- Replace hosted Sentry dependency with self-host telemetry backend.
- Add health checks, alerting, backup/restore drills, secret rotation procedures.
- Add resource limits, autoscaling strategy, and incident runbooks.

### Definition of Done (Phase 3)
- [ ] Observability stack captures errors/traces/logs without hosted Sentry dependency.
- [ ] Disaster recovery tested: DB restore + object storage restore are documented and verified.
- [ ] Security baseline implemented (TLS termination, secret management, least privilege creds).
- [ ] Runbooks exist for deploy, rollback, and incident response.

---

## 5) Immediate Recommended Next Steps

1. Implement env-driven storage config (`STORAGE_PROVIDER`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`) and validate MinIO path first.
2. Add service abstraction layer around Clerk/Polar/Chatterbox calls before swapping providers.
3. Move Sentry DSN from hardcoded constants to env variables to unblock telemetry backend portability.
4. Build a small compatibility contract test suite for:
   - generation create/read flow,
   - voice upload flow,
   - subscription gate behavior,
   - auth/org guard behavior.

This sequencing de-risks migration by stabilizing interfaces before replacing high-lock components.

---

## 6) Current baseline bring-up runbook (app + Postgres)

```bash
cp .env.selfhost.example .env.selfhost
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
```

What happens during startup:
- `postgres` starts with healthcheck.
- `app` waits for Postgres TCP readiness.
- `app` runs `npx prisma migrate deploy`.
- `app` starts Next.js dev server on `0.0.0.0:3000`.

Validation commands:

```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost ps
curl -i http://localhost:3000/
```

Expected baseline result:
- `postgres` service is `running (healthy)`
- `app` service is `running`
- local HTTP endpoint responds (200 on `/` in self-host mode)
