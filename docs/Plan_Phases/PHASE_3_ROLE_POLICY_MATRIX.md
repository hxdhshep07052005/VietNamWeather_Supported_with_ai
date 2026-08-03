# Phase 3 Role–Policy–Permission Matrix

**Trạng thái:** APPROVED (`SEC-008`)  
**Phase:** 3 — Identity, JWT, RBAC & Security  
**Decision baseline:** `PRODUCT-015`, `SEC-004`, `SEC-005`, `SEC-006`, `SEC-007`  
**Phạm vi:** Logical authorization contract trước khi chốt collection/field cụ thể ở Phase 4

Tài liệu này định nghĩa quyền theo domain nghiệp vụ, không giả định tên collection cuối cùng. Phase 4 phải map từng domain sang schema Directus thật và tạo permission manifest có version/checksum. Không được cấp quyền rộng hơn matrix này chỉ vì một collection mới được thêm.

## 1. Nguyên tắc bắt buộc

- Default deny cho public, user, staff và service identity; chỉ mở action/field/item có trong matrix.
- Application API là facade duy nhất của browser. Directus generic REST/GraphQL không được expose ở product origin.
- User/accountability được lấy từ server-side session; `user_id`, `role`, `plan`, quota và entitlement trong request body bị bỏ qua hoặc reject.
- `owner_id`, actor và service identity được backend gán; client không được tự chọn owner hoặc elevate role.
- Directus policy, Application API authorization và entitlement/quota check phải cùng fail closed.
- Quyền publish/approve là quyền riêng, không gộp với quyền soạn thảo trong production.
- Service account không có quyền quản lý user, role, policy, secret hoặc Admin Studio.
- Mọi quyền đọc PII, audit, billing reference và precise location đều bị giới hạn theo field, purpose và retention.

## 2. Ký hiệu permission

| Ký hiệu | Ý nghĩa |
|---|---|
| `—` | Deny |
| `R-PUB` | Read dữ liệu đã publish, không có field nội bộ |
| `R-OWN` | Read item thuộc chính actor |
| `R-SCOPE` | Read theo domain/job/provider scope được cấp |
| `C-OWN` | Create item với owner do server gán |
| `U-OWN` | Update item thuộc actor, chỉ field cho phép |
| `C-SCOPE` / `U-SCOPE` | Create/update trong scope service hoặc domain |
| `D-OWN` | Delete/cancel item của actor theo lifecycle policy |
| `DRAFT` | Tạo/sửa draft, không publish |
| `APPROVE` | Review/approve version đã đủ evidence |
| `PUBLISH` | Chuyển version đã approve sang effective |
| `EXEC` | Gọi command/custom endpoint; quota/entitlement vẫn kiểm tra server-side |
| `R-META` | Read metadata tối thiểu, không đọc secret/raw payload |

## 3. Identity và quyền truy cập Admin Studio

| Identity | Directus Studio | MFA / network | Phạm vi chính | Ràng buộc quan trọng |
|---|---|---|---|---|
| `Super Admin` | `admin_access=true` | MFA + WireGuard; break-glass | Khôi phục hệ thống, quản trị role/policy, migration khẩn cấp | Không dùng hàng ngày; mọi hành động phải có audit reason và review |
| `Platform Admin` | Có `app_access`, không mặc định full admin | MFA + WireGuard | App config không-secret, feature flags, vận hành được ủy quyền | Không đọc secret, card data, password, token; không tự sửa role/policy |
| `Weather Operations` | Có `app_access` giới hạn | MFA + WireGuard | Provider run/health, ingestion error, normalized weather operations | Không quản lý user, billing, risk publish hoặc security policy |
| `Risk Analyst` | Có `app_access` giới hạn | MFA + WireGuard | Soạn risk rule draft và phân tích evidence | Không approve/publish rule của chính mình |
| `Risk Approver` | Có `app_access` giới hạn | MFA + WireGuard | Review và approve/publish rule đã đủ evidence | Không sửa draft sau khi review; không giữ policy author trong production |
| `Content Editor` | Có `app_access` giới hạn | MFA + WireGuard | Soạn và publish content/i18n/legal theo workflow | Không sửa risk, plan, payment, security config |
| `Product/Billing Admin` | Có `app_access` giới hạn | MFA + WireGuard | Plan, entitlement config, promo và billing projection | Không xem card/CVV/payment secret; không sửa security policy |
| `Support/Auditor` | Có `app_access` read-only | MFA + WireGuard | Tra cứu sanitized audit, account/support state và payment reference tối thiểu | Không đọc raw secret/PII quá mục đích; không mutate business state |
| `Registered Traveler` | Không có Studio | Session cookie; không yêu cầu MFA MVP | Product API với Free/Pro entitlement | Chỉ dữ liệu own; không truy cập Directus generic API |
| `Public` | Không có Studio | Không có identity | Landing/published marketing/pricing/legal/locale DTO | Không gọi weather/search/route/saved/chat API |

