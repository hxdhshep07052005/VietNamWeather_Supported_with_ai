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
- **Baseline:** Free map/current weather không quota nghiệp vụ; search 10/ngày; forecast theo Free horizon do backend/provider capability công bố; route evaluation 3/ngày; 1 route alternative; 3 saved locations; 1 saved route; history 7 ngày; chatbot 3 tin/ngày nếu bật. Pro search 200/ngày; full provider-approved horizon; 30 route evaluations/ngày; 3 alternatives; 50 saved locations; 20 saved routes; history 90 ngày; chatbot 30 tin/ngày nếu bật.
- **Superseding forecast note:** `ARCH-013` và `PRODUCT-012` cấm coi 7 ngày là guaranteed entitlement. Trần cấu hình có thể là 7 ngày nhưng current account chỉ trả 3 ngày; frontend phải dùng capability DTO thực tế.
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
- **Superseding note:** `ARCH-012` tạo ngoại lệ hẹp cho browser tải Geoapify map tile/style bằng key riêng. Ngoại lệ này không áp dụng cho geocoding, routing, weather, payment, AI hoặc business API.

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

### PRODUCT-011 — Phase 0 product contract approval

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner
- **Phase:** 0
- **Vấn đề:** Phê duyệt toàn bộ artifact và evidence của Discovery & Product Contract.
- **Quyết định:** Product Owner phê duyệt `PRD.md`, provider shortlist/bake-off approach, privacy retention/control baseline, acceptance metrics, provisional NFR targets và các payment feasibility constraints trong `PHASE_0_EVIDENCE.md`.
- **Ràng buộc tại thời điểm Phase 0:** Final providers phải được chọn tại Phase 1; Stripe/VNPay không được coi là production-ready khi thiếu merchant evidence. Ràng buộc này đã được giải quyết bởi `ARCH-012`, `ARCH-013` và `OPS-006`: provider baselines đã chốt, còn payment providers fail closed/disabled cho tới phase merchant enablement.
- **Kết quả:** Phase 0 chuyển sang `VERIFIED`; Phase 1 được mở ở trạng thái `AWAITING_DECISION`.

### ARCH-004 — Directus and integration worker boundary

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1
- **Quyết định:** Directus là primary backend, system of record, Admin Studio và host của versioned application endpoints ngắn. Một integration worker riêng xử lý weather ingestion, route evaluation, reconciliation, scheduled jobs và tác vụ dài/retry-heavy.
- **Ràng buộc:** Frontend chỉ gọi `/api/v1`; worker không public cho browser; Directus Flows không được dùng thay queue cho job dài hoặc critical payment processing.

### ARCH-005 — PostgreSQL with PostGIS

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1
- **Quyết định:** Dùng PostgreSQL và bật PostGIS cho route geometry, location, spatial index/query và future geospatial needs.
- **Ràng buộc:** Public API không expose database/PostGIS schema; migration phải version hóa và rollback/restore được.

### ARCH-006 — Next.js TypeScript PWA frontend

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 9
- **Quyết định:** Frontend dùng Next.js + TypeScript. Landing/legal pages hỗ trợ SSR/SEO; authenticated product là client-rich application. Bổ sung PWA shell cho installability và active geolocation follow.
- **Ràng buộc:** Không quảng bá offline weather/navigation; service worker không cache private API response ngoài policy đã duyệt; provider keys/business rules không nằm ở frontend.

### ARCH-007 — Redis cache, queue and coordination

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 2 / 5 / 8 / 10
- **Quyết định:** Dùng Redis cho cache ngắn hạn, distributed rate limiting, idempotency coordination, locks và job queue giữa Directus/worker.
- **Ràng buộc:** Redis không là system of record cho subscription/payment; mất cache không được làm mất business state; database projection vẫn authoritative.

### SEC-002 — Private Directus Admin Studio

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 3 / 13
- **Quyết định:** Production Directus Admin Studio không mở tự do ra public internet; truy cập qua VPN hoặc IP allowlist và role/policy least privilege.
- **Ràng buộc:** Application API public được tách route/network policy khỏi Admin Studio; emergency access phải auditable và có revoke procedure.

