# ADR-006 — Durable Payment Webhook Processing

**Status:** Accepted  
**Date:** 2026-07-29  
**Decisions:** `ARCH-008`, `ARCH-010`

## Bối cảnh

Stripe/VNPay event có thể duplicate, delayed, missing hoặc out-of-order. Browser redirect có thể bị giả mạo; capability recurring của từng provider khác nhau và chưa được coi là production-ready nếu thiếu merchant evidence.

## Quyết định

Webhook/IPN ingress đọc raw request, verify signature/checksum, ghi immutable event + provider event ID/idempotency key rồi acknowledge nhanh. Worker áp dụng ordered state machine, project entitlement và chạy reconciliation. Browser Return URL chỉ hiển thị trạng thái, không cấp Pro.

## Phương án đã xem xét

- **Tin browser redirect:** bị loại vì client-controlled và không xử lý delayed event.
- **Xử lý toàn bộ đồng bộ trong webhook:** dễ timeout/retry và tạo duplicate state.
- **Durable ingress + worker:** được chọn để replay, audit và phục hồi an toàn.

## Trade-off và hệ quả

- Cần event ledger, state machine, queue, reconciliation và support tooling.
- Entitlement có eventual consistency trong SLO đã định nghĩa.
- Stripe/VNPay adapter có thể enable/disable độc lập theo merchant capability.

## Security impact

Signature/checksum phải dùng raw body và constant-time comparison khi phù hợp. Reject event không hợp lệ trước mutation; không log payment secret/card data. Refund/cancel/admin correction cần authorization và audit riêng.

## Chi phí và vận hành

Tăng database event volume, worker job và reconciliation calls. Retention/indexing phải giữ audit cần thiết nhưng không lưu payload nhạy cảm vô hạn. Transaction fee được theo dõi ngoài hạ tầng ceiling theo `OPS-002`.

## Migration và rollback

Disable provider không xóa historical event/subscription. State-machine migration phải replay được trên fixture và có mapping version; rollback code không được đảo ngược entitlement hợp lệ hoặc xử lý lại event đã committed.

## Evidence cần có

Phase 10/12 phải test forged signature, replay, out-of-order, timeout, duplicate, refund, reconciliation và chứng minh p95 entitlement sync <= 60 giây.
