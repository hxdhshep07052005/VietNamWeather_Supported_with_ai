# Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](ADR-001-directus-worker-boundary.md) | Ranh giới Directus + integration worker | Accepted |
| [ADR-002](ADR-002-postgresql-postgis.md) | PostgreSQL + PostGIS | Accepted |
| [ADR-003](ADR-003-nextjs-pwa.md) | Next.js + TypeScript + PWA shell | Accepted |
| [ADR-004](ADR-004-api-session-boundary.md) | Versioned API facade và server-side session | Accepted |
| [ADR-005](ADR-005-redis-coordination.md) | Redis cho cache/queue/coordination | Accepted |
| [ADR-006](ADR-006-payment-webhook.md) | Durable payment webhook processing | Accepted |
| [ADR-007](ADR-007-hybrid-i18n.md) | Hybrid frontend/Directus i18n | Accepted |
| [ADR-008](ADR-008-portable-self-hosting.md) | Portable local-to-VPS self-hosting | Accepted |
| [ADR-009](ADR-009-directus-version-license.md) | Directus exact version, image digest và license baseline | Accepted |
| [ADR-010](ADR-010-maplibre-geoapify.md) | MapLibre + Geoapify Free map/geocoding/routing stack | Accepted |
| [ADR-011](ADR-011-weatherapi-capability-bounded.md) | WeatherAPI capability-bounded point-weather baseline | Accepted |

Mỗi ADR phải nêu phương án đã xem xét, trade-off, security impact, chi phí/vận hành, migration/rollback và evidence. Thay đổi status hoặc quyết định phải tạo Decision ID/ADR superseding; không sửa lịch sử để che trade-off cũ.
