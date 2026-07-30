# Phase 2 — Directus Foundation & Environments

**Status:** IN_PROGRESS — LOCAL_VERIFIED / REMOTE_CI_PENDING
**Phụ thuộc:** Phase 1 VERIFIED  
**Mục tiêu:** Dựng nền Directus có thể tái lập cho local, development, staging và production.

## Phạm vi công việc

### 1. Repository and runtime

- Tạo cấu trúc repository cho frontend, Directus extensions, integration worker, infrastructure và docs.
- Pin phiên bản Directus/container image; không dùng tag `latest`.
- Dựng local stack bằng container: Directus, PostgreSQL/PostGIS, Redis và mail catcher nếu cần.
- Cấu hình health/readiness checks và graceful shutdown.
- Tách configuration không nhạy cảm khỏi secret.

### 2. Environment isolation

- Tạo environment matrix và naming convention.
- Mỗi environment dùng database, bucket, cache namespace và credential riêng.
- Không copy production data sang lower environment nếu chưa anonymize và approve.
- Quy định secret injection và rotation theo môi trường.

### 3. Schema and configuration promotion

- Chọn cơ chế Directus schema snapshot/diff hoặc migration được kiểm soát.
- Version hóa collection schema, role/policy baseline và extension build.
- CI kiểm tra drift giữa repository và environment.
- Có rollback plan cho schema/config release.

### 3.1. Deterministic seeding and secure bootstrap

- Seed scripts/versioned manifests phải idempotent và có environment scope.
- Production chỉ seed approved reference/config data theo `DATA-001`; không seed fake weather, fake billing, demo user hoặc sample subscription.
- Local/development/staging có thể có test fixtures nhưng phải dùng namespace/label rõ và không promotion sang production.
- Bootstrap Admin được tạo bằng protected environment/secret manager, đăng nhập lần đầu phải rotation; credential không nằm trong Git.
- Service accounts được provision theo role/policy riêng; token/secret chỉ nằm trong secret manager và có rotation owner.
- Seed roles/policies, Free/Pro plans, feature keys, locale resources và location catalog bằng stable external key để upsert không duplicate.
- Mỗi seed run ghi version, checksum, environment, actor, thời điểm và result; không log secret.

### 4. CI foundation

- Lint, type-check, unit test và secret scanning trong CI.
- Build immutable images/artifacts.
- Tạo software bill of materials hoặc dependency inventory.
- Không auto-deploy production từ branch không được bảo vệ.

## Deliverables và evidence

- Local environment khởi động bằng một quy trình được tài liệu hóa.
- Directus Admin Studio hoạt động với bootstrap admin tạm thời.
- Schema baseline được version hóa.
- CI pipeline pass và không có secret trong repository.
- Environment/config matrix được duyệt.
- [PHASE_2_EVIDENCE.md](PHASE_2_EVIDENCE.md) được cập nhật theo từng bước và chỉ đóng khi toàn bộ evidence có thể tái hiện.

## Acceptance criteria

- Một máy mới có thể dựng local environment từ tài liệu mà không sửa source code.
- Xóa container rồi dựng lại không làm mất khả năng tái tạo schema.
- Database và Redis không public ngoài network đã chốt.
- Bootstrap credential được rotation ngay sau thiết lập.
- Production chưa được tạo bằng credential mặc định hoặc cấu hình local.
- Chạy seed lặp lại không tạo duplicate hoặc ghi đè business data ngoài contract.
- Production không có demo account, fake subscription, fake weather hoặc plaintext credential từ seed.

## Decision Gate — completed

1. **Đã chốt:** Monorepo + `pnpm workspace`; chưa dùng Turborepo (`ARCH-014`).
2. **Đã chốt:** GitHub Actions + GitHub Container Registry (`ARCH-014`).
3. **Đã chốt:** `.env.*` local, GitHub encrypted secrets cho CI, SOPS/age + Docker secrets/runtime injection cho VPS (`SEC-003`).
4. **Đã chốt:** Không thêm MinIO/S3 trong Stage 2; local volume chỉ cho local/development, production storage defer Phase 4/13 (`OPS-007`).
5. **Đã chốt:** Exact version/digest, manual approval, monthly review và expedited security update (`OPS-007`).
6. **Đã chốt:** Product Owner giữ break-glass trong password manager + encrypted offline recovery copy; audit và rotate sau sử dụng (`SEC-003`).
7. **Đã chốt:** Chỉ seed source chính thức có version/license/provenance; chưa đủ evidence thì không seed location catalog (`DATA-005`).
8. **Đã chốt:** Chỉ ephemeral CI/staging accounts có namespace/expiry; không public demo và không production demo (`DATA-005`).

Phase 2 kickoff được phê duyệt tại `PRODUCT-013`.

## Implementation checkpoint — 2026-07-31

- Local stack Directus/PostGIS/Redis/Mailpit/worker đã dựng lại từ volume sạch và toàn bộ service healthy.
- Bootstrap admin đã rotate; credential cũ bị từ chối; stack restart không cần `.env.bootstrap.local`.
- Schema snapshot/dry-run/drift, security foundation, seed audit/idempotency, backup/isolated restore, secret scan và worker SBOM đã pass.
- Foundation seed không chứa business operation để tránh chốt lén schema Phase 3/4 hoặc tạo dữ liệu giả.
- GitHub Actions workflow đã được Actionlint xác minh nhưng chưa chạy trên GitHub và GHCR chưa publish image; đây là blocker duy nhất trước khi đề nghị Product Owner đóng Phase 2.
