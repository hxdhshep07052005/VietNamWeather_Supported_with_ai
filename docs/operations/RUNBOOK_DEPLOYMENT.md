# Operations Runbook — Production Deployment & Rollback

**Document ID:** `RUNBOOK-DEP-001`  
**Decisions:** `OPS-003`, `OPS-008`, `OPS-009`, `OPS-011`, `OPS-014`  
**Target Environment:** Owner-Managed VPS (Ubuntu 24.04 LTS x64)  
**Maintenance Window:** Off-peak hours 02:00 – 04:00 `Asia/Ho_Chi_Minh` for breaking changes; zero-downtime rolling updates anytime for backwards-compatible releases.

---

## 1. Preflight Deployment Checklist

Before triggering a release to production, ensure every gate has passed:
1. **Repository State:**
   - Commit must be on the `main` branch with clean git status.
   - 100% automated test pass rate across the monorepo (`pnpm run test` -> 207+ tests passing).
   - Zero TypeScript compile errors (`pnpm run typecheck`).
   - Zero ESLint errors or warnings (`pnpm run lint`).
2. **Configuration Verification:**
   - Production secrets exist in `.env.production` on the target host (generated via `tools/environment/generate-production-secrets.ps1`).
   - Validate Compose syntax:
     ```bash
     docker compose --env-file .env.production -f compose.prod.yaml config --quiet
     ```
3. **Database Preflight Check:**
   - Verify active database connection and disk space:
     ```bash
     docker compose -f compose.prod.yaml exec database df -h /var/lib/postgresql/data
     ```
   - Ensure a fresh backup is captured prior to migration:
     ```bash
     powershell -ExecutionPolicy Bypass -File tools/database/backup-prod.ps1
     ```

---

## 2. Standard Zero-Downtime Deployment Procedure

Execute the following commands from the project root on the VPS:

### Step 1: Pull Latest Git Revisions
```bash
git fetch origin main
git checkout main
git pull origin main
```

### Step 2: Build and Recreate Application Containers
Execute rolling update with build caching:
```bash
docker compose --env-file .env.production -f compose.prod.yaml build --pull api worker web
docker compose --env-file .env.production -f compose.prod.yaml up -d --no-deps --remove-orphans api worker web
```

### Step 3: Verify Health Probes
Wait 15 seconds for startup, then probe readiness endpoints:
```bash
# Verify API Liveness
curl -sf http://127.0.0.1:8080/health/live | jq .

# Verify Deep Readiness (Database, Redis, Directus)
curl -sf http://127.0.0.1:8080/health/ready | jq .

# Verify Reverse Proxy Delivery
curl -sI http://127.0.0.1:80/ | grep -E "HTTP|x-correlation-id|content-type"
```

Expected output:
- `/health/live`: `{"service":"application-api","status":"live",...}`
- `/health/ready`: `{"service":"application-api","status":"ready",...}` (HTTP 200)
- Public web root returns `HTTP/1.1 200 OK` with secure headers.

---

## 3. Immediate Rollback Procedure

If health probes fail or unexpected errors occur during deployment:

### Step 1: Identify Prior Known-Good Commit
```bash
git log --oneline -n 5
```

### Step 2: Checkout Prior Known-Good Release
```bash
git checkout <PREVIOUS_KNOWN_GOOD_COMMIT>
```

### Step 3: Re-recreate Containers
```bash
docker compose --env-file .env.production -f compose.prod.yaml up -d --build --remove-orphans api worker web
```

### Step 4: Verify Restored Health
```bash
curl -sf http://127.0.0.1:8080/health/ready
```

### Step 5: Post-Mortem Log Capture
Capture container logs for diagnostic analysis:
```bash
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=500 api > artifacts/incident-logs-api.txt
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=500 worker > artifacts/incident-logs-worker.txt
```
