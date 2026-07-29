# Phase 9 — Frontend Web Application

**Status:** BLOCKED  
**Phụ thuộc:** API contract của Phase 4–8 ổn định  
**Mục tiêu:** Xây web application production-ready, responsive, accessible và chỉ hiển thị dữ liệu có nguồn.

## Phạm vi công việc

### 1. Information architecture and access boundary

- Landing page public với product value, pricing summary, legal links và CTA đăng ký/đăng nhập.
- Trang bản đồ thời tiết yêu cầu đăng nhập.
- Trang/side panel chi tiết location và forecast/trend.
- Trang route planner và route comparison.
- Current-location button, GPS accuracy circle, follow-mode và route progress khi user cấp quyền.
- Authentication/account pages bắt buộc theo `PRODUCT-006`.
- Pricing, plan comparison, quota/entitlement status, upgrade, cancel và billing error states.
- Trạng thái unavailable/stale/error và legal disclaimer.
- Admin panel dùng Directus Studio, không xây lại chức năng quản trị không cần thiết.

### 2. Map and visualization

- Map layer và marker lấy từ Directus API, không từ mảng hardcode.
- Clustering/viewport query để tránh tải toàn bộ dữ liệu không cần thiết.
- Legend risk có Unknown và giải thích.
- Chart có source, issued/updated time, units và timezone.
- Route segment thể hiện risk và ETA bằng pattern/màu đáp ứng accessibility.
- Pro-only UI phải dựa trên entitlement response; không dùng client flag để unlock.

### 2.1. Weather effects and future timeline

- Hiệu ứng hiện tại: mưa, mây, nắng/day-night và gió khi provider có field tương ứng.
- Future timeline: slider/play-pause theo các `valid_at` forecast time; luôn hiển thị thời điểm đang xem.
- Theo `PRODUCT-007`, current weather effects thuộc Free; future timeline, forecast animation và advanced overlays thuộc Pro.
- Precipitation overlay dùng probability/amount thật; không vẽ vùng mưa giả giữa các điểm nếu provider không cung cấp grid/radar phù hợp.
- Wind particles chỉ hiển thị khi có wind speed/direction hợp lệ; thiếu field thì tắt layer thay vì đoán.
- Mỗi layer có toggle, legend, source, issued time, valid time và freshness state.
- Animation chạy bằng canvas/WebGL/CSS theo performance budget; hỗ trợ `prefers-reduced-motion` và static fallback.
- Không gọi hiệu ứng là quan sát thực tế nếu nó là forecast; copy phải dùng “dự báo tại thời điểm...”.

### 3. Authentication and client security

- Thực hiện auth flow đã chốt ở Phase 3.
- Route guard chuyển anonymous user về login và giữ safe return URL.
- Không coi route guard là authorization; backend phải deny anonymous feature API.
- Access token không ghi vào log, analytics, URL hoặc persistent storage trái thiết kế.
- Không render HTML không tin cậy từ provider/chatbot/Directus nếu chưa sanitize.
- Không nối chuỗi UI bằng câu hardcode; dùng locale key và ICU pluralization.
- CSP-compatible asset loading; kiểm soát dependency/CDN integrity theo kiến trúc.
- Không nhúng weather/routing/LLM secret trong bundle.

### 3.1. API-only integration

- Frontend chỉ có typed API client cho `/api/v1` và public response DTO theo `ARCH-003`.
- Không import backend service, Directus server SDK, collection schema, database model hoặc worker code vào frontend bundle.
- Không gọi Directus generic REST/GraphQL, weather/routing/payment/LLM provider trực tiếp.
- Không tự tính risk, entitlement, quota, price, route score hoặc subscription state ở client.
- Backend trả structured success/error, entitlement và localized business content; frontend chỉ render và quản lý presentation state.
- Client-side validation chỉ cải thiện UX; backend luôn validate lại và là nguồn sự thật.

### 4. UX resilience

- Loading, empty, partial, stale, offline và retry states.
- Request cancellation/debounce cho search/map pan.
- Không che giấu provider outage bằng placeholder giống dữ liệu thật.
- Error message có correlation/reference ID nhưng không lộ internal detail.
- Locale switch không làm mất state bất hợp lệ và phải định dạng đúng số, ngày, giờ, timezone, currency.
- GPS UX có states: permission prompt/denied/unavailable/low accuracy/following/paused; user có nút dừng tracking rõ ràng.
- Follow mode không tự bật khi chưa có hành động/consent; camera follow có thể tạm dừng khi user kéo map.

### 5. Quality and analytics

- Component, accessibility và end-to-end tests.
- Performance budget cho bundle, map interaction và Core Web Vitals theo NFR.
- Analytics tối thiểu dữ liệu, consent-aware và không thu vị trí chính xác nếu chưa được duyệt.

## Deliverables và evidence

- Design system/tokens và responsive screens.
- Frontend implementation kết nối API thật ở development/staging.
- Accessibility report và browser/device matrix.
- E2E tests cho map, forecast, route và auth nếu có.
- Performance report và security header verification.

## Acceptance criteria

- Không có location/risk/advisory/provider data hardcode trong frontend.
- Frontend contract tests chứng minh chỉ gọi approved `/api/v1` endpoints và không phụ thuộc Directus internals.
- Không có mock service worker hoặc fixture trong production build.
- Mobile flow hoàn thành được map → detail → route.
- Anonymous chỉ truy cập landing/login/register/legal; deep link vào product feature yêu cầu login.
- Map effect chỉ xuất hiện khi có dữ liệu provider hợp lệ và có thể tắt bằng layer control.
- Future timeline không vượt quá forecast horizon và không tạo spatial interpolation không có nguồn.
- Reduced-motion và thiết bị hiệu năng thấp có static fallback.
- GPS marker/progress cập nhật khi di chuyển trong giới hạn browser; không hứa background tracking khi app bị đóng/suspend.
- Keyboard navigation và focus management đạt target đã chốt.
- Error/stale/unknown states được kiểm thử.
- Free/Pro paywall, quota exhausted, payment failure và subscription state được kiểm thử.
- Việt–Anh không còn missing key ở màn hình public/core.
- Source, attribution và update time hiển thị đúng contract.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** Free có current weather effects; Pro có future timeline, forecast animation và advanced overlays (`PRODUCT-007`).

1. Frontend framework và rendering mode được chọn ở Phase 1 có giữ nguyên không?
2. Visual direction, brand, ngôn ngữ và accessibility target là gì?
3. Map/tile/weather visual layer provider nào được phép dùng production và attribution yêu cầu ra sao?
4. Public landing page ưu tiên value proposition, pricing hay demo preview không tương tác?
5. Timeline mặc định hiển thị theo giờ hay theo ngày và tối đa bao xa?
6. Có PWA/offline shell, push notification hoặc geolocation không?
7. Pro paywall và checkout mở trong app hay chuyển sang Stripe/VNPay hosted flow?
8. Analytics nào được phép thu và consent UX như thế nào?
9. Browser/mobile device support tối thiểu là gì?
