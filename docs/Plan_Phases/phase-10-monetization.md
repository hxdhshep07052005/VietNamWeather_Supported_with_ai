# Phase 10 — Monetization, Subscription & Entitlements

**Status:** BLOCKED  
**Phụ thuộc:** Phase 3 VERIFIED; API contract của Phase 4–9 ổn định  
**Mục tiêu:** Xây product billing và Pro gating an toàn, có thể vận hành từ Directus Admin Studio và không phụ thuộc vào kiểm tra ở frontend.

## Phạm vi công việc

### 1. Product catalog

- Tạo plan catalog chỉ gồm Free và Pro theo `PRODUCT-001`.
- Tạo feature catalog với stable `feature_key`, description, locale và availability.
- Tạo entitlement policy cho quota, capability, horizon, saved item và Pro-only experience.
- Pro có billing interval theo tháng và năm theo `PRODUCT-003`; annual discount lấy từ product configuration.
- Giá, currency, billing interval, trial, grace period, promo và effective date nằm trong configuration/versioning.
- Chốt rõ benefit có thực sự giới hạn theo user, account, device hay organization.

### 2. Usage metering

- Xác định các usage event: search, location detail, forecast detail, route evaluation, route alternative, saved location, trend view và chatbot message nếu có.
- Mỗi event có user/account, feature key, request ID, timestamp, outcome, source và metadata tối thiểu.
- Counter atomic, idempotent và chống race condition giữa nhiều tab/device.
- Quota theo ngày reset lúc `00:00` `Asia/Ho_Chi_Minh` theo `PRODUCT-005`; timestamp lưu UTC và counter dùng chung cho mọi device/session của user.
- Backend trả entitlement/quota status để frontend hiển thị; frontend không được tự mở khóa.
- Chống abuse: rate limit, burst limit, request cost và anti-automation policy.
- Không có anonymous usage quota: mọi usage event sản phẩm gắn với authenticated user theo `PRODUCT-006`.

### 2.1. Đề xuất entitlement ban đầu — DRAFT, chờ duyệt

Nguyên tắc: không giới hạn việc mở bản đồ và xem thời tiết hiện tại thông thường; chỉ áp fair-use/rate limit chống abuse. Monetization tập trung vào tác vụ tốn provider/API, lưu trữ và phân tích nâng cao.

| Capability | Free đề xuất | Pro đề xuất |
|---|---|---|
| Bản đồ + thời tiết hiện tại | Không quota nghiệp vụ; áp abuse rate limit | Không quota nghiệp vụ; ưu tiên SLA theo policy |
| Weather map effects | Hiệu ứng thời tiết hiện tại | Future timeline, forecast animation, advanced overlays |
| Tìm kiếm địa điểm | 10 lượt/ngày | 200 lượt/ngày |
| Forecast | Free horizon do backend công bố, không vượt provider-valid coverage | Toàn bộ provider-approved horizon theo confidence/capability policy |
| Biểu đồ | Cơ bản | Nâng cao, so sánh và trend dài hơn |
| Route evaluation | 3 lượt/ngày | 30 lượt/ngày |
| Route alternatives | 1 tuyến/request | Tối đa 3 tuyến/request |
| GPS position/follow updates | Không tính quota | Không tính quota |
| Saved locations | 3 | 50 |
| Saved routes | 1 | 20 |
| Lịch sử/trend cá nhân | 7 ngày | 90 ngày |
| Chatbot, nếu bật | 3 tin nhắn/ngày | 30 tin nhắn/ngày |

Baseline quota đã được chốt trong `PRODUCT-004`; weather effect entitlement được chốt trong `PRODUCT-007`. Chúng phải được lưu trong Directus `usage_policies`/`plan_entitlements`, không viết cứng trong code; thay đổi cần decision mới.

### 3. Stripe and VNPay integration

- Dùng payment adapter chung với hai implementation: Stripe và VNPay theo `ARCH-001`.
- Stripe phục vụ thanh toán quốc tế và recurring subscription khi product contract hỗ trợ.
- VNPay phục vụ thanh toán tại Việt Nam; recurring/tokenization phải được xác minh theo API và hợp đồng merchant.
- Nếu VNPay không hỗ trợ recurring phù hợp, VNPay bán kỳ Pro trả trước/manual renewal; không giả lập auto-renew.
- Checkout cho người dùng chọn Stripe hoặc VNPay trong danh sách option backend cho phép theo `ARCH-002`.
- Tạo checkout/customer portal theo provider capability.
- Webhook verify signature, chống replay, idempotent và ghi raw event reference theo retention.
- Map provider status thành business state: trialing, active, past_due, canceled, expired, paused, refunded.
- Không lưu card number/CVV hoặc payment secret trong Directus.
- Refund, cancel, downgrade, grace period và entitlement revocation phải có policy rõ.
- Payment provider là source of truth cho payment instrument/charge; Directus là source of truth cho product access projection.

### 4. Directus Admin and operations

- Product/Billing Admin có thể quản lý plan, feature, quota, promo và entitlement policy.
- Support có thể xem subscription state/provider reference nhưng không xem payment secret.
- Mọi manual override phải có reason, expiry, approver và audit trail.
- Dashboard theo dõi conversion, active Pro, quota exhaustion, webhook lag, payment failure và refund theo provider.

### 5. Pro UX

- Paywall giải thích benefit, quota còn lại, reset time, price/currency và cancellation policy.
- Upgrade/downgrade/cancel flow không làm mất dữ liệu user ngoài policy.
- Quota/entitlement hiển thị song ngữ Việt–Anh.
- Khi hết quota, backend trả error code có cấu trúc và UI đưa ra action hợp lệ; không giả lập Pro.

## Deliverables và evidence

- Monetization PRD và entitlement matrix Free/Pro.
- Directus schema cho plan, feature, subscription, usage và billing events.
- Payment provider comparison và ADR.
- Webhook signature/idempotency tests.
- Atomic usage counter/concurrency tests.
- Admin workflow và Pro UX walkthrough.
- Billing/privacy/terms checklist.

## Acceptance criteria

- User Free không thể gọi Pro endpoint bằng cách sửa request hoặc frontend state.
- User Pro được mở đúng capability trong effective period.
- Subscription webhook gửi lặp không tạo duplicate hoặc cộng quota sai.
- Payment failure/cancel/refund cập nhật entitlement theo policy đã duyệt.
- Usage limit vẫn đúng khi có concurrent requests từ nhiều thiết bị.
- Không lưu card data, secret hoặc provider signature raw ở nơi không được phép.
- Support/Admin action có audit evidence và expiry.
- Price, quota, benefit và billing copy lấy từ cấu hình/translated content, không hardcode.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** giá năm bằng giá 10 tháng (`PRODUCT-003`), entitlement baseline gồm Free search 10 lượt/ngày (`PRODUCT-004`) và quota ngày reset lúc 00:00 `Asia/Ho_Chi_Minh` (`PRODUCT-005`).

1. Với VNPay, nếu recurring không khả dụng thì dùng kỳ Pro trả trước bao lâu và nhắc gia hạn thế nào?
2. Có trial, coupon, referral hoặc grace period không?
3. Refund/cancel/downgrade có giữ quyền đến hết kỳ thanh toán không?
4. Currency/price cho Stripe và VNPay được xác định thế nào?
5. Ai được manual grant/revoke Pro và cần approval mấy bước?