### ARCH-008 — Payment webhook ingress and worker processing

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 10
- **Quyết định:** Public webhook/IPN ingress nằm tại versioned backend endpoint/gateway: đọc raw body, xác thực signature/checksum, lưu immutable event/idempotency record rồi enqueue. Worker xử lý state transition, entitlement projection và reconciliation.
- **Ràng buộc:** Browser return URL không cấp Pro; event replay/out-of-order phải an toàn; worker retry không tạo duplicate state.

### ARCH-009 — Hybrid i18n ownership

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 4 / 9
- **Quyết định:** Frontend locale catalog quản lý UI/system keys; Directus quản lý translated business, advisory, pricing summary và legal content. API trả stable message/error code thay vì hardcode câu chữ nghiệp vụ.
- **Ràng buộc:** `vi` và `en` phải qua missing-key/content publish checks; fallback không được làm mất disclaimer hoặc hiển thị sai locale billing/legal.

### OPS-005 — Initial NFR and load baseline

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 12 / 13
- **Quyết định:** Baseline gồm availability 99.5%/tháng; cached API p95 <= 500 ms; provider-backed API p95 <= 3 giây trước degraded response; payment entitlement sync p95 <= 60 giây và reconciliation <= 15 phút; RPO <= 24 giờ; RTO <= 4 giờ.
- **Load target:** Test tối thiểu 100 authenticated users đồng thời, 300 application API requests/phút và 500 route evaluations/ngày trong cost envelope.
- **Ràng buộc:** Kết quả load/provider bake-off có thể làm target chặt hơn hoặc điều chỉnh bằng decision mới; không âm thầm nới target để pass test.

### ARCH-010 — Conditional payment-provider availability

- **Ngày quyết định:** 2026-07-29
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 10
- **Quyết định:** Payment adapter hỗ trợ Stripe và VNPay nhưng backend chỉ công bố capability đã có evidence. Stripe mặc định feature-disabled cho tới khi có merchant entity đủ điều kiện. VNPay mặc định prepaid/manual renewal cho tới khi có xác nhận unattended recurring bằng hợp đồng/API production.
- **Ràng buộc:** Không giả lập recurring, không dùng merchant identity không hợp lệ và không cấp entitlement từ browser redirect.

### DATA-004 — Operational forecast horizon for route and risk

- **Ngày quyết định:** 2026-07-30
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 5 / 6 / 7 / 8 / 9
- **Vấn đề:** Khoảng thời gian forecast nào đủ điều kiện chạy weather-risk và weather-safer route, và dữ liệu xa hơn phải được trình bày thế nào.
- **Quyết định:** Route/risk operational horizon ban đầu là tối đa `72 giờ` tính từ thời điểm đánh giá đến ETA cuối tuyến. Từ sau 72 giờ đến hết ngày thứ 7 chỉ được hiển thị dưới dạng `outlook`/độ tin cậy thấp và không được tạo weather-safer route score hoặc tuyên bố tuyến an toàn hơn. Dữ liệu xa hơn 7 ngày, nếu provider và entitlement cho phép hiển thị, chỉ mang tính tham khảo dài hạn và không tham gia route/risk recommendation.
- **Không hardcode:** `operational_horizon_hours = 72` và `outlook_horizon_days = 7` là cấu hình version hóa/publish trong Directus. Backend đọc cấu hình đã duyệt; frontend chỉ render capability/horizon do `/api/v1` trả về.
- **Thiếu dữ liệu:** Route có ETA vượt horizon hoặc forecast không phủ đủ segment phải trả `unsupported_horizon`, `incomplete` hoặc `unknown`; không cắt bớt tuyến, kéo dài forecast hay nội suy giả để tạo score.
- **Review lại:** Sau provider bake-off và khi có evidence accuracy/freshness theo lead time tại Việt Nam. Mọi thay đổi cần Decision ID mới, nguồn dữ liệu và regression evidence.

