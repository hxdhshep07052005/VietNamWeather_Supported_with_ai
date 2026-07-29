# Phase 11 — Optional AI Chatbot

**Status:** BLOCKED/OPTIONAL  
**Phụ thuộc:** Phase 5–10 VERIFIED và security review cho AI  
**Mục tiêu:** Cung cấp trợ lý hỏi đáp thời tiết du lịch có grounding, quota Pro và kiểm soát chi phí/hallucination.

## Điều kiện để được bắt đầu

- Core product, Pro entitlement và i18n đã hoạt động end-to-end.
- Weather/risk/route API có contract ổn định.
- Chatbot có feature key/usage quota riêng và feature flag kill switch.
- Có privacy decision cho chat logs và user location.
- Có budget/cost cap và abuse policy.

## Phạm vi công việc

### 1. Grounded tool architecture

- Chatbot gọi các tool nội bộ được allowlist: location search, current weather, forecast, risk explanation và route summary.
- Tool dùng service account least privilege; không dùng admin token.
- Không cho model tự viết query tùy ý vào Directus hoặc truy cập collection nhạy cảm.
- Weather numbers phải đến từ tool output kèm source/updated time.
- Mỗi tool tự authorize theo authenticated user, Directus policy, item ownership, entitlement và field allowlist; không tin model nói user có quyền.
- Không gửi JWT, refresh token, password, LLM/provider secret, raw user record hoặc service credential vào prompt/context.
- Query depth, item count, time range và response fields bị giới hạn server-side để chống data exfiltration.

### 2. Prompt, i18n and content governance

- System prompt, policy, tool description, locale và response template được version hóa.
- Prompt config không chứa secret.
- Câu trả lời phân biệt dữ liệu thật, suy luận và lời khuyên chung.
- Bắt buộc disclaimer cho quyết định an toàn/rủi ro cao.
- Chống prompt injection từ content/provider data.
- System prompt không được xem là security boundary; jailbreak không thể vượt tool/API authorization.
- Trả lời theo locale `vi` hoặc `en` mà user đã chọn; không dịch ngầm số liệu sai đơn vị.

### 3. Pro quota and abuse controls

- Chat request phải qua entitlement check và usage metering backend.
- Rate limit, input length, conversation length và daily/monthly cost cap.
- Redact/avoid logging token, precise location và PII ngoài policy.
- Timeout/fallback: nếu LLM lỗi, trả unavailable; không giả làm câu trả lời AI thành công.
- Feature flag kill switch và provider rotation procedure.

### 4. Evaluation

- Golden question set bằng Việt và Anh về weather, risk, route và missing/stale data.
- Kiểm tra factual consistency với tool output.
- Kiểm tra refusal, uncertainty, citations, i18n và prompt injection.
- Theo dõi hallucination rate, tool failure, latency, quota rejection và cost/query.

## Deliverables và evidence

- AI architecture/threat model update.
- Versioned prompts, tools và translation keys.
- Golden evaluation set + evaluation report.
- Cost/rate-limit/quota dashboard và kill-switch test.
- Privacy/retention configuration cho chat data.

## Acceptance criteria

- Free/Pro entitlement được enforcement ở backend.
- Chatbot không đưa số liệu khi tool không trả dữ liệu hợp lệ.
- Mọi câu trả lời có dữ liệu thời tiết nêu source và thời điểm cập nhật.
- Prompt injection không làm lộ system prompt, secret hoặc dữ liệu ngoài quyền.
- User không thể yêu cầu AI đọc user khác, role/policy, billing record hoặc collection ngoài tool contract.
- Tắt feature flag loại bỏ entry point và API access theo thiết kế.
- Không có translation key, câu hardcode hoặc fallback giả trong production response.

## Decision Gate — phải hỏi và chốt với bạn

1. Chatbot có thật sự nằm trong release hiện tại hay để post-MVP?
2. Chatbot là Pro-only hay Free có quota nhỏ?
3. LLM provider nào được phép dùng theo privacy, region, cost và terms?
4. Có lưu chat history không; nếu có, retention và quyền xóa/export là gì?
5. Daily/monthly message quota và cost cap mong muốn là bao nhiêu?
6. Chatbot hỗ trợ cả Việt và Anh ngay khi ra mắt không?
7. Có human escalation/support channel không?
