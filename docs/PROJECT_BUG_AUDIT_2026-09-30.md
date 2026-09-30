# Khảo sát dự án và lỗi chạy thực tế

Ngày kiểm tra: 30/09/2026, giờ Việt Nam. Phạm vi: working tree hiện tại, gồm cả thay đổi chưa commit.

## Kết luận

Dự án đã có đầy đủ các lớp nền tảng, nhưng các luồng sản phẩm chưa thống nhất: xác thực chính dùng Directus, OTP dùng plugin Vite; gói thuê bao được backend quản lý nhưng frontend còn suy ra từ email; dữ liệu thời tiết thật cùng tồn tại với fallback cố định trong chatbot. Vì vậy build hoặc test xanh không chứng minh toàn bộ ứng dụng hoạt động đúng.

Đã sửa hai nhóm lỗi trong đợt này: cô lập lịch sử chat theo người dùng và sửa giao thức request/response cho thao tác không có body. Các vấn đề khác bên dưới vẫn cần xử lý. Chưa rebuild/restart container đang chạy, chưa commit.

## 1. Bản đồ dự án

| Thành phần | Công nghệ / đường dẫn | Vai trò thực tế |
|---|---|---|
| Web | React 18, Vite 5, TypeScript, `apps/web` | Trang thời tiết, bản đồ, lộ trình, auth, chat, cài đặt, nâng cấp |
| UI state | Zustand + localStorage | Auth, gói hiển thị, địa điểm/lộ trình đã lưu, quota route phía client |
| Data fetching | TanStack Query và `apps/web/src/api/client.ts` | Gọi `/api/v1`, cookie session, CSRF, cache theo địa điểm |
| Bản đồ | MapLibre, Geoapify, dữ liệu polygon nội bộ | Hiển thị tỉnh và hình học tuyến đường |
| API | Fastify 5, `apps/api` | Session, weather, risk, routing, billing, chatbot |
| Worker | Node/TypeScript, `apps/worker` | Lấy WeatherAPI, normalize, durable jobs, retry/lease/heartbeat |
| Contracts | `packages/contracts` | DTO, validation, OpenAPI, weather/risk/route/chat contracts |
| Backend quản trị | Directus 12 | Tài khoản, quyền, dữ liệu và admin studio |
| Hạ tầng | PostgreSQL/PostGIS, Redis, Docker Compose | Lưu dữ liệu, geospatial, cache/rate limit; Mailpit nhận email local |

Luồng thời tiết chính: web -> Application API -> cache/DB -> enqueue khi thiếu dữ liệu -> worker gọi provider -> lưu DB -> web đọc lại.

Luồng report-risk hiện tại: web -> `/risk/report-point` -> đọc bằng chứng DB theo vị trí/thời gian -> `assessReportHazard`. Luồng này không tự gọi provider để bù tất cả dữ liệu còn thiếu.

Luồng chat: web -> chat routes -> quota -> ChatToolEngine -> LLM adapter hoặc rule fallback. History và một phần quota là state trong process, cần đánh giá lại khi chạy nhiều replica hoặc restart.

README có đoạn vẫn nói Next.js, trong khi ứng dụng đang chạy React/Vite. Nên coi source/package manifests là căn cứ cho runtime hiện tại.

## 2. Lỗi đã sửa

### P1: Đọc, xóa và sử dụng lịch sử chat của người khác