### ARCH-011 — Directus 12.1.1 version and license baseline

- **Ngày quyết định:** 2026-07-30
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 2 / 13
- **Vấn đề:** Exact Directus release/image/license nào được dùng để tránh floating version và unverifiable commercial-use assumptions.
- **Quyết định:** Pin Directus `12.1.1` bằng container manifest digest `sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d`. License file trong tag `v12.1.1` là `MSCL-1.0-GPL`; evidence được lưu trong `DIRECTUS_BASELINE.md` và `ADR-009`.
- **License fit:** Sản phẩm dùng Directus nội bộ làm backend/Admin Studio cho travel application, không cung cấp Directus như sản phẩm cạnh tranh. Không bypass protected license functionality. Nếu business model hoặc cách phân phối thay đổi phải có legal review/decision mới.
- **Upgrade rule:** Không dùng `latest`. Trước staging/production phải recheck patch/security/license và chạy migration/rollback evidence; version mới chỉ được dùng sau approval.

### ARCH-012 — MapLibre and Geoapify Free map stack

- **Ngày quyết định:** 2026-07-30
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 8 / 9 / 13
- **Vấn đề:** Chọn map/geocoding/routing stack đơn giản, không yêu cầu card billing ở giai đoạn MVP và không tự host tiles/routing phức tạp.
- **Quyết định:** Dùng MapLibre GL JS làm map renderer và Geoapify Free làm baseline cho map tiles/style, geocoding và routing. Không tích hợp Mapbox, Google Maps hoặc HERE trong MVP.
- **Browser boundary:** Browser chỉ được gọi trực tiếp Geoapify tile/style endpoints bằng dedicated browser key. Geocoding, reverse geocoding, routing, ETA, route alternatives và mọi business/risk operation vẫn đi qua `/api/v1` và dùng server-side key riêng.
- **Verified public terms:** Tại thời điểm kiểm tra 2026-07-30, Geoapify Free công bố 3.000 credits/ngày, không yêu cầu credit card, nhiều API key, tối đa 5 request/giây và cho phép limited commercial use với attribution.
- **Cost control:** Không gắn card hoặc tự động nâng paid plan trong MVP. Credit usage/limits là config và metric, không hardcode rải rác. Khi hết quota, hệ thống trả unavailable/degraded state; không proxy sang public OSM/Nominatim và không tạo dữ liệu giả.
- **Security:** Browser key được coi là publishable credential, tách khỏi server key, chỉ dùng cho tile/style, theo dõi quota và rotate khi cần. Server key không được xuất hiện trong frontend, log hoặc URL public do ứng dụng tạo.
- **Trade-off:** Đơn giản và không có charge tự động, nhưng Free plan không có production SLA bảo đảm và quota có thể không đủ khi traffic tăng. Provider-neutral DTO/adapter được giữ để thay provider sau này.
- **Live evidence:** Initial probe, full Vietnam fixtures and route-objective probes passed on 2026-07-31 and are recorded in `MAP_BAKEOFF_REPORT.md` and `VIETNAM_PROVIDER_FIXTURE_REPORT.md`. Browser attribution/key enforcement and dashboard reconciliation remain Phase 9/13 evidence; pricing/terms must be rechecked before production.

