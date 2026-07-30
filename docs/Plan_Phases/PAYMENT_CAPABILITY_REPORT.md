# Payment Capability Evidence

## 1. Status

| Field | Value |
|---|---|
| Verification date | 2026-07-31 |
| State | CONDITIONAL CONTRACT APPROVED / MERCHANT ENABLEMENT DEFERRED |
| Sandbox/production payment requests sent | 0 |
| Entitlement granted by this check | None |
| Current safe default | Stripe disabled; VNPay disabled until merchant onboarding, then prepaid/manual renewal unless recurring is proven |

## 2. Stripe

- Official Stripe global availability page returned HTTP 200 and did not list Vietnam as a direct account-registration country at verification time.
- Official Stripe Billing documentation returned HTTP 200 and documents subscription/recurring capabilities for eligible accounts.
- No eligible foreign merchant entity, Stripe account evidence or sandbox secret is configured locally.
- Result: Stripe adapter remains disabled and is not advertised by `/api/v1/payment-capabilities`. This is not evidence that Stripe can never be used; it means this project has not proved a legally eligible merchant entity.

## 3. VNPay

- Official VNPay PAY documentation returned HTTP 200.
- Official VNPay token-payment documentation returned HTTP 200 and documents token creation/payment flows.
- Official VNPay query/refund documentation returned HTTP 200 and includes documentation references to transaction query/refund and periodic-payment parameters.
- No VNPay merchant code, hash secret, production contract or sandbox credential is configured locally.
- Public API documentation alone does not prove this merchant account can perform unattended off-session recurring billing. Result: VNPay remains disabled until merchant onboarding; after onboarding it uses prepaid/manual renewal until written contract/API production evidence proves unattended recurring.

## 4. Security and business gate

- No payment key, merchant code or hash secret is included in this report or sent to the browser.
- Checkout success/return URL must never grant Pro; only verified webhook/IPN processing may project entitlement.
- Before enabling a provider in Phase 10, record merchant entity, currency/market, recurring/manual-renewal capability, refund/cancel behavior, webhook/IPN test evidence and fee schedule.

## 5. Official sources checked

- https://stripe.com/global
- https://docs.stripe.com/billing
- https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
- https://sandbox.vnpayment.vn/apis/docs/thanh-toan-token/token.html
- https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html

## 6. Phase 1 closure

Merchant enablement is not an architecture prerequisite because `ARCH-010` fails closed: unavailable providers are omitted from backend capability output and cannot grant entitlement. Phase 10 must not enable Stripe or VNPay until the provider-specific merchant, fee, webhook/IPN and refund evidence listed above exists. This report closes the Phase 1 capability decision but does not claim a production merchant account or successful payment.
