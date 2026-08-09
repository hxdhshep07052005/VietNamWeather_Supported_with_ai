# Phase 4 Evidence - Data Model, Governance & Admin

**Status:** LOCAL_IMPLEMENTATION_VERIFIED / REMOTE_CI_PENDING
**Kickoff approval:** `PRODUCT-016`
**Decision baseline:** `DATA-005`, `DATA-006`, `DATA-007`, `SEC-008`, `ARCH-009`, `ARCH-015`, `PRODUCT-004`, `PRODUCT-005`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| 40 normalized business collections | PASS_LOCAL | `004-create-phase4-data-model.sql`, `foundation.yaml` |
| ERD/data dictionary | PASS | `PHASE_4_ERD.md`, `PHASE_4_DATA_DICTIONARY.md` |
| Permission mapping | PASS_LOCAL | `phase4-business-permissions.json`, `PHASE_4_PERMISSION_MATRIX.md` |
| Approved config seed | PASS_LOCAL | `phase4-approved-config.json`, `apply-phase4-seed.ps1` |
| Retention/deletion contract | PASS_BASELINE | `PHASE_4_RETENTION_MATRIX.md`, `DATA-006` |
| Admin Studio walkthrough | PASS | `PHASE_4_ADMIN_WALKTHROUGH.md` |

## Reproducible validation

Chạy:

```powershell
pnpm run validate:stage4
```

Expected terminal marker:

```text
STAGE4_DATA_MODEL_ADMIN_OK collections=40 ... fixture_rows=0 ... secrets_printed=false
```

Các gate bên trong:

- Schema snapshot drift bằng 0; 40 Directus collections, 33 declared indexes, 191 named constraints và 16 governance triggers tồn tại.
- 151 business permission cộng 7 self-TFA permission; apply idempotent; AI permission bằng 0.
- Stage 3 security bootstrap chạy lại với `permission_deleted=0`.
- Administrative parent cross-version, invalid workflow transition, self-approval rule/advisory, post-submit rule mutation, usage/payment identity update/delete đều bị từ chối.
- Traveler positive path cho published location, favorite và saved route pass; cross-user list/read/update/delete bị từ chối.
- API DB role có 0 direct CRUD privilege trên 40 business tables.
- Seed checksum audit tồn tại; seed lần sau trả `state=skipped`; không có location/weather/payment/user giả.
- Test fixture dùng UUID/email marker riêng, rollback/delete và xác nhận `ephemeral_rows_remaining=0`.

## Current local data evidence

Tại lần validation Phase 4 ngày 2026-08-09: `administrative_units=0`, `locations=0`, `weather_observations=0`, `weather_forecasts=0`, `payment_events=0`. Các row hiện có chỉ là approved config seed (locale, plan, feature, entitlement, usage policy) và seed audit.

Validation trên working tree hiện tại đã pass:

- `pnpm run build`, `pnpm run lint`, `pnpm run typecheck` và 12 Node test.
- API và worker Docker image build từ Dockerfile hiện tại.
- `pnpm run validate:stage4` với marker `STAGE4_DATA_MODEL_ADMIN_OK`.
- Directus schema SHA-256 `260c629828adf8a905a1774668b32a2d24769e78a68c804dfb8eb9bb2edf7800` và drift bằng 0.
- Compose bootstrap không còn chạy migration phụ thuộc `directus_users` trong PostgreSQL init; migration Phase 4 được apply sau khi Directus system schema tồn tại.

## Open evidence

- Remote CI run trên commit Phase 4 cuối chưa có; Phase 4 chưa chuyển `VERIFIED` cho tới khi push và CI xanh.
- Official Vietnam location import chưa chạy vì chưa có source/version/license được duyệt; đây là chủ đích, không phải thiếu fake seed.
- Provider-specific retention values chờ Phase 5; route cleanup job chờ Phase 8/13; production scheduler/alert chờ Phase 13.
