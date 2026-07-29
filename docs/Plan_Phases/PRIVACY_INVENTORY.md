# Privacy and Personal Data Inventory

## 1. Document control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-07-29 |
| Status | READY_FOR_PRODUCT_OWNER_APPROVAL |
| Controller/business owner | Product Owner |
| Scope | MVP web application, Directus backend, provider integrations and optional AI boundary |

This is a product/privacy engineering baseline, not legal advice. Applicable Vietnamese privacy, cybersecurity, consumer, payment, accounting and cross-border transfer requirements require legal verification before public production launch.

## 2. Privacy principles

- Collect only data required for an explicit product/security/billing purpose.
- Precise GPS is ephemeral by default and is not continuous location history.
- Frontend sends data only to the versioned Application API; third-party provider credentials remain backend-only.
- Search history can be disabled and deleted by the user.
- No card number or CVV is stored by this system.
- No personal data is included in seeds, source control, test fixtures, logs or AI prompts without an approved sanitized test process.
- Analytics/advertising and AI training are disabled by default until separate consent and decisions exist.

## 3. Data inventory

| Data category | Example fields | Purpose | Legal/consent basis to confirm | Storage/system | Baseline retention | User control |
|---|---|---|---|---|---|---|
| Account identity | Email, display name, user ID, locale, role, account status | Registration, login, support and authorization | Contract/service delivery; legal review | Directus/PostgreSQL | Account lifetime; purge/anonymous within 30 days after approved deletion except required records | Correct, export, delete |
| Credentials | Password hash and authentication provider references | Authentication | Service security | Directus auth store | Until password/account replacement/deletion; never export hash | Reset/revoke |
| Session/security | Session ID, token identifiers, login time, IP, user-agent, failed login and revoke events | Session security, abuse prevention and incident response | Legitimate security purpose/notice | Directus/backend security logs | Proposed 90 days; incidents may be retained longer with documented case | View active sessions; revoke; request access subject to security limits |
| Current GPS | Latitude, longitude, accuracy, timestamp, permission state | Center map, weather lookup, route origin, follow/reroute | Explicit browser permission and service request | Browser memory; transient API request | Not persisted by default; removed when request/follow session ends. Avoid raw coordinates in access logs | Allow/deny, stop follow |
| Search input | Query text, selected place/provider ID, normalized coordinates | Geocoding and product use | Service request | Backend/provider; optional history store | Transient if history disabled; otherwise 7 days Free / 90 days Pro | Disable history, delete entries/all |
| Saved locations | Provider/reference ID, label, coordinates | Favorites and quick access | User request | Directus/PostgreSQL | Until user deletes/account deletion, within plan quota | Create/update/delete/export |
| Route request/history | Origin/destination, departure time, mode, route provider reference, geometry or encoded polyline, ETA/risk summary | Route calculation, history and troubleshooting | Service request; precise-location notice | Backend/provider; Directus history store | 7 days Free / 90 days Pro unless explicitly saved; transient GPS samples not stored | Delete history; disable history |
| Saved routes | User label, endpoints, route/provider reference, last evaluated summary | User-selected saved route | User request | Directus/PostgreSQL | Until user deletes/account deletion, within plan quota | Create/update/delete/export |
| GPS follow stream | Position samples during active follow | Update marker and detect route deviation | Explicit permission and active feature | Browser memory; only necessary samples sent to backend for reroute | No continuous server history by default; transient processing only | Stop immediately |
| Weather/cache data | Coordinates/grid reference, provider payload normalized fields, issued/valid/fetched times | Serve weather efficiently and audibly | Non-personal operational data unless linked to user request logs | Cache/PostgreSQL where required | Provider/feature-specific TTL; no indefinite cache against provider terms | N/A |
| Risk evaluation | Input weather references, rule version, output level/score/evidence | Explain recommendation and audit logic | Service delivery | Backend/Directus | Same as route/search context or longer anonymous aggregate; user-linked retention 7/90 days unless saved | View/delete linked history |
| Usage/quota | Feature key, user ID, period, consumed count, idempotency key | Enforce Free/Pro and investigate disputes/abuse | Contract/service security | PostgreSQL/Directus | Current period plus proposed 90 days; aggregate cost metrics may be anonymous | View current usage; dispute |
| Subscription | Plan, status, interval, start/end, grace/cancel dates, entitlement projection | Provide Pro and subscription lifecycle | Contract/billing | Directus/PostgreSQL | Account lifetime plus statutory billing retention where required | View/cancel/export |
| Payment metadata | Provider customer/subscription/transaction IDs, amount, currency, status, invoice/refund references, masked brand/last4 only if provider returns it | Payment, reconciliation, refund, tax/accounting and disputes | Contract/legal obligation | Directus/PostgreSQL + payment provider | Proposed 10 years or applicable statutory period; legal confirmation required | Invoice/history/refund request; deletion may be legally restricted |
| Support communications | Ticket/message, attachments chosen by user | Support and dispute resolution | User request/legitimate support | Approved support system | Proposed 12 months after closure unless dispute/legal hold | Access/delete subject to legal/security need |
| Audit log | Admin actor, action, collection/item reference, before/after metadata excluding secrets | Security, publish approvals, billing/risk accountability | Legitimate security/compliance purpose | Directus audit/central logs | Proposed 12 months; critical billing/security records follow applicable requirement | Restricted admin access; export during formal request where allowed |
| Product analytics | Page/event pseudonymous identifiers | Product improvement | Consent/notice to confirm | Not selected | Disabled in MVP until provider, events, consent and retention are approved | Opt-in/opt-out when introduced |
| Chat content | User question, retrieved weather references, model response, safety/audit metadata | Optional AI assistant | Explicit feature use and notice | Not collected until Phase 11 approval | Proposed 30 days for user-visible history or zero-retention mode; final decision Phase 11 | Delete history; do not use for model training by default |

