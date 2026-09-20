# Phase 10 Decision Gate — Monetization, Subscription & Entitlements

**Date:** 2026-08-14
**Status:** APPROVED
**Approved by:** Technical Owner & Product Owner
**Decision IDs:** `MONET-001` through `MONET-008`

## Decision Gate Summary

Phase 10 implements the monetization, billing, subscription management, and entitlement access control for the platform. This document records all product decisions required before implementation.

---

## MONET-001 — Product Plans & Pricing Baseline

**Ruling:** MVP implements two tiers: **Free** and **Pro** (per `PRODUCT-001`). Pricing is structured as follows:
- **Free Tier:** 0 VND / $0 USD
- **Pro Monthly:** 99,000 VND / $4.99 USD
- **Pro Yearly:** 990,000 VND / $49.90 USD

**Rationale & Rules:**
- Yearly plan pricing equals exactly 10 months of monthly pricing (per `PRODUCT-003`), delivering ~16.7% customer discount.
- Currency is dynamically rendered based on user locale (`vi` -> VND, `en` -> USD) with proper local currency formatting.
- Free tier requires user authentication (per `PRODUCT-006`); anonymous users are limited to landing page marketing preview.

---

## MONET-002 — Payment Provider Selection & Strategy

**Ruling:** Dual-provider architecture via unified `PaymentAdapter` (per `ARCH-001` and `ARCH-002`):
1. **Stripe:** International payments, credit/debit cards (Visa, Mastercard, JCB, Amex), recurring subscriptions.
2. **VNPay:** Domestic Vietnamese payments (Domestic ATM, Mobile Banking QR, VNPay E-Wallet).

**Constraints:**
- Backend advertises available payment providers via `/api/v1/billing/plans`.
- Frontend never communicates directly with payment provider private APIs; all checkout sessions and verification originate strictly from backend.
- Zero secret storage: No credit card details, CVV, or payment secrets are stored in local database or Directus.

---

## MONET-003 — Payment Cycle & Renewal Model

**Ruling:**
- **Stripe:** Standard recurring subscription with automated renewals, webhook status syncing, and customer portal for card management.
- **VNPay:** Prepaid fixed-term model (1 month or 1 year) due to local merchant tokenization limitations. VNPay purchases grant entitlement for the exact duration of the paid term. Renewal reminder notifications are queued 7 days and 3 days prior to expiration. No simulated auto-recurring.

---

## MONET-004 — Atomic Quota Ledger & Daily Reset

**Ruling:** Usage quotas are tracked atomically and reset daily at **00:00 `Asia/Ho_Chi_Minh`** (UTC+7, per `PRODUCT-005`).

**Quota Allocation Matrix (per `PRODUCT-004`):**
| Capability | Free Tier | Pro Tier |
|---|---|---|
| Map & Current Weather | Unlimited fair-use (rate-limited) | Unlimited fair-use (priority SLA) |
| Location Search | 10 requests / day | 200 requests / day |
| Route Evaluations | 3 requests / day | 30 requests / day |
| Route Alternatives | 1 corridor | 3 corridors (Fastest, Shortest, Safer) |
| Saved Locations | 3 items | 50 items |
| Saved Routes | 1 item | 20 items |
| History / Trends | 7 days | 90 days |

**Enforcement:**
- Quota ledger is maintained atomically at the backend with thread-safe check-and-decrement.
- If daily quota reaches zero, backend returns HTTP 429 with structured error `QUOTA_EXCEEDED` containing `quotaResetAt` and feature key.

---

## MONET-005 — Entitlement Capabilities & Gating

**Ruling:** Pro features are gated strictly on the server:
- `feature_weather_future_timeline`: Timeline scrubbing & forecast animation beyond current weather (per `PRODUCT-007`).
- `feature_weather_advanced_overlays`: High-resolution radar and wind layer projections.
- `feature_route_corridors_multi`: Access to multiple comparative route corridors.
- `feature_extended_forecast`: Complete provider-supported horizon.

Frontend UI reflects capability states via `/api/v1/billing/entitlements` and never overrides backend access rules.

---

## MONET-006 — Webhook Reconciliation & Idempotency

**Ruling:**
- **Stripe:** HMAC-SHA256 signature verified against `STRIPE_WEBHOOK_SECRET` with timestamp tolerance window (300 seconds) to prevent replay attacks.
- **VNPay:** HMAC-SHA512 checksum verified using merchant hash secret over sorted query parameter dictionary.
- **Idempotency:** An immutable event ledger (`billing_events`) records every processed `event_id` or transaction reference. Duplicate deliveries return HTTP 200 without duplicate credit or state mutation.

---

## MONET-007 — Subscription Lifecycle & Cancellation

**Ruling:**
- Cancellation retains Pro access until `current_period_end`.
- Payment failure enters `past_due` state with a 3-day grace period for automatic retries before downgrading to `free`.
- Immediate revocation is restricted to chargebacks or administrative fraud bans.
- Downgrading preserves existing saved items in read-only state; users can view but cannot add new items until under the Free tier limit.

---

## MONET-008 — Administrative Overrides & Audit Trail

**Ruling:**
- Administrators can manually grant or revoke Pro status via Directus Admin Studio.
- Every manual override requires:
  - `target_user_id`
  - `operator_id`
  - `action`: `GRANT_PRO` or `REVOKE_PRO`
  - `reason`: Mandatory text description (minimum 10 characters)
  - `expires_at`: Expiration ISO timestamp (maximum 365 days)
- All modifications are appended to an immutable `audit_log` with operator identity and correlation ID.
