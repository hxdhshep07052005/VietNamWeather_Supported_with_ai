# Phase 6 — Config-Driven Weather Risk Engine

**Status:** BLOCKED  
**Phụ thuộc:** Phase 5 VERIFIED  
**Mục tiêu:** Đánh giá rủi ro du lịch bằng rule được quản trị, giải thích và kiểm thử; không hardcode ngưỡng trong code.

## Phạm vi công việc

### 1. Risk taxonomy

- Chốt risk levels, tên hiển thị, màu sắc và ý nghĩa nghiệp vụ.
- Chốt risk dimensions: mưa, gió, nhiệt độ, giông, tầm nhìn, cảnh báo chính thức và các biến provider hỗ trợ.
- Phân biệt risk theo activity/context nếu được duyệt: city travel, beach, mountain, road travel.
- Có trạng thái `unknown/insufficient_data` độc lập với safe/low risk.

### 2. Rule configuration

- Rule lưu trong Directus với operator, threshold/range, unit, severity, priority, scope và effective period.
- Rule set có version, approval status và nguồn tham khảo.
- Formula/aggregation route hoặc location risk lưu cấu hình có schema validation.
- Chỉ rule set `published` và đang hiệu lực được dùng ở production.
- Không cho người dùng nhập biểu thức tùy ý có thể thực thi code.

### 3. Evaluation engine

- Input là normalized weather snapshot/forecast có freshness hợp lệ.
- Output gồm level, score nếu có, triggered rules, evidence, explanation và rule version.
- Missing critical field phải hạ confidence hoặc trả insufficient data.
- Kết quả deterministic: cùng input + rule version phải ra cùng output.
- Có audit khi rule publish, rollback hoặc retire.

### 4. Validation and governance

- Tạo scenario suite cho normal, threshold boundary, extreme và missing-data cases.
- Business/risk approver duyệt expected outcome từng scenario.
- Regression test toàn bộ scenario trước khi publish rule set mới.
- Canary/preview rule set trên dữ liệu lịch sử hoặc shadow evaluation trước production nếu khả thi.

## Deliverables và evidence

- Risk taxonomy và rule schema.
- Initial rule set có nguồn, owner và approval.
- Deterministic evaluation service/extension.
- Scenario test suite và regression report.
- Admin workflow draft/review/publish/rollback.

## Acceptance criteria

- Code không chứa ngưỡng nghiệp vụ hoặc advisory text.
- Boundary values ở đúng phía của rule theo spec.
- Thiếu dữ liệu không bao giờ mặc định thành mức an toàn.
- Public response giải thích được biến/rule nào tạo ra cảnh báo.
- Có thể publish phiên bản rule mới và rollback mà không deploy code.
- Người soạn rule không tự publish nếu maker-checker được bật.

## Decision Gate — phải hỏi và chốt với bạn

1. Dùng bao nhiêu risk level và tên gọi nào? Khuyến nghị: Low/Caution/High/Unknown thay vì tuyên bố Safe/Danger tuyệt đối.
2. Nguồn nghiệp vụ nào dùng để xác định ngưỡng và ai chịu trách nhiệm phê duyệt?
3. Có phân loại theo activity/travel mode hay dùng một rule set chung trong MVP?
4. Có tích hợp cảnh báo chính thức từ cơ quan chức năng không?
5. Cách tổng hợp nhiều yếu tố là max severity, weighted score hay rule priority?
6. Dữ liệu stale/missing tới mức nào thì risk phải là `unknown`?
7. Disclaimer và advisory cần hiển thị ở đâu và bằng ngôn ngữ nào?