### ARCH-013 — WeatherAPI capability-bounded baseline

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 5 / 6 / 7 / 8 / 9 / 13
- **Vấn đề:** Chọn weather provider mà không mua hoặc giả lập capability chưa có, trong khi account hiện tại chỉ trả 3 forecast days và OpenWeather One Call 4.0 chưa được subscribe.
- **Quyết định:** Dùng WeatherAPI làm primary point-weather adapter ban đầu. Backend chỉ công bố capability/horizon thật từ response và account; ngày 4–7 bị capability-disable cho tới khi có evidence account tương ứng. OpenWeather Current 2.5 không được dùng làm silent fallback cho forecast.
- **Horizon:** `DATA-004` là trần tối đa, không phải cam kết coverage. Route/risk chỉ chạy trên phần giao giữa horizon cấu hình và thời gian provider trả dữ liệu hợp lệ; ngoài coverage trả `unsupported_horizon`, `incomplete` hoặc `unknown`.
- **No fabrication:** Không extrapolate ngày thiếu, không kéo dài forecast, không ghép current của provider khác để giả thành cùng forecast provenance.
- **Cost:** Không phê duyệt paid weather upgrade trong Phase 1. Upgrade/secondary provider cần Decision ID, account pricing, terms và regression evidence mới.
- **Evidence:** 30/30 Vietnam locations trả HTTP 200 với current + 3 days; p50 86 ms, p95 310 ms. Chi tiết tại `WEATHER_BAKEOFF_REPORT.md`, `VIETNAM_PROVIDER_FIXTURE_REPORT.md` và `ADR-011`.

### OPS-006 — Provider budget and external capability closure

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 1 / 8 / 10 / 13
- **Vấn đề:** Phase 1 cần cost/payment gate rõ ràng dù provider không trả credit header và chưa có Stripe/VNPay merchant credentials.
- **Quyết định:** Current approved automatic provider spend là 0 VND. Geoapify không auto-upgrade paid; WeatherAPI paid upgrade chưa được duyệt; Stripe và VNPay không xuất hiện trong backend capability output khi chưa có merchant evidence.
- **Metering:** Backend ghi request/operation ledger theo provider/endpoint/feature/user entitlement nhưng không giả định request bằng credit. Dashboard/invoice reconciliation là evidence bắt buộc trước production tại Phase 13.
- **Payment:** Stripe giữ feature-disabled. VNPay cũng disabled tới khi onboarding merchant; sau đó chỉ prepaid/manual renewal cho tới khi recurring được chứng minh bằng contract/API production.
- **Failure policy:** Thiếu usage telemetry, quota hoặc merchant evidence làm optional capability fail closed/degraded; không tự chi, không cấp Pro và không fallback bằng dữ liệu/payment giả.
- **Evidence:** `COST_ENVELOPE.md`, `PAYMENT_CAPABILITY_REPORT.md`, `MAP_BAKEOFF_REPORT.md` và `VIETNAM_PROVIDER_FIXTURE_REPORT.md`.

### PRODUCT-012 — Phase 1 architecture approval

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 1
- **Vấn đề:** Phê duyệt architecture/NFR/provider/security/cost baseline để mở Directus Foundation.
- **Quyết định:** Phê duyệt `ARCHITECTURE.md`, `DATA_FLOW.md`, ADR-001..011, `NFR_SLO.md`, `THREAT_MODEL.md`, `COST_ENVELOPE.md`, provider reports và conditional payment capability. WeatherAPI (`ARCH-013`) và MapLibre + Geoapify (`ARCH-012`) là baseline; payment tuân theo `ARCH-010`/`OPS-006`.
- **Ràng buộc:** Phase 1 verification chỉ phê duyệt architecture contract. Load, browser attribution/key restrictions, provider degraded tests, merchant webhook/IPN, account reconciliation, backup/restore và production release evidence vẫn phải đạt ở phase implementation tương ứng.
- **Kết quả:** Phase 1 chuyển `VERIFIED`; Phase 2 chuyển `AWAITING_DECISION`. Không có tuyên bố payment production-ready, 7-day weather hay unlimited provider quota.

### ARCH-014 — Stage 2 monorepo and runtime foundation

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 2
- **Quyết định:** Dùng monorepo với `pnpm workspace`; chưa thêm Turborepo cho tới khi workspace scripts không còn đáp ứng. Cấu trúc baseline gồm `apps/web`, `apps/directus`, `apps/worker`, `packages/contracts`, `packages/config`, `infra` và `docs`.
- **Runtime:** Node runtime phải tương thích Directus `12.1.1` và được pin cùng package manager. Local stack dùng Docker Compose với Directus, PostgreSQL/PostGIS, Redis và Mailpit; service/image không dùng floating tag.
- **CI/registry:** GitHub Actions là CI baseline và GitHub Container Registry là image registry baseline. Build tạo immutable artifact/image; production không auto-deploy từ branch không được bảo vệ.
- **Ràng buộc:** Không thêm build orchestrator, microservice hoặc registry khác nếu chưa có bottleneck/evidence và Decision ID mới.

