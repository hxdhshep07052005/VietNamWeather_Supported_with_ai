# ADR-009 — Directus Version and License Pin

**Status:** Accepted  
**Date:** 2026-07-30  
**Decision:** `ARCH-011`

## Bối cảnh

Dùng floating tag hoặc ghi “Directus mới nhất” không tạo build reproducible và có thể làm license/runtime/schema thay đổi ngoài review. Phase 1 cần pin một exact baseline đã được kiểm tra từ npm, GitHub release, Docker Hub và license file trong chính release.

## Quyết định

Dùng Directus `12.1.1` làm build baseline và pin container bằng manifest digest `sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d`. License đi kèm tag `v12.1.1` là `MSCL-1.0-GPL`. Evidence chi tiết nằm trong `DIRECTUS_BASELINE.md`.

## Phương án đã xem xét

- **Tag `latest`:** bị loại vì không reproducible và có thể đổi version/digest ngoài kiểm soát.
- **Pin major/minor tag:** giảm drift nhưng vẫn có thể đổi patch và migration behavior.
- **Pin exact version + digest:** được chọn để local/staging/production dùng cùng artifact đã xác minh.

## Trade-off và hệ quả

- Build ổn định hơn nhưng cần quy trình chủ động cập nhật security patch.
- Extension compatibility và migration phải test lại khi đổi version.
- License fit hiện tại chỉ áp dụng cho business model đã mô tả; thay đổi mô hình có thể cần legal review.

## Security impact

Không bypass license-key functionality. Image/dependency được scan; không giữ version cũ nếu có lỗ hổng nghiêm trọng chưa xử lý. Directus Admin Studio vẫn private theo `SEC-002` và image pin không thay thế hardening.

## Chi phí và vận hành

Self-hosting tránh phí managed service trực tiếp nhưng Product Owner chịu chi phí VPS, backup, monitoring, patching và incident response. Upgrade rehearsal tạo effort nhưng bắt buộc để giảm downtime/data loss.

## Migration và rollback

Trước upgrade phải backup/restore test, đọc migration notes và giữ known-good image/config. Rollback application chỉ hợp lệ nếu schema tương thích; nếu không phải restore database theo runbook đã diễn tập.

## Evidence cần có

Phase 2 chứng minh clean start/migration/extension compatibility. Phase 13 recheck exact production version, digest, license, security advisories, backup và rollback trước go-live.
