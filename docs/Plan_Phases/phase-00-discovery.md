# Phase 0 — Discovery & Product Contract

**Status:** VERIFIED
**Phụ thuộc:** Không  
**Mục tiêu:** Chuyển ý tưởng ban đầu thành phạm vi sản phẩm có thể đo, nghiệm thu và vận hành.

## Phạm vi công việc

### 1. Product definition

- Xác định nhóm người dùng chính, bối cảnh sử dụng và quyết định họ cần đưa ra.
- Viết user journey: xem bản đồ → xem forecast → đánh giá địa điểm → lập tuyến → đọc cảnh báo.
- Xác định tính năng public, tính năng cần đăng nhập và tính năng Pro.
- Xác định MVP, post-MVP và optional chatbot.
- Xác định mô hình Free/Pro, cách giới hạn usage và benefit trả phí.
- Xác định i18n Việt–Anh cho UI, content, billing và chatbot.
- Viết non-goals và disclaimer pháp lý về an toàn/thời tiết.

### 2. Business requirements

- Chốt Product Owner, technical owner và người có quyền approve risk rule.
- Chốt deadline, ngân sách vận hành dự kiến và giới hạn dịch vụ trả phí.
- Chốt KPI: tỷ lệ route evaluation thành công, data freshness, lỗi provider, usage và user engagement.
- Xác định có hay không yêu cầu lưu lịch sử tìm kiếm, tuyến yêu thích và hồ sơ người dùng.
- Xác định KPI subscription: conversion, trial-to-paid, churn, payment failure, quota exhaustion và Pro usage.
- Xác định owner cho pricing, entitlement, refund/cancellation và translation approval.

### 3. Provider discovery

- Lập shortlist weather, geocoding và routing provider.
- So sánh coverage tại Việt Nam, forecast horizon, update frequency, quota, SLA, attribution và commercial terms.
- Xác minh điều khoản sử dụng production; không giả định free tier phù hợp business.
- Xác minh license và deployment option của Directus cho bối cảnh tổ chức thực tế.

### 4. Privacy and compliance discovery

- Xác định dữ liệu cá nhân sẽ thu thập: email, vị trí hiện tại, lịch sử tuyến, chat logs.
- Chốt consent, retention, delete/export request và analytics policy.
- Precise GPS mặc định ephemeral; continuous location history chỉ được lưu khi có feature/consent/retention decision riêng.
- Xác định yêu cầu data residency hoặc khu vực triển khai.
- Xác định dữ liệu billing/subscription nào được lưu; không lưu card number/CVV.

## Deliverables và evidence

| Deliverable | Evidence bắt buộc |
|---|---|
| Product Requirements Document | [PRD.md](PRD.md) được Product Owner duyệt |
| MVP scope và non-goals | [PRD.md](PRD.md) và Decision IDs `PRODUCT-*` |
| Provider comparison matrix | [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md), nguồn chính thức và ngày kiểm tra terms/quota |
| Initial privacy inventory | [PRIVACY_INVENTORY.md](PRIVACY_INVENTORY.md) với data category, purpose, retention và control |
| Product acceptance metrics | [ACCEPTANCE_METRICS.md](ACCEPTANCE_METRICS.md) với công thức, target và evidence |
| Phase evidence manifest | [PHASE_0_EVIDENCE.md](PHASE_0_EVIDENCE.md) |

## Acceptance criteria

- Không còn câu “người dùng” chung chung; có ít nhất một primary persona và một support persona.
- Mỗi outcome có acceptance metric hoặc cách kiểm chứng.
- Chatbot được xác định rõ optional, không nằm trên critical path mặc định.
- Provider chưa được chọn phải được ghi là decision pending, không bị hardcode vào phase sau.
- Có người chịu trách nhiệm phê duyệt nội dung risk/advisory.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** Product model, ownership và access (`PRODUCT-001..010`), payment (`ARCH-001..003`), seeding/security/privacy/location coverage (`DATA-001..003`, `SEC-001`), deadline/budget/deployment/capacity (`OPS-001..004`).

Không còn product decision bắt buộc đang chờ. Product Owner là solo developer full-time và tự giữ toàn bộ vai trò trong MVP (`PRODUCT-010`, `OPS-004`). VPS inventory được defer tới Phase 13 và không chặn local development (`OPS-003`).

Các artifact và evidence đã được Product Owner duyệt bằng `PRODUCT-011`. Phase 0 đã `VERIFIED`.