### SEC-003 — Stage 2 secret, bootstrap and break-glass policy

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 2 / 3 / 13
- **Quyết định:** Local secret nằm trong `.env.*` Git-ignore; CI dùng GitHub encrypted secrets; owner-managed VPS dùng SOPS/age để quản lý encrypted secret material kết hợp Docker secrets/runtime injection. Age private key và plaintext secret không nằm trong Git.
- **Bootstrap admin:** Credential bootstrap chỉ truyền qua protected environment/runtime secret, phải rotate ngay sau first login và không được dùng làm standing daily admin credential.
- **Break-glass:** Product Owner giữ break-glass credential trong password manager và một encrypted offline recovery copy. Mỗi lần sử dụng phải ghi actor/reason/time, revoke active sessions khi cần và rotate sau sự cố hoặc truy cập khẩn cấp.
- **Ràng buộc:** Frontend, image layer, CI log, seed output và repository không chứa Directus admin password, service token hoặc provider server secret.

### DATA-005 — Deterministic production seeding and reference-source policy

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 2 / 4 / 13
- **Quyết định:** Seed dùng versioned, idempotent manifests với stable external keys, checksum, environment scope và audit result. Production chỉ nhận approved configuration/reference data; không seed demo user, fake weather, fake payment, fake subscription hoặc sample entitlement.
- **Location source:** Chỉ nhập location/administrative reference từ nguồn chính thức có URL/source owner, publication version/date và license/provenance được ghi trong manifest. Geoapify/weather provider label không là canonical identity. Nếu chưa có source đạt gate, Phase 2 không seed location catalog thay vì tự tạo dữ liệu.
- **Demo/test data:** Chỉ cho phép ephemeral CI/staging accounts/fixtures với namespace rõ, access hạn chế và reset/expiry. Không có standing public demo account và không promote fixture sang production.
- **Ràng buộc:** Seed chạy lặp lại không duplicate và không ghi đè business data ngoài ownership contract.

### OPS-007 — Stage 2 environment, storage and Directus update policy

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 2 / 13
- **Environment:** Local/development/staging/production dùng database, Redis namespace, credential và storage scope riêng. Production data không copy xuống lower environment nếu chưa anonymize và approve.
- **Object storage:** Không thêm MinIO hoặc managed S3 trong Stage 2 khi chưa có use case. Local/development có thể dùng persistent local volume; production storage provider được chốt tại Phase 4/13 và phải dùng externalized adapter configuration.
- **Directus update:** Pin exact version/digest. Update chỉ qua manual approval sau release-note, security, migration, extension compatibility và rollback review; kiểm tra định kỳ hàng tháng, với expedited path cho Critical/High security advisory.
- **Ràng buộc:** Không sửa source/secret trực tiếp trên server để tạo khác biệt môi trường; mọi thay đổi phải qua versioned config/artifact và evidence.

### PRODUCT-013 — Phase 2 kickoff approval

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 2
- **Quyết định:** Phê duyệt Decision Gate Phase 2 theo `ARCH-014`, `SEC-003`, `DATA-005` và `OPS-007`.
- **Kết quả:** Phase 2 chuyển từ `AWAITING_DECISION` sang `IN_PROGRESS`.
- **Ràng buộc:** Kickoff không đồng nghĩa Directus runtime, schema, seed, CI, backup hoặc production environment đã hoàn thành. Phase 2 chỉ được `VERIFIED` sau clean rebuild, credential rotation, idempotent seed, schema promotion/rollback và CI evidence có thể tái hiện.

