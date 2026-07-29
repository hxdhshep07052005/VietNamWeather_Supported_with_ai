# Decision Register

Tài liệu này là nơi ghi mọi quyết định sản phẩm và kỹ thuật đã được người có thẩm quyền chốt. Không ghi secret, token hoặc thông tin nhạy cảm.

## Quy ước Decision ID

- `PRODUCT-xxx`: phạm vi, người dùng, nghiệp vụ.
- `ARCH-xxx`: kiến trúc và công nghệ.
- `SEC-xxx`: authentication, authorization, privacy, security.
- `DATA-xxx`: data model, provider, retention, quality.
- `OPS-xxx`: hạ tầng, triển khai, vận hành.
- `AI-xxx`: chatbot và chính sách AI.

## Decision template

```text
Decision ID:
Ngày quyết định:
Người quyết định:
Phase:
Vấn đề cần chốt:
Các phương án đã xem xét:
Phương án được chọn:
Lý do:
Trade-off được chấp nhận:
Ảnh hưởng tới phase khác:
Ngày cần review lại:
Evidence/ADR:
```

## Decisions đã chốt

### PRODUCT-001 — Product plans

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 10
- **Vấn đề:** Số lượng và tên gói sản phẩm ban đầu.
- **Quyết định:** Chỉ triển khai hai gói `Free` và `Pro`.
- **Lý do:** Dễ truyền thông, giảm độ phức tạp entitlement/pricing và phù hợp giai đoạn đầu.
- **Trade-off:** Không có gói trung gian hoặc Business trong MVP; muốn thêm phải tạo decision mới và migration entitlement.
- **Review lại:** Khi có dữ liệu conversion, quota usage và nhu cầu doanh nghiệp.

### PRODUCT-002 — Supported locales

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 9
- **Vấn đề:** Ngôn ngữ sản phẩm.
- **Quyết định:** Hỗ trợ `vi` và `en`; kiến trúc i18n có mặt từ MVP.
- **Lý do:** Phục vụ cả khách Việt Nam và khách quốc tế.
- **Trade-off:** Mọi content/risk/billing/legal release phải có translation QA cho hai locale.
- **Review lại:** Khi bổ sung thị trường/ngôn ngữ mới.

### ARCH-001 — Payment providers

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 1 / 10
- **Vấn đề:** Payment provider cho gói Pro.
- **Quyết định:** Dùng Stripe cho thanh toán quốc tế và VNPay cho thanh toán tại Việt Nam, thông qua payment adapter chung.
- **Lý do:** Stripe phù hợp card/subscription quốc tế; VNPay phù hợp phương thức thanh toán nội địa Việt Nam.
- **Trade-off:** Hai provider làm tăng webhook, reconciliation, refund, accounting và test matrix.
- **Ràng buộc:** Khả năng recurring/tokenization của VNPay phải được xác minh theo sản phẩm API và hợp đồng merchant. Nếu không hỗ trợ recurring phù hợp, VNPay chỉ bán kỳ Pro trả trước/manual renewal; không giả lập auto-renew.
- **Ảnh hưởng:** Phase 1, 3, 4, 9, 10, 12, 13 và 14.
- **Review lại:** Sau provider capability review và trước khi ký merchant agreement.

### PRODUCT-003 — Pro billing intervals

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 10
- **Vấn đề:** Chu kỳ thanh toán của gói Pro.
- **Quyết định:** Pro có lựa chọn thanh toán theo tháng và theo năm; gói năm có mức giá hiệu quả thấp hơn gói tháng.
- **Trade-off:** Cần xử lý proration, cancel/refund và entitlement theo hai billing period.
- **Quy tắc giá đã chốt:** Giá năm bằng giá của 10 tháng, tương đương tiết kiệm khoảng 16.7% so với trả từng tháng.

### ARCH-002 — Checkout payment selection

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 1 / 10
- **Vấn đề:** Cách lựa chọn Stripe hoặc VNPay.
- **Quyết định:** Người dùng được chọn phương thức thanh toán trong các option hợp lệ tại checkout.
- **Ràng buộc:** Backend quyết định option nào khả dụng theo market, currency, provider status và merchant capability; frontend không được tự gửi provider tùy ý.
- **Trade-off:** Checkout và support phải giải thích khác biệt recurring/refund giữa hai provider.

