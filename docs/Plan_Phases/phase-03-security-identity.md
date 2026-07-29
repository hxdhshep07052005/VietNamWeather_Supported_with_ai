# Phase 3 — Identity, JWT, RBAC & Security

**Status:** BLOCKED  
**Phụ thuộc:** Phase 2 VERIFIED  
**Mục tiêu:** Xây authentication và authorization theo least privilege, phù hợp browser production và Admin Studio.

## Phạm vi công việc

### 1. Authentication flow

- Cấu hình Directus login, access token/JWT, refresh, logout và revoke.
- Access token sống ngắn; thời lượng phải cấu hình qua environment và được duyệt.
- Chọn cookie/session hoặc access token in-memory + refresh cookie an toàn cho browser.
- Không lưu refresh token hoặc static admin token trong `localStorage`.
- Thiết kế forgot password, email verification và account lock/throttling nếu có registered user.
- Bật MFA/2FA cho vai trò quản trị khi deployment option hỗ trợ.

### 2. Roles and policies

- Tạo role/policy matrix theo `PLAN_MASTER.md`.
- Public role mặc định deny; chỉ mở đúng collection, item và field cần thiết.
- Theo `PRODUCT-006`, public role chỉ đọc landing/pricing/legal/locale content; weather/map/search/route endpoints yêu cầu authenticated accountability.
- Tách quyền create/update/publish risk rule.
- Tách service account theo weather ingestion, routing và chatbot.
- Tạo policy riêng cho Product/Billing Admin và payment webhook service.
- Thiết lập item-level ownership cho dữ liệu cá nhân nếu có.
- Kiểm tra quyền của custom endpoint/hook; không dùng admin accountability mặc định.
- Entitlement phải được kiểm tra server-side; JWT claim chỉ là cache hint nếu được dùng, không phải nguồn sự thật duy nhất.
- Account, role, policy và service identity nằm trong Directus/backend; frontend không chứa credential hoặc static service token.
- Frontend chỉ gửi request qua Application API; API tự xác minh session/accountability và không tin role/plan/user ID do client tự khai báo.

### 3. Platform security

- TLS, HSTS, CSP, secure headers, CORS allowlist và CSRF mitigation phù hợp auth mode.
- Rate limit theo IP/user/endpoint; giới hạn payload, query depth và file upload.
- Admin Studio qua VPN/IP allowlist hoặc control đã duyệt.
- Secret scanning, dependency scanning và container scanning.
- Redact token, cookie, secret và PII khỏi log.

### 4. Audit and incident readiness

- Log login success/failure, permission changes, rule publish và service-account activity.
- Alert khi có brute-force, bất thường quyền hoặc provider credential failure.
- Viết token compromise playbook và access review schedule.
- Payment webhook signature, replay protection và idempotency phải được kiểm tra trước khi cập nhật subscription.
- Billing/admin support không được xem card data hoặc payment secret.
- AI endpoint yêu cầu authenticated user và không expose system prompt, LLM key, Directus service token hoặc raw internal error.

## Deliverables và evidence

- Auth sequence diagram.
- Role-policy-permission matrix.
- Automated permission tests cho từng role.
- Security configuration checklist và threat-model update.
- Token revoke/rotation drill evidence.

## Acceptance criteria

- Public user không đọc được field nội bộ hoặc collection admin.
- Public user không gọi được weather, search, forecast, risk, route, saved-item hoặc chatbot API.
- User A không truy cập được dữ liệu riêng của User B.
- Service account không thể quản lý user, role hoặc policy.
- Logout/revoke làm refresh credential mất hiệu lực theo thiết kế.
- Không có static token trong frontend bundle, source map hoặc log.
- Thay đổi JavaScript/client request không thể mở rộng quyền Directus, entitlement hoặc AI tool access.
- Frontend không thể bypass facade để gọi Directus generic collection API trong production network/policy.
- Mọi admin action quan trọng để lại audit evidence.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** User phải đăng nhập để dùng mọi product feature; anonymous chỉ xem landing page (`PRODUCT-006`).

1. Chọn auth transport nào cho browser? Khuyến nghị: secure HttpOnly cookie/same-origin flow khi kiến trúc cho phép.
2. Có yêu cầu social login hoặc enterprise SSO không?
3. Admin Studio được bảo vệ bằng VPN, IP allowlist hay identity-aware proxy?
4. Access token TTL, refresh lifetime và session concurrency policy mong muốn là gì?
5. Có bắt buộc MFA cho toàn bộ staff hay chỉ admin/risk approver/billing admin?
6. Audit/security log và billing event reference cần giữ bao lâu?
7. Khi subscription state và JWT claim khác nhau, policy revalidation/deny Pro mong muốn là gì?