### PRODUCT-014 — Phase 2 closure and Phase 3 kickoff

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 2 / 3
- **Quyết định:** Phê duyệt đóng Phase 2 sau khi local validator, clean rebuild và remote GitHub Actions/GHCR evidence đều pass; mở Phase 3 ở trạng thái `AWAITING_DECISION`.
- **Remote evidence:** Commit `3ac524579308e1f7365370643ed7257a22570acd`; GitHub Actions run `30577216479` có cả `quality` và `worker-image` thành công; source SBOM artifact `source-sbom-3ac524579308e1f7365370643ed7257a22570acd` đã upload.
- **Image evidence:** `ghcr.io/hxdhshep07052005/vietnam-weather-worker:3ac524579308e1f7365370643ed7257a22570acd` được push với manifest digest `sha256:747e0d2ff9fc6a3549687014ec5b0c2b2791311c9baffadaa7a10f8ee28fb4c2`.
- **Kết quả:** Phase 2 chuyển `VERIFIED`; Phase 3 chuyển từ `BLOCKED` sang `AWAITING_DECISION`.
- **Ràng buộc:** Kickoff Phase 3 chỉ mở Decision Gate. Không triển khai auth transport, TTL, MFA, Admin Studio network control hoặc retention bằng giả định trước khi Product Owner chốt.

### SEC-004 — Browser authentication and session policy

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3 / 9
- **Quyết định:** Browser dùng opaque application session do backend quản lý qua same-origin Application API. Session identifier chỉ nằm trong cookie có `Secure`, `HttpOnly` và `SameSite` phù hợp; frontend không giữ Directus access token, refresh token hoặc session secret.
- **MVP identity:** Chỉ hỗ trợ email/password. Social login và enterprise SSO chưa nằm trong MVP; muốn bổ sung phải có decision, threat review và account-linking contract riêng.
- **Lifetime:** Directus access token phía server có TTL 10 phút. Application session/refresh lifetime tối đa 14 ngày và phải cấu hình qua environment, không hardcode trong frontend hoặc business code.
- **Concurrency:** User thường tối đa 5 session hoạt động; staff/admin tối đa 2. Login/refresh nhạy cảm phải rotate session identifier; logout, reset password, disable account hoặc security event có thể revoke session liên quan.
- **Ràng buộc:** Session store phải hỗ trợ server-side revoke, expiry, rotation và audit. Không lưu credential trong `localStorage`, `sessionStorage`, URL, analytics hoặc log.

### SEC-005 — Admin Studio access and staff MFA

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3 / 13
- **Quyết định:** Production Directus Admin Studio chỉ được truy cập qua WireGuard VPN. IP allowlist chỉ là emergency/fallback control, không thay thế VPN trong vận hành bình thường.
- **MFA:** Bắt buộc MFA cho toàn bộ human staff/admin có quyền vào Admin Studio hoặc thao tác quản trị. User sản phẩm thông thường chưa bị bắt buộc MFA trong MVP.
- **Service identity:** Service account không đăng nhập tương tác, không dùng shared human account và chỉ nhận policy least-privilege đúng workload.
- **Ràng buộc:** Break-glass access phải có audit, thời hạn ngắn và rotate/revoke sau sử dụng theo `SEC-003`.

### DATA-006 — Security, audit and billing-reference retention

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3 / 10 / 12 / 13
- **Quyết định:** Security/session log giữ 90 ngày; admin/security audit giữ 12 tháng; billing/payment reference giữ tối thiểu 24 tháng.
- **Legal gate:** Mốc billing/payment là baseline kỹ thuật và phải được legal/accounting review trước production; nếu nghĩa vụ pháp lý yêu cầu khác, retention policy phải được cập nhật bằng decision mới.
- **Data minimization:** Không ghi card number, CVV, password, token, cookie, secret hoặc precise GPS vào log. PII phải được redact/pseudonymize và quyền đọc audit log phải tách biệt theo least privilege.
- **Ràng buộc:** Retention, purge và legal hold phải là cấu hình versioned, có test và audit evidence; không dựa vào xóa thủ công tùy ý.