### PRODUCT-004 — Initial Free/Pro entitlements

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 10
- **Vấn đề:** Quota và capability baseline cho hai gói.
- **Quyết định:** Chấp thuận entitlement matrix trong Phase 10 với thay đổi `Free location search = 10 lượt/ngày`.
- **Baseline:** Free map/current weather không quota nghiệp vụ; search 10/ngày; forecast 7 ngày; route evaluation 3/ngày; 1 route alternative; 3 saved locations; 1 saved route; history 7 ngày; chatbot 3 tin/ngày nếu bật. Pro search 200/ngày; full provider horizon; 30 route evaluations/ngày; 3 alternatives; 50 saved locations; 20 saved routes; history 90 ngày; chatbot 30 tin/ngày nếu bật.
- **Ràng buộc:** Đây là cấu hình trong Directus, có thể thay đổi bằng decision mới; frontend không được tự enforcement thay backend.
- **Review lại:** Sau khi có dữ liệu usage, provider cost, conversion và abuse rate.

### PRODUCT-005 — Daily quota reset

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 10
- **Vấn đề:** Cách reset usage quota theo ngày.
- **Quyết định:** Quota theo ngày reset lúc `00:00` theo timezone `Asia/Ho_Chi_Minh`.
- **Ràng buộc:** Reset và enforcement thực hiện ở backend; mọi thiết bị/session của cùng user dùng chung counter. Timestamp lưu UTC, kỳ quota được tính theo timezone đã chốt.
- **Trade-off:** Người dùng ngoài Việt Nam vẫn theo ngày Việt Nam; UI phải hiển thị rõ thời điểm reset theo locale/timezone.
- **Review lại:** Khi sản phẩm mở rộng sang thị trường có timezone billing riêng.

### PRODUCT-006 — Anonymous and authenticated access

- **Ngày quyết định:** 2026-07-28
- **Người quyết định:** Product Owner
- **Phase:** 0 / 3 / 9 / 10
- **Vấn đề:** Phạm vi chức năng dành cho khách chưa đăng nhập.
- **Quyết định:** Khách chưa đăng nhập chỉ truy cập landing page. Bản đồ, tìm kiếm, location detail, forecast/trend, route planner, saved items và chatbot đều yêu cầu đăng nhập.
- **Ràng buộc:** Frontend route guard chỉ phục vụ UX; Directus policies/custom endpoints phải deny anonymous access tới dữ liệu và API chức năng. Public role chỉ được đọc marketing content, pricing/plan summary, legal content và locale resources đã publish.
- **Trade-off:** Giảm khả năng trải nghiệm sản phẩm trước đăng ký; landing page cần giải thích giá trị và có CTA đăng ký/đăng nhập rõ ràng.
- **Review lại:** Sau khi có dữ liệu signup conversion và user acquisition.

### PRODUCT-007 — Weather map effects entitlement

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 9 / 10
- **Vấn đề:** Phân chia hiệu ứng bản đồ thời tiết giữa Free và Pro.
- **Quyết định:** Free được sử dụng hiệu ứng thời tiết hiện tại. Pro được sử dụng future timeline, forecast animation và advanced weather overlays.
- **Free scope:** Mưa, mây, nắng/day-night và gió hiện tại khi provider có dữ liệu hợp lệ.
- **Pro scope:** Slider/play-pause theo forecast time, animation tương lai, overlay dự báo nâng cao và toàn bộ forecast horizon provider hỗ trợ.
- **Ràng buộc:** Entitlement được enforcement ở backend; mọi effect phải có source, issued/valid time và freshness. Không sinh hiệu ứng hoặc spatial interpolation khi provider không có dữ liệu phù hợp.
- **Accessibility:** Có layer toggle, `prefers-reduced-motion` và static fallback cho mobile/thiết bị yếu.
- **Review lại:** Sau khi có số liệu performance, usage và Pro conversion.

