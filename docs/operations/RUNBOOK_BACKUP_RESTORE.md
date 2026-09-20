# Operations Runbook — Data Backup, Restore & Disaster Recovery

**Document ID:** `RUNBOOK-BAK-001`  
**Decisions:** `OPS-003`, `OPS-012`, `DATA-004`, `DATA-006`  
**Invariants:**
- **Recovery Point Objective (RPO):** $\le$ 24 hours.
- **Recovery Time Objective (RTO):** $\le$ 1 hour.
- **Retention:** 30 days rolling on-server + off-site cold storage.

---

## 1. Automated Daily Backup Configuration

### Crontab Schedule
On the owner-managed VPS, install the following cron entry running under the deployment user at 02:00 `Asia/Ho_Chi_Minh` (19:00 UTC):

```bash
# Execute daily production database backup with SHA256 verification
0 19 * * * /usr/bin/pwsh -ExecutionPolicy Bypass -File /opt/vietnam-weather/tools/database/backup-prod.ps1 >> /var/log/weather-backup.log 2>&1
```

### Backup Artifacts Produced
Each backup run creates:
1. Dump archive: `artifacts/backups/production/prod-db-YYYYMMDDTHHmmssZ-<id>.dump`
2. SHA256 manifest: `artifacts/backups/production/prod-db-YYYYMMDDTHHmmssZ-<id>.dump.sha256`

---

## 2. Off-Site Replication Policy

To defend against complete VPS catastrophic hardware failure:
1. After local backup completion, replicate the backup directory to an off-site S3-compatible encrypted cold bucket:
   ```bash
   aws s3 sync /opt/vietnam-weather/artifacts/backups/production/ s3://vnwa-backups-cold/production/ \
     --sse AES256 --storage-class STANDARD_IA
   ```
2. Lifecycle rules on the off-site bucket transition archives to Glacier after 30 days and expire them after 90 days.

---

## 3. Disaster Recovery: Full Cold Restoration Procedure (RTO $\le$ 1 Hour)

In the event of catastrophic server loss, follow this procedure to restore service on a fresh VPS:

### Step 1: Provision Clean VPS & Install Docker
```bash
# On clean Ubuntu 24.04 LTS host:
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
```

### Step 2: Clone Repository & Inject Secrets
```bash
git clone https://github.com/hxdhshep07052005/VietNamWeather_Supported_with_ai.git /opt/vietnam-weather
cd /opt/vietnam-weather

# Copy secure production environment config from secure vault
scp secure-vault:/secrets/.env.production .env.production
```

### Step 3: Fetch Latest Verified Backup from Off-Site
```bash
mkdir -p artifacts/backups/production
aws s3 cp s3://vnwa-backups-cold/production/latest.dump artifacts/backups/production/restore-target.dump
aws s3 cp s3://vnwa-backups-cold/production/latest.dump.sha256 artifacts/backups/production/restore-target.dump.sha256

# Verify SHA256 Checksum
sha256sum -c artifacts/backups/production/restore-target.dump.sha256
```

### Step 4: Start Database Service Only
```bash
docker compose --env-file .env.production -f compose.prod.yaml up -d database
# Wait for pg_isready healthcheck to pass
docker compose -f compose.prod.yaml exec database pg_isready -U directus -d directus
```

### Step 5: Restore Database Archive
```bash
# Copy dump into database container and restore
docker cp artifacts/backups/production/restore-target.dump $(docker compose -f compose.prod.yaml ps -q database):/tmp/restore.dump
docker compose -f compose.prod.yaml exec -T database pg_restore -U directus -d directus --clean --if-exists --no-owner --no-privileges /tmp/restore.dump
docker compose -f compose.prod.yaml exec -T database rm -f /tmp/restore.dump
```

### Step 6: Verify Database Integrity
```bash
docker compose -f compose.prod.yaml exec -T database psql -U directus -d directus -c \
  "SELECT (SELECT count(*) FROM directus_users) AS users, (SELECT count(*) FROM app_seed_runs) AS seed_runs, postgis_version();"
```

### Step 7: Launch Remaining Containers
```bash
docker compose --env-file .env.production -f compose.prod.yaml up -d --remove-orphans
```

### Step 8: Verify End-to-End System Readiness
```bash
curl -sf http://127.0.0.1:8080/health/ready | jq .
curl -sf http://127.0.0.1:80/ | head -n 5
```

---

## 4. Automated Restore Rehearsal Drill

To satisfy `OPS-012`, execute the automated restore rehearsal drill script monthly:
```bash
powershell -ExecutionPolicy Bypass -File tools/database/restore-prod-drill.ps1
```
Expected output:
```
RESTORE_DRILL_OK database=drill_xxxx postgis=3.4 USE_GEOS=1 ...
```
This guarantees the backup file is fully restorable and not merely an empty file.
