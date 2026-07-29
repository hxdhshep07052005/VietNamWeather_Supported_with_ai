# Phase 14 — Business Readiness & Handover

**Status:** BLOCKED  
**Phụ thuộc:** Phase 13 RELEASED  
**Mục tiêu:** Hoàn thiện UAT, billing/legal/i18n, đào tạo, tài liệu và ownership để sản phẩm vận hành như một business system.

## Phạm vi công việc

### 1. User acceptance and content readiness

- UAT theo primary journeys và failure journeys.
- Test Free → Pro, trial, upgrade, cancel, refund, downgrade, quota exhausted và payment failure.
- Business owner duyệt risk wording, disclaimer, attribution, translated content và Pro copy.
- Kiểm tra location catalog, provider coverage và hai ngôn ngữ trên các màn hình chính.
- Xác nhận support/contact/report incorrect data flow.

### 2. Admin and operations handover

- Đào tạo Platform Admin, Weather Operations, Risk Analyst, Content Editor, Product/Billing Admin và Support/Auditor.
- Hướng dẫn publish/rollback rule, plan, quota, promo, i18n content và xử lý stale data/provider/payment outage.
- Review least privilege sau UAT; xóa tài khoản/bootstrap access không còn cần.
- Chốt owner và review cadence cho rule, provider, plan, pricing, translation, security và cost.

### 3. Business and legal readiness

- Xác minh provider attribution, payment terms, Directus license và third-party notices.
- Privacy notice, terms, refund/cancellation policy, Pro disclaimer và data retention process.
- Currency, invoice/receipt, tax treatment và support SLA theo thị trường triển khai.
- Incident communication, billing dispute và escalation.
- Quy trình xử lý yêu cầu xóa/export dữ liệu user và chat history nếu có.

### 4. Documentation and reporting

- Architecture, API, data dictionary, entitlement matrix, i18n guide, security model, deployment và runbooks.
- Product guide, pricing/benefit guide và Admin Studio guide.
- Known limitations, technical debt và roadmap.
- Demo script/video nếu cần cho stakeholder hoặc bảo vệ đồ án.
- Post-launch review plan, revenue/conversion KPI và reliability KPI.

## Deliverables và evidence

- Signed UAT report.
- Billing/reconciliation and Pro entitlement report.
- Translation QA report cho `vi` và `en`.
- Training materials và admin competency checklist.
- Legal/license/attribution/refund checklist.
- Operational ownership matrix.
- Final release notes, known limitations và roadmap.

## Acceptance criteria

- Business user thực hiện được nghiệp vụ Admin Studio mà không cần sửa code.
- Free/Pro experience đúng với pricing/benefit đã công bố.
- Không có Pro bypass qua API, URL, client state hoặc replay webhook.
- Nội dung quan trọng có bản dịch Việt–Anh được duyệt; không còn key kỹ thuật trên UI.
- Mọi production role có owner và access review date.
- Provider/payment/license/attribution không còn mục chưa xác minh.
- Support và incident/billing escalation đã được thử bằng tabletop exercise.
- KPI và post-launch review date đã được chốt.

## Decision Gate — phải hỏi và chốt với bạn

1. Ai ký UAT và ai là Product Owner sau khi bàn giao?
2. Support model là cá nhân, team nội bộ hay dịch vụ bên ngoài?
3. Pricing/refund/tax policy áp dụng cho thị trường nào?
4. Ai chịu trách nhiệm cập nhật risk rules, provider contracts, pricing và translations?
5. Tài liệu cần phục vụ production team, hội đồng đồ án hay cả hai?
6. KPI nào quyết định sản phẩm tiếp tục, mở rộng hoặc dừng?
7. Roadmap sau MVP ưu tiên chatbot, notification, personalization hay mở rộng provider?
