# Cost Envelope and Budget Controls

## 1. Document control

| Field | Value |
|---|---|
| Version | 1.1 |
| Date | 2026-07-31 |
| Status | APPROVED ARCHITECTURE BASELINE / LIVE SPEND DISABLED |
| Ceiling | 15,000,000 VND/month excluding transaction fees |
| Decision | `OPS-002`, `OPS-005` |

This is a maximum planning envelope, not permission to spend and not a provider quote. Current approved automatic provider spend is 0 VND: no paid weather upgrade is approved, Geoapify has no paid auto-upgrade, and payment providers remain disabled without merchant evidence. Taxes, transaction fees, bandwidth and VPS details are revalidated before production.

## 2. Proposed monthly allocation

| Cost bucket | Planning allocation | Alert ceiling | Notes |
|---|---:|---:|---|
| Weather API and weather map layers | 2,000,000 VND reserved | 0 VND current automatic spend | WeatherAPI current capability selected; paid upgrade requires a new Decision ID |
| Geoapify Free map/geocoding/routing | 0 VND initial | 0 VND automatic charge | Public plan: 3,000 credits/day, no card; live fixtures passed; dashboard reconciliation and browser attribution are assigned to Phase 13/9 |
| VPS/network/domain/backup reserve | 1,500,000 VND | 1,500,000 | User-owned server may consume less; reserve cannot justify missing backup |
| PostgreSQL/object storage/backup operations | 1,000,000 VND | 1,000,000 | If storage is on VPS, retain equivalent off-site backup reserve |
| Monitoring, logs, email/support services | 1,000,000 VND | 1,000,000 | Do not ship PII/secrets to telemetry |
| Payment fixed/merchant/service fees | 1,000,000 VND reserved | 0 VND before merchant approval | Stripe/VNPay are feature-disabled until provider-specific evidence exists |
| Contingency and provider bake-off | 5,000,000 VND | 5,000,000 | Used only with an explicit decision; not a license to exceed total ceiling |
| Unallocated map/provider reserve | 3,500,000 VND | 3,500,000 | Cannot be spent or used to attach a paid plan without a new Decision ID |
| **Total** | **15,000,000 VND** | **15,000,000 VND** | |

Optional chatbot/LLM cost is not in the core envelope. Enabling it requires a separate cap, abuse policy and cost decision.

## 3. Cost formulas

- Weather monthly cost = provider calls by endpoint × provider unit price + fixed plan fee.
- Geoapify daily credit use = tile/style credits + geocoding credits + routing credits according to the current provider credit table.
- Routing capacity = route requests × alternatives/waypoint multiplier, constrained by the shared 3,000-credit daily Free allowance until a new decision.
- Payment cost = fixed merchant/service fees + successful transaction amount × fee rate; charged separately from infrastructure ceiling.
- Backup cost = retained backup volume × storage price + transfer/restore test cost.

All formulas consume observed metrics, not guessed user counts. Cache hit/miss, route sampling count and provider retries must be measured.

## 4. Budget controls

- Alerts at 50%, 75%, 90% and 100% of total and each provider bucket.
- At 90%, disable non-critical bake-off/analytics/optional AI requests and notify Product Owner.
- At 100%, fail closed for optional/expensive requests; never silently incur overage or show fake data.
- Backend quotas do not replace provider account spend limits; both are required.
- Monthly reconciliation compares provider invoices/usage with internal request ledger.
- API keys use separate development/staging/production projects and per-key quotas where provider supports it.
- Geoapify alerts are based on 50%/75%/90%/100% of the daily credit allowance; at 100%, new map-intensive/geocoding/routing operations degrade explicitly without paid auto-upgrade.

## 5. Approval and review

Phase 1 approves this envelope under `OPS-006` with the following evidence and constraints:

- Geoapify and WeatherAPI credentials are live and isolated locally; API responses exposed no authoritative credit/spend header.
- Geoapify public Free allowance is the external ceiling and paid auto-upgrade is prohibited.
- The application must maintain a provider request/operation ledger; it must not claim that one request equals one credit without provider evidence.
- Stripe/VNPay credentials are absent and their capability output is disabled, so they create no current fixed or transaction spend.
- Provider dashboard/invoice reconciliation, VPS costs and final production alert wiring are Phase 13 evidence before release.

Any actual spend, allocation change above 10% or ceiling increase requires a new Decision ID. Missing account telemetry causes fail-closed optional capability, not silent overage.
