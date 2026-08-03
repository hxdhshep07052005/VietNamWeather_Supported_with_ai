# Initial Threat Model

## 1. Document control

| Field | Value |
|---|---|
| Version | 1.1 |
| Date | 2026-07-31 |
| Status | ACTIVE / PHASE 3 BASELINE PARTIALLY VERIFIED |
| Owner | Product Owner / Technical Owner |
| Related decisions | `SEC-001..010`, `ARCH-003`, `ARCH-004`, `ARCH-008`, `ARCH-015`, `OPS-003` |

## 2. Assets

- Directus users, roles, policies and session identity.
- Subscription, payment metadata, entitlement and quota ledgers.
- Precise GPS, search history, saved locations and routes.
- Weather/routing provider keys and payment secrets.
- Risk rules, thresholds, weights, advisory and legal content.
- Route geometry, forecast provenance and operational logs.
- Backups, Admin Studio and deployment credentials.
- Optional AI tool permissions and sanitized context.

## 3. Actors

| Actor | Trust level | Examples |
|---|---|---|
| Anonymous browser | Untrusted | Scraper, manipulated client, unauthenticated visitor |
| Authenticated user | Partially trusted | Free/Pro user attempting cross-account access or quota abuse |
| Admin/operations | Privileged but bounded | Content/rule/payment operations user |
| Provider | External/untrusted response | Weather, map, routing and payment services |
| Worker/service account | Internal privileged service | Ingestion/reconciliation/job processor |
| Attacker | Untrusted | Credential thief, bot, prompt-injection author, payment fraudster |

## 4. Trust boundaries

1. Browser ↔ public reverse proxy.
2. Public API/webhook ingress ↔ Application API.
3. Application API/Directus ↔ PostgreSQL/Redis.
4. Worker ↔ external providers.
5. Admin Studio ↔ private network boundary.
6. Application/worker logs ↔ monitoring/backup systems.
7. Optional AI model ↔ allowlisted backend tools.

## 5. Threat register

| ID | Threat | Impact | Likelihood | Required mitigation | Verification |
|---|---|---|---|---|---|
| `TM-001` | Token/session theft through XSS or storage | Account takeover | Medium | Secure HttpOnly opaque cookie, CSP, output encoding, no localStorage refresh token, session revoke | Browser/security tests |
| `TM-002` | CSRF on billing/profile mutations | Unauthorized state change | Medium | SameSite cookie, Origin/Host validation, CSRF token where needed | Integration tests |
| `TM-003` | IDOR on saved locations/routes/history | Privacy breach | High | Ownership/item-level policy at every endpoint/tool; negative tests | RBAC/IDOR suite |
| `TM-004` | Directus generic API exposure | Schema/data bypass | High | Private generic routes, public Application API only, network scan | Deployment scan |
| `TM-005` | Privilege escalation to Admin/Super Admin | Full compromise | Medium | Least-privilege roles, deny-by-default policies, MFA if supported, audit | Access matrix/penetration test |
| `TM-006` | Brute force/credential stuffing | Account takeover/availability | High | Rate limits, lockout/backoff, breached-password policy decision, login audit | Abuse/load test |
| `TM-007` | Provider URL SSRF | Internal network/secret exposure | Medium | Provider allowlist, no user-controlled URL fetch, egress policy | SSRF tests |
| `TM-008` | Provider payload injection or schema drift | Wrong weather/risk/route | Medium | Schema validation, unit normalization, bounds checks, adapter versioning | Contract fixtures |
| `TM-009` | Weather stale hoặc vượt operational horizon nhưng vẫn được dùng như current/actionable | Unsafe decision | High | `issued_at`/`valid_at`/`fetched_at`, freshness state, `DATA-004` horizon enforcement, circuit breaker và unknown/outlook output | Stale/horizon/error tests |
| `TM-010` | Route score manipulation in client | False safety recommendation | High | Route/risk calculation backend-only, signed/traceable DTO provenance | Tampered-client tests |
| `TM-011` | Payment webhook forgery | Unauthorized Pro/refund | High | Raw-body signature/checksum, provider event ID, idempotency and reconciliation | Invalid/replay tests |
| `TM-012` | Payment event replay/out-of-order | Duplicate entitlement or charge state | High | Immutable event ledger, state machine, monotonic transition rules, worker retries | Replay/order tests |
| `TM-013` | Quota race or multi-session bypass | Cost/abuse | High | Atomic usage ledger, Redis lock/rate limit plus database truth | Concurrency tests |
| `TM-014` | Server secrets in frontend/logs/backups | Provider/account compromise | High | Secret manager/env injection, redaction, scans, encrypted backups; Geoapify browser key is separate and never reused as server key | Secret scan/log review |
| `TM-015` | Admin translation/content XSS | Stored XSS/legal spoofing | Medium | Sanitized rich text/allowlisted markup, CSP, publish review | Content security tests |
| `TM-016` | Precise GPS over-collection | Privacy harm | Medium | Permission UX, ephemeral processing, retention controls, log redaction | Privacy workflow tests |
| `TM-017` | Prompt injection/jailbreak | Unauthorized AI data/action | Medium | Tool allowlist, independent auth/field filters, no model-issued DB/payment commands | AI boundary tests |
| `TM-018` | Redis compromise or loss | Queue/cache/session disruption | Medium | Private network, auth/TLS, no business truth in Redis, fail-closed mutations | Failure drill |
| `TM-019` | Backup theft or restore poisoning | Data breach/recovery failure | Medium | Encryption, access separation, restore integrity checks and retention | Restore/security drill |
| `TM-020` | Dependency/container supply-chain compromise | Remote code execution | Medium | Pin versions/digests, lockfiles, vulnerability scan, minimal images, signed release evidence | CI/security scan |
| `TM-021` | Public API denial-of-service | Availability/cost | High | Edge rate limits, quotas, cache, provider circuit breakers, payload limits | Load/abuse tests |
| `TM-022` | Misleading “weather-safer” claim | Safety/legal/reputational harm | Medium | Defined comparison scope, disclaimer, evidence/explanation and official advisory links | Content/legal review |
| `TM-023` | Public tile key abuse exhausts Geoapify credits | Map outage/cost pressure | High | Dedicated browser key, browser-origin allowlist where supported, usage monitoring, rotation and explicit quota-exhausted state | Browser/network/quota tests |