- Nguồn: `apps/api/src/chat/chat-service.ts:87`, `:147`, `:160`; callers trong `apps/api/src/chat/routes.ts`.
- Trước sửa: map history chỉ dùng `conversationId` do client lựa chọn. Hai user chọn cùng ID dùng chung dữ liệu; GET/DELETE cũng không kiểm tra chủ sở hữu.
- Tái hiện: chạy Fastify thật trên port local tạm, giả lập hai danh tính Alice/Bob tại auth boundary. Bob đọc được 2 message của Alice, xóa được chúng, và lời gọi model cho Bob nhận context của Alice.
- Sửa: khóa lưu trữ kết hợp `[userId, conversationId]`; GET/DELETE truyền danh tính đã resolve ở server.
- Regression: `apps/api/test/chat-ownership.test.mjs`, 3 ca đỏ trước sửa -> cả 4 ca xanh sau sửa. Bao gồm chat mặc định, đọc/xóa đúng chủ sở hữu và cô lập model context.
- Giới hạn: guest vẫn được định danh theo IP trong routes. Hai khách chung IP vẫn có nguy cơ chung history/quota; bản sửa này không cung cấp danh tính guest riêng.

### P1/P2: Logout/xóa chat lỗi do JSON rỗng; wrapper lỗi khi nhận 204

- Nguồn: `apps/web/src/api/client.ts:92`, `:268`.
- Trước sửa: mọi request đều gửi `Content-Type: application/json`, cả DELETE/POST không body. Fastify trả 400 trước khi handler chạy. `authApi.logout()` và `chatApi.clearHistory()` có dạng request này.
- Tái hiện ở HTTP server local: DELETE không body nhưng khai báo JSON trả 400; cùng request bỏ header JSON trả 204.
- Lỗi tiếp theo: wrapper `clearHistory()` đọc `r.data` dù API trả 204 và client đã chuyển thành `undefined`; gây TypeError ngay cả khi xóa thành công.
- Sửa: chỉ mặc định Content-Type JSON khi có body; `clearHistory()` dùng `delete<void>()` và không truy cập body rỗng.
- Regression: `apps/web/src/api/client.test.ts`, 4 ca kiểm tra DELETE/POST rỗng, JSON payload vẫn giữ CSRF và wrapper nhận 204. Có bằng chứng test đỏ trước từng bản sửa.

## 3. Vấn đề còn tồn tại, theo mức ưu tiên

### P1: Đăng ký và đặt lại mật khẩu chỉ báo thành công, chưa thay đổi tài khoản thật

- `apps/web/src/hooks/useAuthStore.ts` gọi `/api/mailer/*`, trong khi login gọi `/api/v1/auth/login`.
- `apps/web/vite-plugin-otp-mailer.ts:206` chỉ lưu OTP và metadata trong Map; không lưu password/name để tạo tài khoản.
- `:266` xác minh mã rồi xóa OTP và trả success; không gọi Directus hoặc Application API tạo user.
- `:305` trả “Đặt lại mật khẩu thành công” nhưng không cập nhật password trong backend.
- Plugin đăng ký qua `configureServer`; luồng này không được đóng gói như một backend cho Vite production build.
- Bằng chứng: đọc trọn các handler và đối chiếu nơi frontend gọi. Chưa làm end-to-end đăng ký/reset tài khoản thật.
- Hướng sửa: chọn một flow auth server duy nhất, dùng bridge Directus đang có hoặc triển khai OTP thật phía API; chỉ báo thành công sau thao tác backend hoàn tất.

### P1: OTP lộ qua response và endpoint tra mã

- `apps/web/vite-plugin-otp-mailer.ts:223` trả mã OTP trực tiếp cho client; `:314` cho phép lấy mã bằng email qua `/api/mailer/latest`.
- Handler reset không kiểm tra `expiresAt` và mục đích OTP như handler verify.
- Đây hiện là plugin development, nhưng không được dùng làm cơ chế xác minh an toàn hoặc phát hành ra môi trường công khai.
- Bằng chứng: code review, không đọc OTP/email của người dùng thật.

### P1: Chatbot trả thời tiết tự tạo khi provider không có dữ liệu

