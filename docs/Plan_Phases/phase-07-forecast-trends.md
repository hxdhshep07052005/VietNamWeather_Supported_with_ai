# Phase 7 — Forecast & Trend Experience

**Status:** BLOCKED  
**Phụ thuộc:** Phase 5 VERIFIED; Phase 6 API contract ổn định  
**Mục tiêu:** Trình bày forecast và xu hướng thời tiết trung thực, dễ hiểu và không vượt quá khả năng của provider.

## Phạm vi công việc

### 1. Forecast model for product

- Xác định hourly/daily horizon dựa trên provider đã chọn.
- Dùng forecast issue rõ ràng; không ghép tùy tiện dữ liệu của nhiều lần phát hành.
- Chuẩn hóa temperature, precipitation probability/amount, wind và weather code.
- Risk timeline được tính từ đúng forecast valid time và rule version.

### 2. Trend definition

- Chốt “trend” là thay đổi trong forecast window, lịch sử quan sát hay so sánh climatology.
- Nếu không có dữ liệu/nguồn đủ dài, không tuyên bố trend khí hậu.
- Tính summary bằng thuật toán version hóa và cấu hình, không dùng câu chữ hardcode.
- Hiển thị uncertainty/probability khi provider cung cấp; không biến probability thành certainty.

### 3. Visualization contract

- Chart có unit, timezone, source, issue time và last updated.
- Hiển thị data gaps/stale interval thay vì nối đường gây hiểu nhầm.
- Cho phép chuyển hourly/daily nhưng không vượt horizon có dữ liệu.
- Risk overlay phải giải thích rule và không che mất dữ liệu gốc.

### 4. API and caching

- Endpoint/query tối ưu cho location + time window.
- Cache invalidation theo forecast issue/freshness, không chỉ TTL mù.
- Pagination/aggregation cho lịch sử lớn.
- Contract tests cho timezone, DST nếu liên quan và missing interval.

## Deliverables và evidence

- Forecast/trend product specification.
- API contract và sample response từ dữ liệu thật đã redacted nếu cần.
- Chart prototype và accessibility review.
- Timezone/unit/missing-data test suite.
- UX copy/disclaimer được duyệt trong Directus.

## Acceptance criteria

- UI không hiển thị horizon dài hơn provider hoặc data contract hỗ trợ.
- Mọi chart có nguồn và thời điểm cập nhật.
- Không gọi forecast 16 ngày là forecast 30 ngày.
- Missing/stale data được biểu diễn rõ.
- Summary bằng chữ tái hiện được từ cùng input/config version.
- Chart dùng được trên mobile và hỗ trợ keyboard/screen reader ở mức đã chốt.

## Decision Gate — phải hỏi và chốt với bạn

1. MVP cần forecast theo giờ, theo ngày và horizon bao nhiêu?
2. “Trend” được định nghĩa là xu hướng trong forecast window hay phân tích lịch sử?
3. Biến nào bắt buộc trên chart và biến nào nằm trong màn hình chi tiết?
4. Có so sánh nhiều provider hoặc observation với forecast không?
5. Timezone hiển thị theo địa điểm, thiết bị người dùng hay cố định Việt Nam?
6. Có cần export/share chart hoặc chỉ xem trong ứng dụng?