### SEC-006 — Entitlement source of truth and stale-state policy

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3 / 10
- **Quyết định:** Entitlement projection trong database là nguồn sự thật. JWT/session claim nếu có chỉ là cache hint, không đủ để cấp quyền Pro hoặc thay đổi quota.
- **Cache:** Backend có thể dùng read-only entitlement cache tối đa 60 giây. TTL phải cấu hình qua environment và cache invalidation phải chạy khi subscription/plan thay đổi.
- **Fail-safe:** Pro mutation, quota consumption, checkout/payment action và thao tác nhạy cảm phải deny khi entitlement stale, thiếu hoặc không revalidate được. Read-only UX có thể trả trạng thái retry/degraded rõ ràng nhưng không được giả lập quyền Pro.
- **Ràng buộc:** Frontend không gửi role, plan, quota hoặc entitlement để backend tin cậy; mọi enforcement nằm ở Application API/backend.

### PRODUCT-015 — Phase 3 kickoff approval

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 3
- **Quyết định:** Phê duyệt Decision Gate Phase 3 theo `SEC-004`, `SEC-005`, `DATA-006` và `SEC-006`; chuyển Phase 3 từ `AWAITING_DECISION` sang `IN_PROGRESS`.
- **Thứ tự triển khai:** (1) auth sequence, trust boundary và session contract; (2) role-policy-permission matrix; (3) CSRF/CORS/rate-limit/secure-header controls; (4) MFA, email verification, password reset và recovery; (5) automated permission/security tests và revoke/rotation drill.
- **Ràng buộc:** Kickoff không đồng nghĩa authentication hoặc security đã hoàn thành. Phase 3 chỉ được `VERIFIED` khi có implementation, negative permission tests, rotation/revoke evidence, security checklist và threat-model update có thể tái hiện.

### SEC-007 — Phase 3 auth/session contract approval

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 3
- **Quyết định:** Phê duyệt [`PHASE_3_AUTH_SESSION_CONTRACT.md`](PHASE_3_AUTH_SESSION_CONTRACT.md) làm contract triển khai auth/session của Phase 3.
- **Boundary được duyệt:** Same-origin Application API, opaque secure cookie, server-side Directus token, durable authoritative session state, Redis không là nguồn cấp quyền, CSRF/origin validation và fail-closed khi session/revalidation lỗi.
- **Kết quả:** Contract chuyển `DRAFT_FOR_REVIEW` sang `APPROVED`; Phase 3 được phép chuyển sang thiết kế role-policy-permission matrix.
- **Ràng buộc:** Approval này chưa chứng minh code, cookie, encryption, revoke hoặc negative tests đã tồn tại. Evidence implementation vẫn phải được tạo bằng local/CI test thật.

### SEC-008 — Phase 3 role-policy-permission matrix approval

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 3 / 4
- **Quyết định:** Phê duyệt [`PHASE_3_ROLE_POLICY_MATRIX.md`](PHASE_3_ROLE_POLICY_MATRIX.md) làm authorization contract cho human role, registered traveler, public và service identity.
- **Separation of duties:** Tách `Risk Analyst`/`Risk Approver`, `Payment Webhook Ingress`/`Payment Reconciliation Service`; không tạo broad `Integration Service` và không dùng Super Admin cho workload.
- **Implementation baseline:** Phase 3 được phép provision role/policy bằng manifest versioned với zero collection permission, staff MFA flag và service Studio deny. Phase 4 mới map logical domain sang collection/field/item filter thật.
- **Ràng buộc:** Approval matrix không tự tạo quyền. Mọi allow permission về sau phải có schema thật, manifest, positive/negative test và evidence; public và managed role giữ default-deny cho tới lúc đó.

### ARCH-015 — Licensed Directus entitlement path