- `apps/api/src/chat/chat-tools.ts:140` khởi tạo số đo từ bảng cố định, giữ lại khi service trả unavailable hoặc ném lỗi; trả `success: true`, `freshness: fresh`, nguồn WeatherAPI.
- `:241` tạo forecast bằng công thức khi không có hourly data.
- Đã chạy trực tiếp compiled ChatToolEngine với weatherService trả unavailable: nhận `success=true`, `temperature=30`, `freshness=fresh`, `source=WeatherAPI (Normalized)`.
- Tra địa điểm không tồn tại trả Đà Nẵng thành công qua `resolveLocation`, thay vì không tìm thấy.
- Tác động: câu trả lời trông có nguồn thực tế nhưng số liệu không có bằng chứng. Test hiện còn khẳng định fallback này là “real temperature”, nên test xanh không bảo đảm đúng dữ liệu.
- Hướng sửa: unavailable/unknown rõ ràng, không tự gán nguồn và thời gian quan trắc; inject fake provider chỉ trong test.

### P1: Khách chưa đăng nhập dùng chung identity theo IP

- `apps/api/src/chat/routes.ts:49`, `:81`, `:110` dùng IP đã thay ký tự làm user/conversation identity.
- Người dùng chung NAT/proxy có thể dùng chung quota và lịch sử mặc định; proxy có thể làm nhiều người có cùng `request.ip`.
- Bằng chứng: code; chưa đọc lịch sử thật của khách.
- Hướng sửa: session khách ngẫu nhiên, có chữ ký/cookie server; giữ IP chỉ cho abuse rate limit.

### P1: Credential có giá trị fallback hardcode trong source

- `compose.yaml:223` và vùng cấu hình API gần đó; `apps/api/src/chat/gemini-adapter.ts` constructor.
- Có chuỗi dạng API key làm default thay vì cấu hình bắt buộc/feature-disabled. Không sao chép giá trị vào báo cáo.
- Chưa xác minh các key còn hiệu lực. Nếu từng dùng thật, cần thay key tại provider và bỏ fallback source.

### P2: Gói Pro trên UI không phản ánh entitlement backend

- `apps/web/src/hooks/useAuthStore.ts:65`: email chứa `pro` hoặc `vip` tự được gán plan Pro sau login, không dựa vào billing entitlement.
- Store còn tạo saved locations/routes mẫu cho email VIP và persist plan/auth vào localStorage.
- Tác động: UI hiển thị quota/chức năng khác backend; không kết luận đây là bypass thanh toán phía server.
- Hướng sửa: lấy `/billing/entitlements`, xác thực session qua `/auth/me`, đồng bộ state thay vì suy luận từ email.

### P2: GPS lấy được nhưng không dùng tọa độ để tìm tuyến

- `apps/web/src/pages/RoutePlannerPage.tsx:169` bỏ qua đối tượng position, chỉ đặt origin thành chuỗi “Vị trí GPS của bạn”.
- `:370` gửi origin dạng text query; backend geocode chuỗi mô tả, không phải tọa độ thiết bị.
- Bằng chứng: callback và payload; chưa thử GPS trong browser.

### P2: Tự gọi route khi đổi form, bỏ qua kiểm tra thao tác thủ công

- `apps/web/src/pages/RoutePlannerPage.tsx:395`: effect gọi `handlePlanRoute(true)` mỗi khi callback thay đổi, không chỉ lúc mount.
- Callback phụ thuộc origin/destination/vehicle/departure/auth. `isInitial=true` bỏ qua kiểm tra đăng nhập và quota client.
- Không có cancellation hoặc guard bỏ response cũ; cần kiểm tra race khi đổi lựa chọn nhanh. Chưa tái hiện bằng browser.
- Hướng sửa: tách initial load khỏi submit, scope dependencies đúng, bảo vệ response theo request hiện tại, quota ở server.

### P2: Risk thường là unknown do thiếu nguồn bằng chứng

- `apps/api/src/risk/weather-evidence.ts` luôn trả `official_alert_level: null`, storm null/unclassified; forecast đặt visibility null.
- `apps/api/src/risk/report-hazard.ts:34` chỉ tính severity khi mọi chiều có bằng chứng.
- Live report-point tại Hà Nội với car trả 200, level unknown, score null; reasons gồm thiếu official alert, storm classification, precipitation interval. Mẫu thời tiết còn stale.
- Đây là giới hạn tích hợp dữ liệu. Không nên tự gán thiếu dữ liệu thành an toàn; cần thêm nguồn hoặc thiết kế riêng đánh giá từng phần.

