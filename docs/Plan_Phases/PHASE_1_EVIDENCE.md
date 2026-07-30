# Phase 1 Evidence Manifest

## Status

**Phase:** VERIFIED  
**Architecture baseline:** Accepted  
**Implementation:** Not started  
**Blocking evidence:** None for Phase 1; implementation/production evidence remains assigned to later phases

## Required deliverables

| Deliverable | File | State |
|---|---|---|
| Architecture diagram and component boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) | Complete draft |
| Data-flow and trust-boundary diagrams | [DATA_FLOW.md](DATA_FLOW.md) | Complete draft |
| ADR set | [adr/README.md](adr/README.md) | Complete draft; decisions recorded |
| NFR/SLO sheet | [NFR_SLO.md](NFR_SLO.md) | Accepted measurable baseline; load proof assigned to Phase 12/13 |
| Threat model | [THREAT_MODEL.md](THREAT_MODEL.md) | Accepted initial model; mitigation proof assigned to implementation phases |
| Cost envelope | [COST_ENVELOPE.md](COST_ENVELOPE.md) | Approved ceiling, zero-auto-spend and fail-closed controls |
| Provider bake-off specification | [PROVIDER_BAKEOFF.md](PROVIDER_BAKEOFF.md) | Complete |
| Weather bake-off report | [WEATHER_BAKEOFF_REPORT.md](WEATHER_BAKEOFF_REPORT.md) | WeatherAPI capability-bounded baseline selected; 30-location suite passed |
| Map/geocoding/routing provider report | [MAP_BAKEOFF_REPORT.md](MAP_BAKEOFF_REPORT.md) | Geoapify full live fixture and route-objective capability verified |
| Vietnam provider fixture report | [VIETNAM_PROVIDER_FIXTURE_REPORT.md](VIETNAM_PROVIDER_FIXTURE_REPORT.md) | Accepted live 30-location/30-route/reverse/weather suite |
| Payment capability report | [PAYMENT_CAPABILITY_REPORT.md](PAYMENT_CAPABILITY_REPORT.md) | Conditional contract approved; providers disabled until merchant evidence |
| Reproducible Stage 1 validator | [`tools/validation/validate-stage1.ps1`](../../tools/validation/validate-stage1.ps1) | Checks links, decisions, ADRs, statuses, report guardrails, secret isolation and Git whitespace |
| Reproducible weather capability probe | [`tools/provider-bakeoff/run-weather-capability-probe.ps1`](../../tools/provider-bakeoff/run-weather-capability-probe.ps1) | Uses live provider responses, redacts secrets and emits no fabricated fallback |
| Reproducible Geoapify capability probe | [`tools/provider-bakeoff/run-geoapify-capability-probe.ps1`](../../tools/provider-bakeoff/run-geoapify-capability-probe.ps1) | Requires separate local tile/server keys; probes style, geocoding and routing while emitting sanitized derived fields only |
| Directus version/license baseline | [DIRECTUS_BASELINE.md](DIRECTUS_BASELINE.md) | Verified against npm, GitHub and Docker Hub on 2026-07-30 |

## Current decision evidence

| Decision | Result | Evidence |
|---|---|---|
| Directus + worker boundary | Accepted | `ARCH-004`, `ADR-001` |
| PostgreSQL + PostGIS | Accepted | `ARCH-005`, `ADR-002` |
| Next.js + TypeScript + PWA | Accepted | `ARCH-006`, `ADR-003` |
| API facade + server-side session | Accepted | `ARCH-003`, `SEC-001`, `ADR-004` |
| Redis coordination | Accepted | `ARCH-007`, `ADR-005` |
| Private Admin Studio | Accepted | `SEC-002` |
| Payment ingress/worker | Accepted | `ARCH-008`, `ARCH-010`, `ADR-006` |
| Hybrid i18n | Accepted | `ARCH-009`, `ADR-007` |
| NFR/load baseline | Accepted | `OPS-005`, `NFR_SLO.md` |
| Local-to-VPS portability | Accepted | `OPS-003`, `ADR-008` |
| Route/risk operational forecast horizon | Accepted | `DATA-004` |
| Directus exact version/image/license baseline | Accepted | `ARCH-011`, `ADR-009`, `DIRECTUS_BASELINE.md` |
| Map/geocoding/routing stack | Accepted | `ARCH-012`, `ADR-010`, `MAP_BAKEOFF_REPORT.md` |
| Weather provider baseline | Accepted | `ARCH-013`, `ADR-011`, `WEATHER_BAKEOFF_REPORT.md` |
| Provider budget/external capability closure | Accepted | `OPS-006`, `COST_ENVELOPE.md`, `PAYMENT_CAPABILITY_REPORT.md` |
| Phase 1 approval | Accepted | `PRODUCT-012` |

## Gate result

1. Architecture, data flow, ADR, NFR, threat and cost artifacts are accepted.
2. WeatherAPI and Geoapify live fixtures are reproducible and sanitized.
3. Unsupported provider/payment capabilities fail closed and are not advertised.
4. Product Owner approval is recorded in `PRODUCT-012`.
5. Phase 2 is `AWAITING_DECISION`.

Browser provider enforcement, load tests, merchant webhook/IPN, account reconciliation, backup/restore and production deployment remain mandatory in their assigned phases. They are not silently treated as completed by Phase 1 verification.
