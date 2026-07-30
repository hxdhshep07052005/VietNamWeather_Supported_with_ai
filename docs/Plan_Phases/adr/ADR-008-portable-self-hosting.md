# ADR-008 — Portable Local-to-VPS Self-Hosting

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `OPS-003`

## Bối cảnh

Development bắt đầu local; production chạy trên VPS/server do Product Owner quản lý. Chi tiết VPS được defer đến Phase 13, nhưng kiến trúc không được phụ thuộc sửa source/secret thủ công hoặc một cloud vendor cụ thể.

## Quyết định

Dùng version-pinned container/image digest và externalized configuration cho reverse proxy, web, Directus, worker, PostgreSQL/PostGIS, Redis và observability agent. Giữ cùng service boundary giữa local, staging và production; khác biệt môi trường chỉ qua cấu hình/secrets được quản lý.

## Phương án đã xem xét

- **Cài thủ công trực tiếp trên VPS:** nhanh lúc đầu nhưng khó reproduce, rollback và audit.
- **Managed cloud-only:** giảm ops nhưng trái định hướng owner-managed server và tạo vendor lock-in.
- **Portable containers:** được chọn để local-first và có đường triển khai VPS rõ ràng.

## Trade-off và hệ quả

- Product Owner chịu trách nhiệm patching, backup, monitoring, incident response và capacity.
- Single VPS là một failure domain cho tới khi có quyết định redundancy.
- Container không tự bảo đảm security; image/config/secret vẫn phải scan và pin.

## Security impact

Production bắt buộc TLS, firewall, private database/cache, Admin Studio qua VPN/IP allowlist, non-root/minimal image khi khả thi, encrypted off-site backup và credential rotation. Không commit secret hoặc sửa secret trong source trên server.

## Chi phí và vận hành

Giữ portability nhưng cần VPS capacity, backup target, domain/DNS, monitoring và restore drill. Chi phí cụ thể chỉ được chốt từ inventory/pricing thật ở Phase 13, không giả định server riêng là miễn phí hoặc đủ tải.

## Migration và rollback

Release dùng immutable image/config bundle và known-good previous version. Database migration phải tương thích rollback/restore plan; rollback application không được chạy trên schema không tương thích. Chuyển VPS/cloud phải dùng cùng backup restore và configuration contract.

## Evidence cần có

Phase 13 phải có inventory thật, deployment rehearsal, firewall/network scan, off-site restore test, rollback test và runbook incident/upgrade.
