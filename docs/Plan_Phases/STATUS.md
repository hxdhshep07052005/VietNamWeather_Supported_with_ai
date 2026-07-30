# Project Status

**Ngày khởi tạo plan mới:** 2026-07-25  
**Trạng thái tổng:** PHASE_2_LOCAL_VERIFIED_REMOTE_CI_PENDING
**Phase hiện tại:** Phase 2 — Directus Foundation & Environments
**Cập nhật gần nhất:** 2026-07-31 — Product Owner / Technical Owner

## Phase board

| Phase | Status | Dependency | Evidence |
|---|---|---|---|
| 0. Discovery | VERIFIED | Product Owner approved Phase 0 contract | `PRODUCT-011`, `PRD.md`, `PROVIDER_COMPARISON.md`, `PRIVACY_INVENTORY.md`, `ACCEPTANCE_METRICS.md`, `PHASE_0_EVIDENCE.md` |
| 1. Architecture | VERIFIED | Product Owner approved architecture/NFR/provider/security/cost baseline | [`PHASE_1_EVIDENCE.md`](PHASE_1_EVIDENCE.md), [`VIETNAM_PROVIDER_FIXTURE_REPORT.md`](VIETNAM_PROVIDER_FIXTURE_REPORT.md), `ARCH-004..013`, `SEC-002`, `OPS-005..006`, `DATA-004`, `PRODUCT-012` |
| 2. Directus Foundation | IN_PROGRESS (LOCAL_VERIFIED) | GitHub Actions/GHCR remote run chưa thực hiện | [`PHASE_2_EVIDENCE.md`](PHASE_2_EVIDENCE.md), `ARCH-014`, `SEC-003`, `DATA-005`, `OPS-007` |
| 3. Security & Identity | BLOCKED | Phase 2 VERIFIED | Chưa có |
| 4. Data Model & Admin | BLOCKED | Phase 3 VERIFIED | Chưa có |
| 5. Weather Integration | BLOCKED | Phase 4 VERIFIED | Chưa có |
| 6. Risk Engine | BLOCKED | Phase 5 VERIFIED | Chưa có |
| 7. Forecast & Trends | BLOCKED | Phase 5 VERIFIED | Chưa có |
| 8. Route Planner | BLOCKED | Phase 6 và 7 VERIFIED | Chưa có |
| 9. Frontend | BLOCKED | Phase 4–8 có API contract ổn định | Chưa có |
| 10. Monetization | BLOCKED | Phase 3–9 contracts stable | Chưa có |
| 11. AI Chatbot | BLOCKED/OPTIONAL | Core product + monetization VERIFIED | Chưa có |
| 12. Quality & Hardening | BLOCKED | Core feature complete | Chưa có |
| 13. Deployment & Operations | BLOCKED | Phase 12 VERIFIED | Chưa có |
| 14. Business Handover | BLOCKED | Phase 13 RELEASED | Chưa có |

## Cách cập nhật trạng thái

Mỗi lần đổi trạng thái phải ghi:

- Ngày giờ và người duyệt.
- Decision ID liên quan trong `DECISIONS.md`.
- Link commit hoặc pull request.
- Link test report, security report hoặc deployment evidence.
- Blocker còn lại và người chịu trách nhiệm.

## Blocker hiện tại

- Repository/runtime/schema/seed/backup/clean rebuild/secret scan/SBOM đã pass validator local.
- Workflow `.github/workflows/ci.yml` đã qua Actionlint, nhưng chưa có remote run vì thay đổi chưa được commit/push.
- Không được chuyển Phase 2 sang `VERIFIED` hoặc mở Phase 3 trước khi GitHub Actions pass, GHCR tạo image immutable theo commit SHA và Product Owner duyệt evidence đóng phase.

## Lưu ý

Các tuyên bố hoàn thành trong plan cũ không được chuyển sang plan này. Mọi artifact cũ, nếu được tìm thấy, phải qua audit và test lại trước khi được công nhận.