`Platform Admin`, các staff role và `Support/Auditor` không được cấp quyền liệt kê/quản trị `directus_roles`, `directus_policies`, `directus_permissions`, `directus_sessions` hoặc secret-management. Directus có thể trả self user và own-role metadata tối thiểu để Studio hoạt động; negative test phải chứng minh không liệt kê được user/role khác và password, MFA secret, token, auth data đều bị redact. Chỉ `Super Admin` break-glass được quản trị các system permission này.

## 4. Logical domain matrix cho human identity

| Domain | Public | Registered Traveler | Support/Auditor | Content Editor | Risk Analyst | Risk Approver | Weather Operations | Product/Billing Admin | Platform Admin |
|---|---|---|---|---|---|---|---|---|---|
| Published marketing/pricing/legal/locale | `R-PUB` | `R-PUB` | `R-PUB` | `DRAFT` + `PUBLISH` trong content scope | `R-PUB` | `R-PUB` | `R-PUB` | `R-PUB` | `R-PUB` |
| User profile/auth state | `—` | `R-OWN` + `U-OWN` field giới hạn | `R-SCOPE` masked | `—` | `—` | `—` | `—` | `R-SCOPE` non-secret | `R-SCOPE` non-secret |
| Session/security records | `—` | `—` | `R-SCOPE` sanitized | `—` | `—` | `—` | `R-META` job auth | `—` | `R-META` operational |
| Location catalog | `—` | `EXEC` search theo quota | `R-PUB` | `R-PUB` | `R-PUB` | `R-PUB` | `R-SCOPE` ingestion | `R-PUB` | `U-SCOPE` nếu được ủy quyền |
| Current weather/forecast DTO | `—` | `EXEC` theo entitlement | `R-SCOPE` support-safe | `—` | `R-PUB` evidence | `R-PUB` evidence | `C-SCOPE` / `U-SCOPE` provider scope | `R-META` usage | `R-META` health |
| Provider config/health | `—` | `—` | `R-META` | `—` | `—` | `—` | `R-SCOPE` không secret | `—` | `U-SCOPE` non-secret |
| Risk rule draft/version | `—` | `R-PUB` effective only | `R-META` | `—` | `DRAFT` | `R-SCOPE` review | `R-PUB` effective | `—` | `R-META` |
| Risk rule approval/publish | `—` | `—` | `R-META` | `—` | `—` | `APPROVE` + `PUBLISH` | `—` | `—` | `—` |
| Risk assessment/evidence | `—` | `EXEC` own request | `R-SCOPE` masked | `—` | `R-PUB` | `R-PUB` | `R-SCOPE` diagnostics | `R-META` usage | `R-META` |
| Route request/result | `—` | `C-OWN` + `R-OWN` + `D-OWN` | `R-SCOPE` support-safe | `—` | `R-PUB` aggregate | `R-PUB` aggregate | `R-SCOPE` job | `R-META` usage | `R-META` health |
| Saved locations/routes | `—` | `C-OWN` + `R-OWN` + `U-OWN` + `D-OWN` | `—` | `—` | `—` | `—` | `—` | `—` | `—` |
| Plans/feature/entitlement/usage | `R-PUB` summary | `R-OWN` capability DTO | `R-META` support-safe | `—` | `—` | `—` | `—` | `DRAFT` + `APPROVE` + `PUBLISH` config | `R-META` |
| Subscription/payment reference | `—` | `R-OWN` sanitized + `EXEC` checkout | `R-SCOPE` minimum reference | `—` | `—` | `—` | `—` | `C-SCOPE` / `U-SCOPE` projection | `R-META` reconciliation |
| Audit/security/business events | `—` | `R-OWN` security notices only | `R-SCOPE` sanitized | `R-META` content publish | `R-META` own changes | `R-META` approval | `R-SCOPE` service events | `R-SCOPE` billing events | `R-SCOPE` platform events |
| Chat session/message (optional) | `—` | `C-OWN` + `R-OWN` + `D-OWN` | `—` | `—` | `—` | `—` | `—` | `R-META` usage | `R-META` health |

