# Phase 12 Decision Gate — Quality, Security Hardening & Observability

**Date:** 2026-08-16
**Status:** APPROVED
**Approved by:** Technical Owner & Security Reviewer
**Decision IDs:** `QUAL-001` through `QUAL-008`

## Decision Gate Summary

Phase 12 validates that the platform meets strict quality standards, security defenses, observability requirements, and resilience invariants before production release. This document records all formal engineering and security rulings.

---

## QUAL-001 — Global Quality Gate & Zero-Tolerance Policy

**Ruling:** Production release requires a **100% automated test pass rate** across all monorepo workspaces (`apps/web`, `apps/api`, `apps/worker`, `packages/contracts`).
- Zero TypeScript compile errors (`pnpm run typecheck` passes cleanly).
- Zero ESLint errors or warnings (`pnpm run lint` passes cleanly).
- **Zero Waiver Policy:** No security flaw of Critical or High severity can be waived or postponed for production release.

---

## QUAL-002 — Secret Redaction & Log Hygiene

**Ruling:** Zero credentials or secrets may ever appear in public API outputs, client responses, error handlers, or application logs.
- Sensitive environment variables (`WEATHERAPI_KEY`, `GEOAPIFY_API_KEY`, `SESSION_ENCRYPTION_KEY`, `STRIPE_WEBHOOK_SECRET`, `VNPAY_HASH_SECRET`, `PGPASSWORD`) must be redacted from error objects and stack traces.
- Public errors return structured codes and user-safe messages (`message: "Internal server error"`) without internal memory dumps or query parameters containing credentials.

---

## QUAL-003 — Mutation Security: Strict Origin & CSRF Enforcement

**Ruling:** All state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) must enforce:
1. **Origin Guard:** The `Origin` header must exactly match allowlisted web origins (`ALLOWED_ORIGINS`). Requests with missing or untrusted Origin headers are rejected with HTTP 403 `ORIGIN_REJECTED`.
2. **CSRF Guard:** Must present a cryptographically signed CSRF cookie and matching header/field. Mismatched or tampered tokens are rejected with HTTP 403 `CSRF_REJECTED`.

---

## QUAL-004 — Observability & Distributed Correlation Tracking

**Ruling:**
- Every inbound request is assigned a unique `correlationId` (derived from incoming `x-correlation-id` or generated as UUID/cuid).
- The `correlationId` is returned in response headers and included in every structured JSON log line for end-to-end tracing.
- `/health/live`: Unauthenticated probe returning HTTP 200 `status: "live"` for load-balancer liveness checks.
- `/health/ready`: Deep health probe checking database connectivity, session store, and Redis readiness. Returns HTTP 503 `status: "not_ready"` if any core dependency is down.

---

## QUAL-005 — Rate Limiting & Abuse Prevention

**Ruling:** Tiered rate limits are enforced at the API gateway layer:
- Authentication endpoints (login, register, password reset): Strictest limits (e.g. 10 requests / 15 minutes) to defeat brute-force and credential stuffing attacks.
- Weather and Route APIs: Abuse protection limits against automated scrapers.
- Exceeded rate limits return HTTP 429 `RATE_LIMITED` with a structured payload including the retry-after window.

---

## QUAL-006 — No-Fake-Data Invariant & Graceful Degradation

**Ruling:** If upstream providers (WeatherAPI, Geoapify, payment gateways) fail or time out:
- The system must fail closed: return explicit structured `unavailable` or `degraded` responses citing provider status.
- The system **never fabricates synthetic weather data** or mock coordinates to conceal upstream outages.
- If Redis is unavailable or restarts, the platform must degrade gracefully to in-memory caching without crashing or terminating user sessions.

---

## QUAL-007 — Webhook Security & Idempotent Reconciliation

**Ruling:**
- Payment webhooks must verify HMAC signatures: HMAC-SHA256 with timestamp tolerance for Stripe, HMAC-SHA512 over sorted parameters for VNPay.
- Unsigned or invalid requests are rejected with HTTP 400 `BILLING_INVALID_SIGNATURE`.
- Every processed event ID is recorded in an immutable ledger. Duplicate event delivery returns HTTP 200 without duplicate credit or state mutation (idempotency).

---

## QUAL-008 — AI Chatbot Grounding & Parameter Authorization

**Ruling:**
- AI Chatbot interactions are limited to the 5 allowlisted internal tools.
- Every tool independently validates user identity, role, and quota before execution.
- Prompt injection delimiters (`### System:`, `[INST]`, `[<|im_start|>]`) are stripped before processing.
- Input length is capped at 1000 characters; daily messages are capped at 3 (Free) and 30 (Pro).