## 6. Abuse cases to test

- Change `plan`, `quota`, `price`, `route score` or `subscription` fields in browser requests.
- Replay a successful payment callback ten or more times.
- Use one user’s route ID with another user’s session.
- Submit a provider URL, oversized coordinate array or malicious translation markup.
- Deny GPS then submit fabricated coordinates from the client.
- Ask optional AI to reveal system prompt, JWT, raw tables or bypass Pro limits.
- Flood search/route endpoints across multiple sessions/IPs.

## 7. Residual risks

- A single VPS is a single failure domain until redundancy is purchased.
- Provider outage/coverage/forecast error cannot be eliminated; the product must disclose it.
- Solo review lacks independent separation of duties; automated evidence and explicit advisory limitations compensate but do not remove this risk.
- Legal interpretation of privacy/payment/Directus licensing requires appropriate professional review.

## 8. Security gate

Phase 1 can produce the threat model, but Phase 12 must show mitigation evidence and no open Critical/High finding before release.

## 9. Phase 3 implementation update

- `TM-001` baseline: browser receives only opaque Secure HttpOnly cookies; Directus tokens remain encrypted server-side. Session rotation, old-handle replay denial and logout revoke pass against local services.
- `TM-002` baseline: state-changing auth routes require exact Origin/Host plus a separately signed CSRF cookie/header token. Missing CSRF and unknown origin are denied.
- `TM-004` partial: product API exposes only versioned routes and returns 404 for unknown/generic paths. Production reverse-proxy and WireGuard network proof remains pending.
- `TM-006` partial: login, registration, password recovery and email verification have Redis-backed configurable rate limiting, generic registration/recovery responses, encrypted one-time handles and replay denial. Account lockout/breached-password controls remain pending.
- `TM-005` local baseline: Directus password, status, role, MFA-secret change and user deletion trigger immediate application-session revocation; old browser handles return 401 in the live drill. Licensed managed-staff TFA enrollment, missing-OTP denial and OTP login now pass.
- `TM-014` partial: API logger redacts authorization, cookie, auth consume URL, redirect location and credential fields; Directus email-verify path is excluded from access logging and live response/log marker scans pass. Full frontend bundle/source-map and backup scans remain pending.
- `TM-018` partial: PostgreSQL is authoritative for session revoke/expiry; Redis is only a rate-limit store. Redis stop/start drill proves readiness and mutation fail-closed with retryable dependency errors; production HA/alerting evidence remains pending.
- `TM-021` partial: payload and route/IP rate limits pass unit tests; edge/load/bypass testing remains pending.

The previous role-change window is closed for the Application API by a PostgreSQL trigger on `directus_users`; password/status/role/MFA/delete changes revoke active application sessions immediately. Residual risk remains that the encrypted upstream Directus token material is retained until the configured session purge and cannot be actively logged out by a database trigger; it is no longer reachable through the revoked browser handle. Business ownership/field policy and cross-user tests remain a Phase 4 acceptance gate after the real schema exists.

Recovery/verification residual risk: `SEC-009` and `SEC-010` accept Directus one-time tokens only on redacted HTTPS consume requests. The token is still present in that first request URL by design; production edge/proxy/log/analytics controls must preserve redaction, no-referrer and no-store behavior. The Application API immediately exchanges it for an encrypted server-side record plus opaque fragment handle, and live tests deny expiry/replay and verify no token appears in API/Directus logs.
