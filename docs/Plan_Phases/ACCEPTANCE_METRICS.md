# Product Acceptance Metrics

## 1. Document control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-07-29 |
| Status | APPROVED — `PRODUCT-011` |
| Measurement owner | Product Owner / solo developer |

Targets below are release acceptance baselines. Phase 1 may tighten NFR values through a recorded decision, but cannot replace measurable targets with subjective words.

## 2. Core release acceptance metrics

| ID | Metric | MVP target | Measurement/evidence |
|---|---|---:|---|
| `ACC-001` | Anonymous product API denial | 100% of protected endpoint tests return `401/403`; public role reads only published landing/pricing/legal/locale content | Automated authorization matrix and negative integration tests |
| `ACC-002` | Frontend API-only boundary | 0 frontend network calls to generic Directus REST/GraphQL, database, workers or geocoding/routing/weather/payment/AI APIs; only approved Geoapify tile/style origins are allowlisted | Contract test, build scan and browser network allowlist |
| `ACC-003` | Weather provenance | 100% successful current/forecast DTOs contain provider/source, `valid_at`, `fetched_at`, freshness state and `issued_at` when provider supplies it | Schema/contract tests and golden responses |
| `ACC-004` | Stale/unknown correctness | 100% stale, missing, unsupported and provider-error fixtures render explicit state; 0 fixtures render fabricated weather | Integration/UI state tests |
| `ACC-005` | Current data freshness | At least 95% of successful current-weather responses during provider bake-off are within configured 15-minute target; all older results are labeled stale or unavailable | Timed provider test report; target finalized Phase 1/5 |
| `ACC-006` | Search quota | Free requests 1–10/day succeed when provider available; request 11 is denied without provider call. Pro request 201 is denied. Reset time is correct at 00:00 `Asia/Ho_Chi_Minh` | Boundary, concurrency and multi-session tests |
| `ACC-007` | Forecast entitlement | Free and Pro cannot retrieve beyond the smaller of backend entitlement and provider-valid coverage; current account exposes 3 days and frontend manipulation cannot extend it | API authorization/entitlement/capability tests |
| `ACC-008` | Risk determinism | 100% versioned rule fixtures return expected level/evidence/explanation; missing required input never returns `safe` | Unit/property/approval fixture tests |
| `ACC-009` | Route quota | Free route 1–3/day and Pro route 1–30/day work; next request is denied atomically; retries with same idempotency key do not double-count | Concurrency/idempotency integration tests |
| `ACC-010` | Route alternatives contract | Free receives at most 1 route; Pro receives at most 3 provider-returned routes; system never invents geometry | Provider contract and DTO tests |
| `ACC-011` | Vietnam route golden set | At least 95% of deliberately routable origin/destination pairs return a valid provider route; 100% no-route pairs return explicit no-route/unsupported state | Reproducible >=30-pair bake-off report |
| `ACC-012` | ETA-weather traceability | 100% route-risk segments reference route version, ETA, weather valid time/freshness and risk rule version, or explicitly report unknown mismatch | Route evaluation audit fixtures |
| `ACC-013` | GPS privacy/behavior | Supported-browser tests pass for allow, deny, unavailable, inaccurate, stop-follow and active movement; no continuous GPS history exists by default | Browser/PWA tests plus database/log inspection |
| `ACC-014` | Saved-data limits | Free/Pro saved location/route limits are enforced atomically in backend; delete frees capacity and cannot delete another user’s item | Authorization/concurrency tests |
| `ACC-015` | i18n completeness | 0 missing locale keys in landing, auth, map, forecast, route, paywall, billing and core error states for `vi`/`en` | Locale extraction/lint plus visual QA |
| `ACC-016` | Payment authenticity | 100% invalid signature/checksum webhook/IPN fixtures are rejected without state change | Stripe/VNPay integration tests |
| `ACC-017` | Payment idempotency | Replaying any successful/failed/refund/cancel event at least 10 times produces one logical transition and no duplicate entitlement | Replay/reordering test report |
| `ACC-018` | Subscription enforcement | Expired/cancelled/refunded/unpaid states lose Pro according to approved policy; frontend/JWT tampering cannot retain Pro | End-to-end entitlement tests |
| `ACC-019` | Privacy controls | Export, history disable/delete, saved-data delete, session revoke and account-deletion workflow pass for both locales | Privacy workflow integration tests |
| `ACC-020` | Security release gate | 0 open Critical/High findings in auth, RBAC/IDOR, secrets, dependency, payment and AI boundary checks | Security report and remediation evidence |
| `ACC-021` | Accessibility | Core flows meet WCAG 2.2 AA automated checks with manual keyboard/focus review; reduced-motion/static map fallback works | Accessibility report and device/browser evidence |
| `ACC-022` | Backup and rollback | Latest production-like backup restores successfully; release rollback drill completes within approved RTO | Restore/rollback runbook evidence |
| `ACC-023` | Operational forecast horizon | 100% route/risk requests có ETA cuối tuyến <= 72 giờ mới được scoring; ngày 4–7 chỉ trả outlook; dữ liệu xa hơn không tạo weather-safer recommendation | Boundary tests tại 72 giờ/7 ngày, config-version audit và provider coverage report |
| `ACC-024` | Geoapify browser/server boundary | Browser key chỉ tải tile/style; 100% geocoding/routing requests đi qua `/api/v1`; quota exhaustion hiển thị unavailable và không fallback sang public OSM/Nominatim | Browser network allowlist, server log correlation, quota/degraded tests |

