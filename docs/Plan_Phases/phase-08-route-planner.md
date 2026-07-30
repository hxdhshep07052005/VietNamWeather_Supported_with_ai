# Phase 8 — Weather-Aware Route Planner

**Status:** BLOCKED  
**Phụ thuộc:** Phase 6 và Phase 7 VERIFIED  
**Mục tiêu:** Đánh giá rủi ro thời tiết dọc các tuyến đường thật theo ETA và đề xuất tuyến có rủi ro thấp hơn.

## Phạm vi công việc

### 1. Geocoding and routing

- Geocode điểm đi/đến qua backend adapter; lưu attribution và provider reference.
- Lấy route alternatives, geometry, distance, duration và restrictions từ provider.
- Validate tọa độ nằm trong phạm vi sản phẩm và giới hạn input.
- Cache theo normalized request và provider policy.
- Hỗ trợ current GPS position làm origin khi user đã cấp quyền.
- Yêu cầu alternatives đủ để xếp hạng Fastest, Shortest, Weather-safer và Balanced; nếu provider không trả alternatives thì không tuyên bố đã tìm tuyến tối ưu toàn cục.

### 2. Sampling and ETA

- Sample tuyến theo khoảng cách/thời gian cấu hình được từ Directus.
- Tính ETA mỗi điểm dựa trên departure time và thời lượng tích lũy.
- Lấy forecast gần nhất với ETA theo tolerance được cấu hình.
- Ghi rõ điểm nào dùng interpolation/nearest grid và độ lệch không gian/thời gian.

### 3. Route risk evaluation

- Chạy risk engine tại từng sample bằng cùng rule version.
- Tính segment risk và route score bằng công thức version hóa.
- So sánh alternatives theo risk, thời gian và khoảng cách; không tối ưu risk mà bỏ qua trade-off.
- Nếu forecast không phủ hết ETA hoặc dữ liệu thiếu quá mức, route result phải là incomplete/unknown.
- Theo `DATA-004`, route/risk scoring chỉ áp dụng khi ETA cuối tuyến không vượt 72 giờ; ngày 4–7 chỉ là outlook và không tạo weather-safer recommendation.
- `Fastest` chọn duration thấp nhất; `Shortest` chọn distance thấp nhất; `Weather-safer` chọn weather-risk thấp nhất; `Balanced` dùng trọng số config giữa risk/time/distance.

### 3.1. GPS progress and rerouting

- Nhận GPS update từ authenticated web client bằng request contract tối thiểu; không nhận/ghi vị trí liên tục ngoài nhu cầu.
- Map-match hoặc kiểm tra khoảng cách tới route geometry để xác định progress/deviation.
- Khi lệch quá configurable threshold, đề nghị reroute hoặc auto-reroute theo user setting/entitlement đã duyệt.
- Reroute phải tính lại ETA weather và route risk; không tái sử dụng score cũ khi route/time thay đổi đáng kể.
- GPS update không tiêu route quota; chỉ backend route/reroute computation được metering.
- Không cam kết background tracking khi browser/tab không hoạt động.

### 4. User explanation and safety

- Hiển thị đoạn rủi ro, thời điểm dự kiến, yếu tố kích hoạt và tuổi forecast.
- Dùng ngôn ngữ “tuyến có rủi ro thời tiết thấp hơn theo dữ liệu hiện có”.
- Không tự đổi route của người dùng hoặc tuyên bố bảo đảm an toàn.
- Hiển thị attribution và link tới cảnh báo chính thức nếu có.

### 5. Abuse and cost control

- Giới hạn số alternative, route length, sample points và request/user.
- Queue/cancel cho job dài; idempotency để tránh tính lại do retry.
- Theo dõi latency, provider cost/quota và partial failure.

## Deliverables và evidence

- Routing/geocoding provider adapter và contract tests.
- ETA/sampling specification.
- Versioned route scoring configuration.
- Scenario tests cho short/long route, provider outage, missing forecast và extreme weather.
- UX prototype giải thích route recommendation.

## Acceptance criteria

- Route assessment sử dụng forecast theo ETA, không chỉ weather hiện tại.
- Cùng route, departure time, data snapshot và config version cho cùng kết quả.
- Partial/missing forecast không bị trình bày như route low risk.
- Recommendation nêu trade-off distance/time/risk.
- Current-location, follow-mode, permission denied, inaccurate GPS và route-deviation states được kiểm thử.
- API key/provider credential không đi tới browser.
- Rate limit và maximum workload được enforcement phía backend.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** MapLibre + Geoapify Free cho tile/geocoding/routing (`ARCH-012`); initial live capability đã đạt, nhưng 30 route/no-route fixtures, alternatives, modes, credit và quota tests vẫn bắt buộc.

1. MVP hỗ trợ ô tô, xe máy, đi bộ hay loại phương tiện nào?
2. Người dùng có nhập ngày/giờ khởi hành không? Khuyến nghị: bắt buộc hoặc mặc định rõ ràng và cho chỉnh.
3. Cần tối đa bao nhiêu route alternatives?
4. Cách cân bằng weather risk, thời gian và khoảng cách trong recommendation?
5. Giới hạn route length tối đa theo provider/credit là bao nhiêu? Forecast-time limit đã chốt tại `DATA-004`.
6. Có cần lưu route history/favorites hay xử lý stateless?
7. Auto-reroute mở cho Free hay Pro, hay chỉ hỏi user trước mọi reroute?
8. Deviation threshold và minimum reroute interval được cấu hình thế nào?