- **Ngày quyết định:** 2026-07-31
- **Người quyết định:** Product Owner
- **Phase:** 3 / 4 / 13
- **Vấn đề:** Directus Core 12.1.1 giới hạn 3 active Admin/App seats và chặn custom permission rules cần cho ownership/field/item authorization.
- **Quyết định:** Chọn official licensed Directus path thay vì Core-constrained architecture để giữ Directus policy defense-in-depth, granular Admin Studio RBAC và production quality đã duyệt.
- **Credential contract:** Chỉ inject một trong `LICENSE_KEY` hoặc `LICENSE_TOKEN` bằng protected runtime secret; không đặt license credential trong Git, image, seed, frontend, log hoặc evidence. Nếu cả hai cùng tồn tại, deployment phải fail closed.
- **Verification gate:** Trước khi tạo custom business permission, `/license` phải báo non-Core active source, `production_enabled=true` và `custom_permission_rules_enabled=true`. Seat/collection/flow capacity phải được đối chiếu với staffing/schema thật trước staging/production.
- **Current state:** Local runtime vẫn dùng Core cho tới khi Product Owner cung cấp official key/token. Default-deny role baseline hợp lệ; ownership/custom permission implementation chưa được mở.
- **Evidence:** [`DIRECTUS_ENTITLEMENT_REPORT.md`](DIRECTUS_ENTITLEMENT_REPORT.md).

### SEC-009 — Password recovery token transport (ACCEPTED)

- **Ngày quyết định:** 2026-08-01
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3
- **Vấn đề:** Directus 12.1.1 native `POST /auth/password/request` đưa one-time reset token vào query string của `reset_url`.
- **Quyết định:** Chọn phương án native Directus với hardening có kiểm soát. Query token chỉ được phép trên HTTPS ở consume endpoint allowlist; API redacts request URL, không gửi analytics/third-party asset, đặt `Referrer-Policy: no-referrer` và `Cache-Control: no-store`, mã hóa token server-side, đổi token ngay thành opaque one-time handle trong URL fragment sạch, TTL handle 15 phút và replay bị deny.
- **Recovery boundary:** Browser không nhận Directus reset token trong response/body/storage. Browser chỉ gửi opaque handle tới Application API; Application API mới gọi Directus `/auth/password/reset` server-to-server.
- **Session impact:** Directus password reset làm PostgreSQL identity trigger revoke toàn bộ application sessions của user; live test phải chứng minh old session 401 và new password login pass.
- **Ràng buộc:** Reset URL production phải HTTPS, query-free ở cấu hình redirect, allowlist chính xác; log/analytics/proxy phải redacted. Nếu sau này policy cấm tuyệt đối token query kể cả request đầu tiên, phải mở decision mới và chuyển sang custom bridge.

### SEC-010 — Email verification and registration transport (ACCEPTED)

- **Ngày quyết định:** 2026-08-02
- **Người quyết định:** Product Owner / Technical Owner
- **Phase:** 3
- **Vấn đề:** Directus gửi one-time email-verification token trong query string và native verify endpoint redirect theo backend behavior; không được để browser product nhận Directus token hoặc bị đưa vào Admin Studio.
- **Quyết định:** Public registration chỉ đi qua Application API. Directus gửi email tới allowlisted API consume URL; API redact toàn bộ request URL, mã hóa Directus token trong PostgreSQL, trả `303` tới product URL sạch với opaque one-time handle trong fragment, rồi browser hoàn tất qua CSRF-protected API mutation.
- **Privacy/security behavior:** Registration luôn trả DTO generic `202 { accepted: true }`; duplicate registration không tiết lộ account tồn tại. Handle có TTL cấu hình, lưu hash, consume atomic và replay/expired/invalid đều trả stable generic error.
- **Log boundary:** Directus `/users/register/verify-email` bị loại khỏi HTTP access log; Application API redact request URL/query, response location, cookie và credential. Browser không nhận token Directus trong body, header, cookie, storage hoặc clean redirect.
- **Ràng buộc:** Directus registration policy phải dùng approved traveler role và bắt buộc verify email. Production consume/redirect URL phải HTTPS, query-free trong cấu hình và thuộc exact application-origin allowlist. Mọi thay đổi flow phải giữ frontend chỉ gọi Application API.
