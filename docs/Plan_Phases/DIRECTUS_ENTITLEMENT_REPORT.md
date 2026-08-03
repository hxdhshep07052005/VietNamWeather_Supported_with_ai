# Directus 12.1.1 Core Entitlement Report

**Status:** VERIFIED_LOCAL / LICENSED_PATH_ACTIVE  
**Date:** 2026-08-04  
**Runtime:** pinned Directus `12.1.1` image from `ARCH-011`  
**Scope:** Core-license technical limits that affect Phase 3 authorization and Phase 4 schema

## 1. Why this report exists

The Phase 1 license review verified the source license and commercial-use fit, but it did not enumerate the runtime entitlements enforced by Directus 12.1.1. Phase 3 role tests reached the seat limit and triggered a deeper runtime/package verification.

This is not a legal opinion. It is reproducible technical evidence from the exact pinned image.

## 2. Core entitlement values in the pinned image

The packaged `@directus/license` Core license defines:

| Entitlement | Core value | Product impact |
|---|---:|---|
| Active admin/app seats | 3 | Includes Super Admin and every active user whose policy has Admin/App Studio access |
| Active collections | 25 | Phase 4 must count the final active custom collections; exceeding the limit needs a different entitlement or schema decision |
| Active flows | 5 | Workflow design must remain within the limit or use another approved implementation |
| Custom permission rules | Disabled | Item filters, custom field allowlists, validation/presets beyond recommended app permissions are rejected |
| Production enabled | Yes | Core runtime itself permits production, subject to all other license terms and limits |
| Activity/revision history | 30 days | Does not satisfy the approved 12-month admin/security audit requirement without a separate application audit store |

Source inside the pinned container:

```text
/directus/node_modules/.pnpm/@directus+license@0.3.0_*/node_modules/@directus/license/dist/index.mjs
```

At the time of the initial probe, local `/server/info` reported no external license source, so the runtime was using the packaged Core entitlements. Section 6 records the later licensed state.

## 3. Reproduced runtime probes

### 3.1 Seat limit

With the existing single Super Admin, two additional active Studio users were created successfully. Creating the next active Studio user was rejected. All probe users were deleted immediately.

```text
DIRECTUS_CORE_SEAT_PROBE_OK existing_admin=1 additional_created=2 rejected_code=LIMIT_EXCEEDED expected_total_limit=3
```

Roles and policies do not consume seats by themselves. Active users assigned to Admin/App-access policies do.

### 3.2 Custom permission rule restriction

A temporary request attempted to create an ownership-filtered read permission. Directus rejected it before insert; permission count remained zero.

```text
DIRECTUS_CORE_CUSTOM_PERMISSION_PROBE_OK result=RESOURCE_RESTRICTED category=custom_permission_rules_enabled permission_rows_created=0
```

This directly affects the planned `owner_id = current user`, field allowlist and item-level Directus policies.

## 4. What remained valid before licensing

- The 13 approved role/policy/access definitions can exist with zero collection permission.
- Seven staff policies can be configured with MFA and Studio flags, even though only three active Admin/App users fit the Core seat limit.
- Public, registered-user and service policies can remain default-deny.
- Application API authorization, session handling and audit storage can still be implemented independently.

## 5. Product Owner decision

Product Owner selected the licensed Directus path at `ARCH-015`:

- Obtain an official key or offline token that enables custom permission rules.
- Inject only one credential through runtime secret management.
- Validate the effective `/license` response before applying any custom business permission.
- Confirm seat/collection/flow capacity against the real staffing and Phase 4 schema before production.

Downgrading to an older Directus release or bypassing protected license functionality is not an approved workaround.

## 6. Licensed runtime result

The architecture decision is now implemented locally. Directus validates the protected environment credential as an active Open Innovation Grant with production and custom permissions enabled. The credential value is not stored in Git, images, seed data, documentation or evidence output.

Current licensed evidence:

```text
DIRECTUS_LICENSE_VALIDATION_OK mode=required name=Open Innovation Grant status=active source=env production=true custom_permissions=true seats_limit=-1 collections_limit=-1 flows_limit=-1 usage_seats=1 usage_collections=0 usage_flows=0 key_configured=true token_configured=false secrets_printed=false
```

Seven human staff policies now receive only the self-scoped `directus_users:update` permission required by the verified TFA endpoint. Business collection permissions remain absent until Phase 4 creates the real schema and ownership tests.

Validation commands:

```powershell
pnpm run inspect:directus-license
pnpm run validate:directus-license
```

The second command is the fail-closed gate and now passes with the protected Open Innovation Grant key. It must continue to pass before any licensed permission manifest is applied.
