# Phase 4 Admin Studio Walkthrough

## Nguyên tắc vận hành

- Production Studio chỉ qua VPN theo `SEC-005`; MFA bắt buộc cho human staff.
- Mở dashboard **Phase 4 Operations** để xem dữ liệu thật: failed provider runs, stale forecasts, risk sets chờ review và advisory đã approve nhưng chưa publish.
- Không paste API key, webhook secret, token, raw provider response hoặc card data vào collection.

## Platform Admin - thêm location có provenance

1. Tạo `reference_sources` ở `draft` với publisher, URL, publication version, license và checksum.
2. Sau khi kiểm chứng nguồn, chuyển source sang `approved` với actor/timestamp.
3. Tạo `administrative_versions` cho đúng lần công bố; không nhập số lượng tỉnh/thành cố định vào code.
4. Import/tạo `administrative_units`: province/municipality là cấp chính; district/ward/commune thêm khi nguồn chính thức cung cấp. Parent phải cùng version.
5. Tạo `locations` ở `draft`, gắn source/admin unit nếu có, nhập Point thật và timezone/elevation có nguồn.
6. Đi qua `draft -> review -> approved -> published`; thêm alias và provider mapping sau khi canonical record tồn tại.

## Weather Operations

1. Tạo `weather_providers` chỉ với non-secret config và `credential_reference` trỏ tới secret manager.
2. Kiểm tra preset **Failed provider runs**.
3. Observation/forecast phải có provider, run, parser version, idempotency, issued/valid/fetched/expiry và unit rõ ràng.
4. Không nhập record demo để làm dashboard có số liệu.

## Risk Analyst và Risk Approver

1. Analyst tạo `reference_sources`, rồi `risk_rule_sets` ở draft và các `risk_rules` con.
2. Analyst submit rule-set sang review; từ thời điểm này business fields và rules bị khóa.
3. Approver khác maker kiểm tra source/effective dates, rồi approve/publish.
4. Advisory dùng cùng maker-checker workflow; self-approval bị database và Directus permission chặn.

## Content Editor

1. Tạo `content_pages` release và `translations` theo `vi`/`en`.
2. Dùng namespace/key ổn định; không đưa system UI string frontend vào business content nếu không thuộc release contract.
3. Publish theo workflow và effective dates; draft không phải public data.

## Product/Billing Admin

1. Tạo/chỉnh plan, feature, entitlement, usage policy và price ở draft.
2. Price dùng minor units, ISO currency và provider reference; không nhập payment credential.
3. Payment event chỉ được xem qua sanitized allowlist; webhook ingress mới có quyền append event.
4. Entitlement override phải có lý do, thời hạn và revoke audit.

## Support Auditor

- Chỉ dùng các view/read field được cấp; không sửa record.
- Không yêu cầu hoặc export secret/raw payload/credential.

## Traveler ownership check

Traveler không dùng Studio. Application API/Directus policy tự preset `owner_id` và giới hạn favorite, saved route, search history bằng `$CURRENT_USER`; support/admin không được dùng Super Admin token làm luồng sản phẩm.
