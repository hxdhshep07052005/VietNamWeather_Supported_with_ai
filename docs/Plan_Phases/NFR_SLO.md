# Non-Functional Requirements and SLO Baseline

## 1. Document control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-07-29 |
| Status | DRAFT / NEEDS PROVIDER AND PRODUCTION-LIKE LOAD EVIDENCE |
| Decision | `OPS-005` |

These targets are the initial Phase 1 baseline. They must be measured in a production-like environment and may only be tightened or changed through a recorded ADR.

## 2. Service-level objectives

| SLO | Target | Measurement | Exclusions/notes |
|---|---:|---|---|
| Application availability | 99.5% monthly | Successful health/readiness and representative API probes | Planned maintenance and documented third-party outage are reported separately, not hidden |
| Cached API latency | p95 <= 500 ms | Server timing from ingress to DTO response | At agreed load profile; includes authorization/serialization |
| Provider-backed API latency | p95 <= 3 s before degraded response | Server-side provider span plus normalization | Timeout/circuit behavior is a success of degraded mode, not an unlimited wait |
| Payment entitlement sync | p95 <= 60 s | Provider event receipt to entitlement projection | 100% reconciled or alerted within 15 min |
| Current-weather freshness | >= 95% successful results within 15 min | `fetched_at`/provider issued time and response state | Provider update frequency and product cache TTL must be recorded |
| Route result freshness | 100% evaluations show weather `valid_at`/ETA relationship | Route audit fields | Mismatch produces unknown/reduced confidence |
| Backup restore | Successful restore in <= 4 h | Restore drill duration | RPO baseline <= 24 h |

## 3. Capacity test envelope

Initial load test must cover:

- 100 authenticated users concurrently.
- 300 Application API requests/minute peak.
- 500 route evaluations/day, with bursts and duplicate retries.
- Geoapify Free usage must remain within the verified daily credit allowance; benchmark records credits per tile/geocoding/routing flow rather than assuming one request equals one credit.
- 10,000 application weather lookups/day as a logical-user traffic envelope; provider calls must be lower when cache is effective and must remain within provider budgets.
- At least two worker consumers, or a documented single-worker failure simulation if VPS capacity prevents two.
- Provider rate-limit, timeout and recovery scenarios.

This is a test envelope, not a promise of unlimited public traffic. Capacity expansion requires cost and infrastructure evidence.

## 4. Performance budgets

| Surface | Target |
|---|---:|
| Public landing mobile LCP | p75 <= 2.5 s |
| Public landing CLS | p75 <= 0.1 |
| Public landing INP | p75 <= 200 ms |
| Authenticated map usable | p75 <= 4 s on agreed mid-range mobile/network profile |
| Initial JS bundle | Establish framework baseline in Phase 1; route-specific budgets are set before frontend implementation |
| Map animation | No unbounded memory growth during 10-minute playback; reduced-motion/static fallback always available |

## 5. Resilience and recovery

- RPO baseline: <= 24 hours for MVP database/business state.
- RTO baseline: <= 4 hours for a single-VPS failure scenario.
- PostgreSQL backups are encrypted, versioned, copied off-site and restore-tested.
- Redis loss must not lose subscription, payment, quota or audit truth.
- Provider failure uses timeout, circuit breaker, stale-cache policy and explicit unavailable state.
- Worker retry uses bounded exponential backoff, idempotency key and dead-letter state.
- Deployment rollback is tested with a known-good image/config bundle.

## 6. Security and privacy NFR

- 0 open Critical/High security findings at release.
- 100% authorization matrix coverage for anonymous, Free, Pro, owner and admin/operations paths.
- No credentials, JWT, refresh token, card/CVV, raw provider secrets or unredacted precise GPS in logs.
- Admin Studio is not public-open; network boundary and Directus policies are both enforced.
- Dependency, container and secret scans run before release.
- Account deletion/export and GPS/history controls are testable and auditable.

## 7. Accessibility and compatibility

- Core flows target WCAG 2.2 AA.
- Keyboard navigation, visible focus, screen-reader names and error association are manually reviewed.
- Minimum browser target: latest two stable versions of Chrome, Edge, Firefox and Safari; current iOS Safari/Android Chrome for GPS/PWA checks.
- Geolocation denial, unsupported browser and reduced-motion are first-class states.

## 8. Observability requirements

Every request/job/payment event should carry:

- Correlation/request ID.
- Service and version.
- Outcome/error code and retryability.
- Duration and provider reference where safe.
- Data freshness and queue age where relevant.

Alerts:

- API error rate, latency and readiness.
- Weather/routing provider error and rate-limit rate.
- Queue age/dead-letter count.
- Payment event lag/reconciliation mismatch.
- Backup failure/restore-test expiry.
- Cost thresholds at 50%, 75%, 90% and 100% of the monthly ceiling.
- Geoapify daily credit thresholds at 50%, 75%, 90% and 100%; no paid auto-upgrade.

## 9. SLO ownership and review

The solo Technical Owner reviews weekly during the three-month delivery period. Any target change records reason, measured evidence, user impact and rollback/mitigation.
