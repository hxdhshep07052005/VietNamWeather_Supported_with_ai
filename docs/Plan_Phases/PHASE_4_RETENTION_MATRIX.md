# Phase 4 Retention & Deletion Matrix

**Decision baseline:** `DATA-006`, `PRODUCT-003`, `PRODUCT-004`, `PRODUCT-005`
**Control plane:** `retention_policies` trong Directus; production scheduler/alert thuộc Phase 13.

| Data category | Baseline | Delete/anonymize rule | Trạng thái |
|---|---|---|---|
| Raw provider payload | Không lưu trong Phase 4 | Chỉ được mở bằng decision mới có provider terms, minimization và TTL | ENFORCED_BY_SCHEMA/PROCESS |
| Normalized observation/forecast | Theo provider terms và freshness/expiry | Purge/aggregate bằng versioned retention policy | PENDING_PHASE5_VALUE |
| Provider run/error metadata | Chỉ sanitized metadata/error | TTL phải cấu hình; không ghi token/request raw | PENDING_PHASE5_VALUE |
| Route request/option/sample | Có `history_expires_at` và user ownership | Xóa theo plan/privacy policy; precise GPS không dùng làm tracking history | PENDING_PHASE8_JOB |
| Search history | Free 7 ngày, Pro 90 ngày | `expires_at`; xóa khi retention job chạy hoặc user/account deletion áp dụng | APPROVED_BASELINE |
| Favorites/saved routes | Theo quota, đến khi user xóa/account lifecycle | Owner CRUD; account delete cascade cho user-owned rows | APPROVED_BASELINE |
| Usage events | Ledger immutable | Chỉ retention procedure được duyệt; aggregate trước khi xóa nếu cần | POLICY_REQUIRED |
| Usage counters | Current projection | Rebuild/expire theo policy period | POLICY_REQUIRED |
| Security/session events | Session/security log 90 ngày | Dùng Phase 3 retention procedure | IMPLEMENTED |
| Admin/security audit | 12 tháng | Purge có audit; legal hold nếu được duyệt | APPROVED_BASELINE |
| Billing/payment references | Tối thiểu 24 tháng | Không lưu card/CVV; legal/accounting review trước production | APPROVED_BASELINE |
| Reference source/admin versions | Giữ provenance/version cần tái hiện | `RESTRICT` thay vì cascade; retire, không xóa tùy ý | IMPLEMENTED |
| Content/rule/advisory releases | Giữ version/effective dates | Retire; không sửa business fields sau submit | IMPLEMENTED |

Không được biến giá trị `PENDING_*` thành số tùy ý. Trước production, Product Owner/Legal/Operations phải duyệt record `retention_policies` tương ứng và Phase 13 phải cung cấp scheduler, alert và dry-run evidence.
