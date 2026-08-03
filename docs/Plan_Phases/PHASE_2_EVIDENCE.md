# Phase 2 Evidence Manifest

## Status

**Phase:** VERIFIED
**Kickoff approval:** `PRODUCT-013`
**Closure approval:** `PRODUCT-014`
**Local implementation date:** 2026-07-31  
**Local validator:** PASS  
**Remote CI/GHCR:** PASS
**Remaining blocker:** None for Phase 2.

Phase 2 is `VERIFIED` because repository, runtime, schema, seed, backup, local supply-chain, clean rebuild, remote GitHub Actions and immutable GHCR image evidence are all reproducible.

## Approved decisions

| Area | Decision | State |
|---|---|---|
| Monorepo/runtime/CI/registry | `ARCH-014` | Implemented locally |
| Secrets/bootstrap/break-glass | `SEC-003` | Implemented and rotation verified locally |
| Production seed/reference policy | `DATA-005` | Foundation mechanism implemented; business seeds deferred to their approved schemas |
| Environment/storage/update policy | `OPS-007` | Implemented locally |

## Reproducible evidence

| Deliverable | Evidence | Result |
|---|---|---|
| Monorepo and pinned toolchain | `package.json`, `pnpm-workspace.yaml`, `.node-version`, `.nvmrc`, exact dependency versions | PASS |
| Code quality | `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` | PASS; 4 tests passed |
| Docker Compose stack | `compose.yaml`, `apps/worker/Dockerfile` | PASS; 5 services healthy |
| Immutable runtime inputs | Directus, PostGIS, Redis, Mailpit and Node references use verified SHA-256 digests | PASS |
| Directus runtime | Authenticated `/server/health` | PASS; release `12.1.1`, 6 health checks, status `ok` |
| PostgreSQL/PostGIS | Versioned init SQL plus runtime query | PASS; PostGIS `3.6` enabled |
| Redis | Password-authenticated `PING` | PASS |
| Network isolation | Container port binding inspection | PASS; database and Redis have no host binding |
| Local-only exposure | Directus, worker and Mailpit bind to `127.0.0.1` | PASS |
| Environment/secret contract | Generated `.env.local`; bootstrap and rotated admin files are Git-ignored | PASS |
| Admin bootstrap rotation | Old credential rejected, new credential verified, bootstrap file removed, restart without bootstrap | PASS |
| Directus schema baseline | `apps/directus/schema/foundation.yaml` | PASS; SHA-256 `a3d2c70dc54793c586f06e0c04a79038487e54bbab21e9cdd76a859c7bada984` |
| Schema promotion/drift | Dry-run reports no changes; regenerated snapshot matches baseline hash | PASS |
| Security foundation | `apps/directus/security/foundation.json` | PASS; 1 admin role, 1 admin policy, 1 non-admin policy, 0 permissions, 0 application roles |
| Seed mechanism | `apps/directus/seeds/foundation.json`, `app_seed_runs` audit table | PASS; first run `applied`, repeated run `skipped`, exactly 1 audit row |
| No fabricated business seed | Foundation manifest contains zero business operations | PASS; Free/Pro, locale, role and location records are not invented before Phase 3/4 schema decisions |
| Secret scan | Gitleaks `8.30.1` image pinned by digest, full directory scan with local secret paths excluded by policy | PASS; no leaks found |
| SBOM | Syft `1.50.0` image pinned by digest, CycloneDX JSON for built worker image | PASS; 582 components in latest local run |
| Backup/restore | Custom-format `pg_dump`, restore into isolated temporary database | PASS; Directus user, seed audit and PostGIS verified |
| Clean rebuild | `tools/environment/rebuild-local.ps1 -ConfirmLocalDataReset` | PASS; volumes recreated, schema/seed applied, admin rotated, stack healthy |
| GitHub workflow syntax | Actionlint `1.7.12` image pinned by digest | PASS |
| GitHub Actions remote run | Run `30577216479`, commit `3ac524579308e1f7365370643ed7257a22570acd` | PASS; `quality` and `worker-image` succeeded |
| Source SBOM artifact | `source-sbom-3ac524579308e1f7365370643ed7257a22570acd`, artifact ID `8773180652` | PASS; 9,213 bytes, retention 14 days |
| GHCR immutable image publish | `ghcr.io/hxdhshep07052005/vietnam-weather-worker:3ac524579308e1f7365370643ed7257a22570acd` | PASS; manifest `sha256:747e0d2ff9fc6a3549687014ec5b0c2b2791311c9baffadaa7a10f8ee28fb4c2` |

The first remote run `30575550998` failed at source SBOM output because its parent directory was missing. The workflow was corrected, revalidated locally and rerun; only successful run `30577216479` is accepted as closure evidence.

## Seed scope clarification

The Phase 2 seed runner is deliberately fail-closed: it records only an approved zero-operation foundation manifest and rejects non-empty operations because the business collections and authorization model belong to Phase 3/4 decision gates. This proves manifest checksum, environment scope, audit and idempotency without creating fake weather, payment, subscription, account, plan, locale or location records.

When Phase 3/4 introduces approved handlers and collections, each non-empty manifest must include stable external keys, ownership rules and provenance. Location catalogs remain blocked until an official source/version/license passes `DATA-005`.

## Commands

Run the complete non-destructive local validator:

```powershell
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage2.ps1
```

Verify the accepted GitHub Actions, source SBOM artifact and immutable GHCR image:

```powershell
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage2-remote.ps1
```

Run a destructive clean local rebuild only after a verified backup:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/rebuild-local.ps1 -ConfirmLocalDataReset
```

The local validator output ended with:

```text
STAGE2_LOCAL_VALIDATION_OK remote_github_ci=use_validate-stage2-remote.ps1
```

The latest clean rebuild output ended with:

```text
LOCAL_CLEAN_REBUILD_OK schema_applied=true seed_applied=true admin_rotated=true bootstrap_removed=true
```

## Evidence rules

- No credential value, provider key, access token, bootstrap password or database connection string appears in committed files or evidence output.
- Local backups and SBOM output are stored under Git-ignored `artifacts/phase2/local/`.
- Test and staging fixtures may never be promoted to production; Phase 2 creates no demo account or fabricated business record.
- Phase 2 closure is approved by `PRODUCT-014`; later image/version changes require new CI, migration and rollback evidence rather than reusing this run.