### DATA-001 — Environment seeding policy

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 2 / 4
- **Vấn đề:** Seed schema, reference data, account và test data an toàn giữa các environment.
- **Quyết định:** Seed được version hóa, idempotent và phân loại theo environment. Production chỉ seed schema/config/reference data đã duyệt; không seed fake weather, fake billing hoặc demo account.
- **Cho phép seed:** Roles/policies baseline, Free/Pro plans, feature keys, usage policies, locale keys/translations, approved location catalog, feature flags mặc định và risk rule ở trạng thái draft nếu được duyệt.
- **Account policy:** Production admin/service account được provision bằng secure bootstrap/secret manager, không ghi password/static token trong seed hoặc Git. Demo/test account chỉ tồn tại ở local/development/staging.
- **Ràng buộc:** Seed chạy lại không tạo duplicate, không ghi đè production business data ngoài migration contract và phải có manifest/checksum/evidence.

### SEC-001 — Backend identity and AI data isolation

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 3 / 11 / 12
- **Vấn đề:** Bảo vệ account, secret và dữ liệu trước frontend tampering, prompt injection và AI jailbreak.
- **Quyết định:** Account/authentication do Directus quản lý. Frontend không chứa password, static token, provider secret, AI key hoặc admin credential. AI orchestration và LLM provider calls chỉ chạy ở backend.
- **Authorization invariant:** AI không được tự truy cập database/GraphQL tùy ý. AI chỉ gọi tool allowlist; mỗi tool tự kiểm tra authenticated user, Directus policy, item-level access, entitlement và field allowlist, độc lập với nội dung prompt/model output.
- **Service identity:** AI dùng service account least-privilege, không dùng Super Admin token. Model không nhận JWT, refresh token, secret, raw user table hoặc collection ngoài nhu cầu.
- **Jailbreak policy:** Prompt/system-message secrecy không được coi là security boundary. Dù model bị jailbreak, tool/API layer vẫn phải deny dữ liệu trái quyền, giới hạn query/result và ghi audit.
- **Session policy:** Browser chỉ giữ session theo auth design được duyệt, ưu tiên secure HttpOnly cookie/same-origin flow; không lưu refresh/static token trong frontend storage.

### ARCH-003 — Frontend API-only boundary

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 1 / 3 / 9
- **Vấn đề:** Mức độ phụ thuộc của frontend vào backend internals.
- **Quyết định:** Frontend chỉ gửi request tới versioned Application API và render response DTO. Frontend không gọi generic Directus collections/REST/GraphQL, database, worker hoặc third-party provider trực tiếp.
- **API boundary:** Public product contract dùng `/api/v1` hoặc version tương đương, được triển khai bằng Directus custom endpoints hoặc thin BFF/gateway đã duyệt. Directus vẫn là primary backend và system of record.
- **Backend-only logic:** Authentication/authorization, entitlement/quota, validation, risk, weather normalization, routing, payment, AI, localization content selection và audit.
- **Frontend-only logic:** Presentation state, form UX, rendering, accessibility, client-side navigation và locale formatting được contract cho phép.
- **Ràng buộc:** Không expose Directus collection names, internal field names, provider payload hoặc stack trace trong public DTO. API có OpenAPI/schema, versioning, structured errors và contract tests.
- **Trade-off:** Cần duy trì facade/DTO mapping nhưng giảm coupling và cho phép thay đổi schema/backend mà không phá frontend.

### PRODUCT-008 — GPS, route objectives and live follow

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 8 / 9
- **Vấn đề:** Dùng GPS hiện tại, lựa chọn loại tuyến và theo dõi khi người dùng di chuyển.
- **Quyết định:** Khi user đã đăng nhập và cấp quyền, web/PWA được lấy vị trí hiện tại, đặt điểm xuất phát, bật follow mode và cập nhật marker khi di chuyển.
- **Route modes:** `Fastest`, `Shortest`, `Weather-safer` và `Balanced` khi routing provider cung cấp đủ alternatives/data.
- **Định nghĩa:** Shortest/Fastest/Weather-safer chỉ được xếp hạng trong tập route alternatives provider trả về. Weather-safer là route có weather-risk score thấp hơn theo forecast tại ETA, không phải bảo đảm an toàn giao thông hay tuyệt đối.
- **Live behavior:** Dùng browser Geolocation API/watch mode khi trang đang hoạt động; hiển thị accuracy, trạng thái permission và nút dừng tracking. Khi lệch route quá threshold được cấu hình, hệ thống có thể đề nghị hoặc thực hiện reroute theo policy đã duyệt.
- **Privacy:** Precise GPS mặc định xử lý tạm thời; không lưu lịch sử vị trí liên tục nếu user chưa opt-in. Backend chỉ nhận tọa độ khi cần tính route/reroute/risk và áp dụng minimization/retention.
- **Platform limit:** Web/PWA không cam kết tracking liên tục khi browser bị đóng, tab bị suspend hoặc màn hình khóa; background turn-by-turn đầy đủ cần native app và nằm ngoài MVP mặc định.
- **Quota:** GPS position updates không tự tiêu quota route. Chỉ request tạo route hoặc reroute backend được tính theo usage policy.