## 3. Provisional Phase 1 NFR targets

These values make Phase 0 measurable and must be confirmed or changed by ADR in Phase 1:

| ID | Target | Baseline |
|---|---|---|
| `NFR-P01` | Availability | 99.5% monthly for application/API excluding documented third-party provider outage; degraded states still available where possible |
| `NFR-P02` | Cached API latency | p95 <= 500 ms at expected load |
| `NFR-P03` | Provider-backed API latency | p95 <= 3 seconds before timeout/degraded response; exact provider timeout/circuit policy Phase 5/8 |
| `NFR-P04` | Landing performance | p75 mobile LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms on agreed test profile |
| `NFR-P05` | Map readiness | Authenticated current-weather map usable <= 4 seconds p75 on agreed mid-range mobile/network profile |
| `NFR-P06` | Payment entitlement sync | 95% valid webhook/IPN events reflected <= 60 seconds; 100% reconciled within 15 minutes or alerted |
| `NFR-P07` | Recovery | Provisional RPO <= 24 hours and RTO <= 4 hours for single-VPS MVP; finalized before production |
| `NFR-P08` | Cost | Monthly forecast <= 15,000,000 VND excluding transaction fees, with alerts at 50%/75%/90%/100% |

## 4. Provider bake-off metrics

| Metric | Formula/target |
|---|---|
| Location coverage success | Successful normalized response / valid Vietnam test locations; target >= 95% |
| Geocoding top-result relevance | Correct top result / benchmark queries; target >= 90%, with manual bilingual review |
| Forecast field completeness | Required non-null fields / expected fields across test points; target >= 95%, with legitimate phenomenon absence handled separately |
| Route success | Valid route results / routable benchmark pairs; target >= 95% |
| Provider p95 latency | p95 of server-side calls by endpoint and region; recorded, not estimated |
| Projected monthly cost | Calls per product flow × forecast usage × unit price after cache; must fit `NFR-P08` |
| Attribution/license compliance | 100% required attribution/storage restrictions represented in UX/data design |

No provider wins solely on price or a marketing accuracy claim. Missing fields, terms and Vietnam-specific quality are scored as evidence gaps.

## 5. Business KPI definitions

Initial launch establishes baselines; targets are set after sufficient traffic rather than invented before launch.

| KPI | Formula |
|---|---|
| Landing-to-signup conversion | Completed registrations / unique eligible landing visitors |
| Activation | New users completing current-weather view plus forecast or route evaluation within 7 days / new registered users |
| Route evaluation success | Successful route-risk results / valid route evaluation attempts |
| Search quota exhaustion | Users reaching daily search limit / active users, segmented Free/Pro |
| Route quota exhaustion | Users reaching daily route limit / active users, segmented Free/Pro |
| Pro conversion | New paid Pro subscriptions / eligible active Free users |
| Payment success | Paid/confirmed checkout attempts / checkout attempts, segmented by provider |
| Payment reconciliation exceptions | Unresolved provider/internal state mismatches / payment events |
| Voluntary churn | User-initiated Pro cancellations / active Pro subscriptions at period start |
| Involuntary churn | Pro expirations caused by failed payment / active Pro subscriptions at period start |
| Provider error rate | Failed/time-out provider calls / provider calls by endpoint |
| Weather freshness compliance | Successful responses meeting freshness target / successful weather responses |

Analytics collection for these KPIs must follow [PRIVACY_INVENTORY.md](PRIVACY_INVENTORY.md); analytics remains disabled until event scope, consent and retention are approved.

## 6. Evidence rules

- Evidence names the commit, environment, time, provider/version and command/test suite.
- Screenshots alone do not prove backend authorization, payment or data-quality correctness.
- Manual evidence is acceptable only where automation is impractical and must include repeatable steps.
- A metric cannot be marked pass from fake provider responses except isolated unit/contract tests; production-path acceptance uses sandbox or real provider data as appropriate.