## 4. Third-party processor/data transfer inventory

| Processor category | Data sent | Prohibited data | Required control |
|---|---|---|---|
| Weather provider | Coordinates/grid references, requested time/fields | User email, JWT, account details | Backend proxy, minimal request, provider terms/retention review |
| Map/geocoding/routing provider | Search text, coordinates, route endpoints and mode | JWT, payment/account secrets | Backend API for search/routing; public map token only if provider explicitly supports scoped browser token; attribution and storage rules |
| Stripe | Customer/contact and billing data required by eligible merchant account | Directus password/JWT, GPS/search history | Hosted checkout/tokenization, signed webhooks, provider privacy/merchant terms |
| VNPay | Order/payment reference, amount, IP and fields required by contract | Password/JWT, GPS/search history, card/CVV stored by application | Hosted/token flow, HMAC validation, IPN idempotency, merchant agreement |
| Email provider | Destination email and template variables | Password hash, full location history | Approved templates, suppression handling, minimal metadata |
| Monitoring/error service | Pseudonymous user/request ID, sanitized stack/error metadata | Tokens, secrets, raw provider payload with PII, precise GPS | Scrubbing, field allowlist, retention/access control |
| LLM provider — optional | Minimal question plus allowlisted retrieved weather/travel facts | JWT, credentials, raw users, arbitrary DB rows, payment data, precise GPS unless strictly needed and approved | Backend orchestration, tool authorization, redaction, retention/training contract review |

Cross-border transfers are likely when third-party providers operate outside Vietnam. Before production, publish processor categories and verify required notices, agreements, transfer records/assessments and user rights under applicable law.

## 5. Consent and user experience requirements

- Geolocation permission is requested only after a clear user action explaining why it is needed.
- Denying GPS does not block manual location search.
- Search-history storage has a visible setting; disabling it stops new history but does not silently delete saved favorites/routes.
- Account deletion explains which billing/legal records cannot be immediately erased.
- Cookie/analytics consent is not shown unless non-essential tracking actually exists; no dark patterns.
- `vi` and `en` privacy/legal content are versioned and record user acceptance when legally required.

## 6. Data subject request workflow

1. Authenticate the requester or use a documented recovery/identity check.
2. Create an auditable request with type: access, correction, export, deletion, objection/withdrawal.
3. Locate Directus, payment, support and optional AI records through stable user/provider references.
4. Export only authorized user data in a portable format; exclude secrets and other users’ data.
5. Delete/anonymize eligible data and record exceptions/retention basis.
6. Revoke sessions and provider tokens where account deletion requires it.
7. Record completion date and evidence without retaining the deleted payload itself.

## 7. Logging and security rules

- Never log Authorization/Cookie headers, passwords, refresh tokens, provider secrets, full payment tokens or unmasked card data.
- Avoid raw search text and precise coordinates in generic access logs; use request IDs and coarse/hashed operational fields when possible.
- Production database/cache are not public internet services.
- Admin and service accounts use least privilege and auditable rotation.
- Backups are encrypted, access-controlled and follow the same deletion/retention policy within documented backup expiry.

## 8. Privacy acceptance checklist

- Every stored user-linked field maps to a purpose and retention entry in this inventory.
- GPS denial, stop-follow and history-disabled flows are tested.
- Delete/export tests cover Directus, saved data, usage and billing exceptions.
- Provider/monitoring logs are checked for secrets, precise GPS and user identifiers.
- Privacy/legal pages exist in both locales before production.
- Analytics and AI remain disabled until their separate privacy decisions are approved.