### OPS-001 — Three-month delivery deadline

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 13 / 14
- **Vấn đề:** Deadline mục tiêu cho production MVP.
- **Quyết định:** Dùng baseline 3 tháng theo lịch, từ 2026-07-30 đến target go-live 2026-10-29.
- **Phạm vi deadline:** Core MVP gồm authentication/authorization, Directus Admin Studio, current weather map, forecast/trends, risk engine, route planner + GPS active follow, i18n Việt–Anh, Free/Pro entitlement, Stripe + VNPay, quality/security hardening, deployment và handover.
- **Không nằm trên critical path:** AI chatbot là optional. Chatbot không được làm trễ core MVP; chỉ triển khai nếu release health và capacity cho phép.
- **Ràng buộc:** Timeline được lập cho một solo developer full-time. Provider/merchant feasibility và NFR vẫn phải được kiểm chứng trong Phase 0–1. Không giảm security, payment correctness, data provenance hoặc production evidence để giữ ngày.
- **Cơ chế kiểm soát:** Dùng milestone/exit criteria trong `DELIVERY_ROADMAP_3_MONTHS.md`; scope change phải có impact assessment và Decision ID.
- **Trade-off:** Advanced animation, notification, offline capability và chatbot là các ứng viên giảm scope đầu tiên nếu critical path trễ; không thay bằng fake data hoặc implementation hardcode.

### PRODUCT-009 — Commercial product and target personas

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 9 / 10 / 14
- **Vấn đề:** Bối cảnh sản phẩm và nhóm người dùng cần ưu tiên.
- **Quyết định:** Xây dựng public commercial production MVP cho người dùng thật, không giới hạn ở đồ án hoặc demo nội bộ.
- **Primary persona:** Khách du lịch tự túc trong nước và quốc tế đang ở hoặc chuẩn bị di chuyển tại Việt Nam, ưu tiên trải nghiệm mobile.
- **Support persona:** Admin/operations quản lý địa điểm, bản dịch, risk rule, provider configuration, plan/quota, advisory và dữ liệu vận hành qua Directus Admin Studio.
- **Ràng buộc:** Marketing và UI không được tuyên bố bảo đảm an toàn tuyệt đối; mọi quyết định route/risk phải có source, thời điểm dữ liệu và disclaimer.

### DATA-002 — Vietnam location coverage

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 4 / 5 / 8
- **Vấn đề:** MVP chỉ hỗ trợ danh sách điểm du lịch quản trị hay toàn bộ lãnh thổ Việt Nam.
- **Quyết định:** Cho phép geocoding/reverse-geocoding và weather lookup cho mọi tọa độ hợp lệ tại Việt Nam khi provider hỗ trợ; đồng thời duy trì catalog điểm du lịch nổi bật trong Directus.
- **Ràng buộc:** Biên giới Việt Nam, location catalog và provider coverage phải lấy từ nguồn/reference data được phê duyệt; không hardcode danh sách tỉnh/thành hoặc điểm du lịch trong frontend.
- **Degraded behavior:** Nếu provider không hỗ trợ một tọa độ hoặc dữ liệu không đủ mới, API trả trạng thái unavailable/unknown rõ ràng, không tạo dữ liệu thay thế giả.

