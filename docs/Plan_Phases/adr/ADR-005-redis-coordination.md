# ADR-005 — Redis Coordination Layer

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `ARCH-007`

## Bối cảnh

Hệ thống cần cache ngắn hạn, distributed rate limit/quota coordination, lock, session metadata và job delivery. Các chức năng này cần nhanh nhưng không được biến Redis thành nguồn dữ liệu subscription/payment duy nhất.

## Quyết định

Dùng Redis cho cache, rate limiting, coordination lock, queue delivery và metadata ngắn hạn. PostgreSQL giữ durable outbox, usage ledger, subscription/payment truth và audit evidence.

## Phương án đã xem xét

- **In-memory từng process:** rẻ nhưng sai khi scale nhiều instance hoặc restart.
- **Chỉ PostgreSQL:** giảm service nhưng không tối ưu cho cache/rate limit/queue delivery tần suất cao.
- **Redis + PostgreSQL truth:** được chọn để tách ephemeral coordination khỏi durable business state.

## Trade-off và hệ quả

- Thêm service cần health check, memory policy, persistence decision và monitoring.
- Redis outage làm giảm cache/queue throughput; business mutation cần atomicity phải fail closed hoặc dựa vào database transaction đã thiết kế.
- Queue library phải hỗ trợ retry, delayed job, lease và dead-letter có test.

## Security impact

Redis chỉ ở private network, có authentication/TLS khi topology yêu cầu và dùng credential riêng theo môi trường. Không expose cho browser; payload không chứa secret hoặc dữ liệu nhạy cảm dư thừa.

## Chi phí và vận hành

Tăng memory/VPS footprint và backup/config effort. Cache TTL/maxmemory phải dựa trên load/cost evidence; không mua scale trước khi đo hit ratio và queue lag.

## Migration và rollback

Cache có thể flush/rebuild mà không mất business truth. Thay Redis queue cần consumer dual-run hoặc drain/migrate pending job references; không rollback sang silent in-process execution cho payment/critical jobs.

## Evidence cần có

Phase 2/12 phải test Redis restart/loss, duplicate delivery, lock expiry, quota concurrency và chứng minh database ledger vẫn đúng.