`EXEC` trong bảng chỉ là quyền gọi command. Application API vẫn phải kiểm tra session, role, ownership, feature entitlement, quota, input schema và provider availability trước khi thực hiện.

## 5. Service-account matrix

Service account chỉ chạy non-interactive, được provision ngoài seed production, không có MFA bypass và không được dùng cho Admin Studio.

| Service identity | Được phép | Bị deny tuyệt đối | Scope / safety |
|---|---|---|---|
| `Weather Ingestion Service` | Read provider config reference không-secret; create/update provider run, normalized observation/forecast, freshness/quality status | Users, roles, policies, sessions, billing, payment secret, risk publish | Chỉ provider/location scope; idempotency key; không ghi raw secret |
| `Route Evaluation Service` | Read approved locations, route jobs, effective risk rules, weather evidence; create/update route alternatives, samples, assessment results | Users, roles, policies, billing, payment, plan/entitlement mutation | Chỉ job được queue cấp; không tự tạo route geometry khi provider không trả |
| `Payment Webhook Ingress` | Verify signature ở edge; create immutable webhook/IPN event và idempotency reference | User role, entitlement grant, payment secret readback, direct subscription mutation | Raw body chỉ giữ theo retention/legal policy; ACK nhanh sau durable insert |
| `Payment Reconciliation Service` | Read ordered payment events; create/update subscription, invoice/refund reference và entitlement projection theo workflow | Card/CVV, provider secret export, users/roles/policies, arbitrary DB write | Idempotent state transition; reconciliation evidence bắt buộc |
| `AI Tool Service` *(optional)* | Gọi allowlisted weather/risk/route/content tools với acting-user context | Raw DB/GraphQL, user list, secrets, tokens, payment mutation, role/policy changes | Disabled cho tới Phase 11; mỗi tool tự authorize và field-filter |

Không có role chung tên `Integration Service` với quyền tổng hợp. Nếu cần workload mới, phải tạo identity riêng và decision/evidence riêng.

## 6. Ownership và field-level rules

- `owner_id` của saved location, saved route, route request, chat session và user preference do session backend gán, immutable sau create.
- Registered Traveler chỉ đọc/sửa/xóa item của chính mình; User A không thể truy cập item của User B dù biết ID hoặc thay đổi request body.
- Support/Auditor xem reference đã mask; không xem password hash, reset token, session handle, MFA secret, provider credential, card number hoặc CVV.
- Human admin chỉ xem payment customer/order/subscription reference cần hỗ trợ. Card data/CVV không được lưu trong hệ thống.
- Provider config chỉ lưu reference/config không-secret; secret value do runtime secret manager cấp và không xuất hiện trong Directus DTO.
- Precise GPS chỉ xử lý transient cho route/reroute hoặc lưu khi user opt-in; audit/log dùng coarse/minimized representation.
- Role, policy, status, quota, plan và entitlement không nằm trong field user được phép tự sửa.
- Password, email verification, MFA enrollment/recovery và session revoke đi qua auth endpoint; không cho update trực tiếp collection generic.

## 7. Separation-of-duties rules

1. `Risk Analyst` được draft nhưng không được approve/publish cùng version.
2. `Risk Approver` chỉ approve/publish version có evidence và không được sửa nội dung draft sau khi submit.
3. `Product/Billing Admin` quản lý plan/entitlement projection nhưng không quản lý role/policy/security config.
4. `Platform Admin` quản lý app config không-secret nhưng không xem payment secret/card data hoặc sửa risk publish nếu không được cấp policy riêng.
5. `Support/Auditor` read-only; không có quyền tự sửa account, subscription, quota hoặc audit record.
6. Service identity không được gán policy human hoặc đăng nhập interactive.
7. Break-glass `Super Admin` không dùng làm actor mặc định cho Application API/worker; mọi lần dùng phải có reason, timestamp, actor và post-incident review.

## 8. Mapping và test obligations

Phase 4 phải tạo mapping table từ từng logical domain ở trên sang collection/field/item filter thật, kèm:

- policy/permission manifest versioned, checksum và environment scope;
- positive tests cho từng allow path;
- negative tests public, cross-user, staff separation và service-account boundary;
- kiểm tra Directus generic REST/GraphQL bị chặn từ product origin;
- kiểm tra mutation không thể nâng role/plan/quota/entitlement bằng client payload;
- audit evidence cho login, policy change, risk publish, billing transition và service activity.

Chưa có collection/permission nào được coi là đã triển khai chỉ vì matrix này tồn tại. Product Owner đã duyệt logical contract tại `SEC-008`; implementation vẫn phải có manifest và test thật trước khi được ghi evidence.