### P2: Tests contracts chưa được chạy bởi workspace test

- `packages/contracts/package.json` không có test script, dù có `test/weather-v1.test.mjs`.
- Chạy trực tiếp `node --test packages/contracts/test/*.test.mjs` fail: dist/index.js không export WEATHER_ERROR_CATALOG mà test import.
- Cần đồng bộ public exports/test và nối vào pipeline; không bỏ assertions để có màu xanh.

## 4. Kết quả kiểm tra

| Kiểm tra | Kết quả quan sát |
|---|---|
| Node / pnpm | 24.18.0 / 11.9.0, khớp engines |
| Existing Docker services | API, worker, database, Redis, Directus, Mailpit healthy |
| API readiness | HTTP 200, ready |
| Live weather observation | HTTP 200, degraded tại Hà Nội |
| Live report risk | HTTP 200, unknown; có lý do thiếu dữ liệu |
| Build/typecheck đầu phiên | Pass |
| API tests cuối phiên | 180/180 pass, gồm 4 HTTP ownership tests mới |
| Worker tests cuối phiên | 40/40 pass |
| Web tests cuối phiên | 20/20 pass, gồm 4 client regression tests mới |
| Lint các file sửa trong đợt này | Pass |
| Workspace lint gần nhất | Fail: 3 lỗi import type ở vietnamGeoJsonWGS84.ts và route-v1.ts |
| Workspace build/typecheck gần nhất | Fail trong useProvinceWeather.ts và WeatherPage.ts |
| Contracts tests chạy trực tiếp | Fail khi import WEATHER_ERROR_CATALOG |
| Browser/UI end-to-end | Chưa kiểm tra: quyền mở localhost:3000 bị từ chối; không thử đường vòng |

Working tree thay đổi trong khi audit. Lần build sau thấy `useProvinceWeather.ts:58` trả string hoặc undefined thay vì string; WeatherPage dùng rainProbabilityPercent chưa có trong ProvinceGeoFeatureProperties. Các file đó không được sửa trong đợt này. Kết quả là snapshot tại thời điểm chạy, cần chạy lại sau công việc song song.

Ca weather “zero” đầu phiên fail do fixture gán áp suất 0 trong khi contract yêu cầu 800–1200 hPa. Fixture được thay đổi ngoài phần audit trong lúc kiểm tra; API suite cuối đã pass. Không tính đây là bản sửa của audit và không nới contract áp suất.

## 5. Phạm vi thay đổi và thứ tự tiếp theo

Các file thay đổi bởi đợt này:

- `apps/api/src/chat/chat-service.ts`: history theo user + conversation.
- `apps/api/src/chat/routes.ts`: truyền user identity khi đọc/xóa history; giữ thay đổi có sẵn.
- `apps/api/test/chat-service.test.mjs`: cập nhật signature, giữ nguyên assertions.
- `apps/api/test/chat-ownership.test.mjs`: HTTP regression isolation.
- `apps/web/src/api/client.ts`: JSON header có điều kiện, 204 clearHistory.
- `apps/web/src/api/client.test.ts`: client protocol regression.
- Báo cáo này.

Ưu tiên: ổn định build -> thống nhất auth/OTP -> bỏ weather fallback giả, tách guest session -> route/GPS -> entitlement và nguồn risk -> browser QA desktop/mobile, phiên hết hạn và thao tác liên tiếp.

Bản sửa nằm trong source; container API chưa rebuild nên không được coi là đã nhận bản sửa. HTTP ownership tests dùng source đã build trong process tạm, auth/billing/LLM là test doubles; không phải kiểm thử đăng nhập Directus thật.