### DATA-003 — GPS, history and saved-data retention baseline

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 4 / 8 / 9 / 12
- **Vấn đề:** Dữ liệu vị trí và lịch sử nào được phép lưu.
- **Quyết định:** Precise GPS mặc định chỉ xử lý tạm thời cho current location, route/reroute và weather lookup; không lưu lịch sử di chuyển liên tục. Search history được lưu 7 ngày cho Free và 90 ngày cho Pro. Favorites/saved locations/saved routes được lưu theo quota của `PRODUCT-004`.
- **User control:** Người dùng có thể xóa history/saved data và tắt lưu search history. Xóa account phải kích hoạt quy trình xóa hoặc ẩn danh dữ liệu theo retention/legal policy đã duyệt.
- **Ràng buộc:** Không dùng GPS/search history cho analytics, quảng cáo hoặc AI training nếu chưa có consent và Decision ID riêng.

### OPS-002 — Initial monthly operating budget ceiling

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 1 / 5 / 8 / 10 / 13
- **Vấn đề:** Cost envelope ban đầu cho production MVP.
- **Quyết định:** Dùng baseline ceiling `15.000.000 VND/tháng` cho cloud/VPS-related services, weather/map/geocoding/routing APIs và monitoring.
- **Ngoại lệ:** Phí giao dịch theo doanh thu của Stripe/VNPay không nằm trong ceiling này; fixed merchant/service fees nếu có phải được đưa vào cost model trước khi ký.
- **Ràng buộc:** Phase 1 phải tạo cost model theo expected load và cảnh báo 50%/75%/90%/100% budget. Không tự động vượt ceiling hoặc đổi provider mà không có approval.

### PRODUCT-010 — Product and risk approval ownership

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 6 / 10 / 14
- **Vấn đề:** Quyền phê duyệt scope, pricing, refund, disclaimer và risk rule.
- **Quyết định:** Chủ dự án tự đảm nhiệm Product Owner, Technical Owner, development, QA/DevOps, business approval và Risk Reviewer cho MVP.
- **Kiểm soát khi một người giữ nhiều vai trò:** Mọi approval quan trọng phải có Decision ID, nguồn tham chiếu, automated test và evidence riêng; không được coi tự phê duyệt là bằng chứng kỹ thuật. Risk threshold phải dẫn nguồn chính thức/đáng tin cậy, version hóa và có disclaimer.
- **Ràng buộc:** Nếu chủ dự án không có chứng nhận/chuyên môn khí tượng hoặc an toàn tương ứng, sản phẩm chỉ mô tả risk output là advisory hỗ trợ quyết định, không quảng bá là đánh giá an toàn có thẩm quyền hoặc thay thế cơ quan chức năng.

### OPS-003 — Local-first development and owner-managed VPS

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / 1 / 2 / 13
- **Vấn đề:** Môi trường phát triển và đích triển khai production.
- **Quyết định:** Phát triển và kiểm thử ban đầu trên local; production self-host Directus và các service cần thiết trên VPS/server do Product Owner sở hữu hoặc quản lý. Không khóa vào cloud vendor cụ thể.
- **Release ownership:** Product Owner là infrastructure owner/final production release approver, trừ khi ủy quyền bằng decision mới.
- **Ràng buộc production:** Deployment phải reproducible bằng container/configuration automation; không sửa source hoặc secret thủ công trên server. Bắt buộc HTTPS, firewall, database/cache không public, least-privilege access, off-site backup, restore test, monitoring và rollback.
- **Deferred deployment inventory:** VPS region, OS, CPU/RAM/storage, network, domain/DNS, backup target và khả năng tách staging/production được chốt tại Phase 13 trước production deployment; không là blocker của local development hoặc Phase 0.

### OPS-004 — Solo full-time delivery ownership

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0 / all delivery phases
- **Vấn đề:** Capacity và phân công thực hiện roadmap ba tháng.
- **Quyết định:** Một người thực hiện dự án full-time và đảm nhiệm toàn bộ implementation, review, QA, DevOps và product decisions.
- **Planning rule:** Roadmap ưu tiên vertical slice và automation để giảm context switching. Không giả định có thêm frontend/backend/QA chuyên biệt nếu chưa có decision mới.
- **Trade-off:** Bus factor bằng một và không có independent review mặc định. Compensating controls gồm checklist, static analysis, dependency/security scanning, automated test, reproducible evidence và stop-the-line conditions.
