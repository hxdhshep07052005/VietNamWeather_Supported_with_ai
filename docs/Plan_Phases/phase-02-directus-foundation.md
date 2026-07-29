# Phase 2 — Directus Foundation & Environments

**Status:** BLOCKED  
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

## Acceptance criteria

- Một máy mới có thể dựng local environment từ tài liệu mà không sửa source code.
- Xóa container rồi dựng lại không làm mất khả năng tái tạo schema.
- Database và Redis không public ngoài network đã chốt.
- Bootstrap credential được rotation ngay sau thiết lập.
- Production chưa được tạo bằng credential mặc định hoặc cấu hình local.
- Chạy seed lặp lại không tạo duplicate hoặc ghi đè business data ngoài contract.
- Production không có demo account, fake subscription, fake weather hoặc plaintext credential từ seed.

## Decision Gate — phải hỏi và chốt với bạn

1. Repository mono-repo hay multi-repo? Khuyến nghị: mono-repo cho một sản phẩm và team nhỏ.
2. Container registry và CI platform nào sẽ dùng?
3. Secret manager nào phù hợp môi trường triển khai?
4. Object storage dùng managed S3-compatible hay local trong giai đoạn đầu?
5. Chính sách pin/update phiên bản Directus là manual approval hay lịch định kỳ?
6. Ai giữ break-glass admin credential và quy trình rotation thế nào?
7. Approved location/reference source nào được phép seed vào production?
8. Có cần demo accounts ở staging không và ai được quyền sử dụng?
