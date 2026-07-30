# Directus Version and License Baseline

## 1. Document control

| Field | Value |
|---|---|
| Verification date | 2026-07-30 |
| Selected baseline | Directus `12.1.1` |
| Container pin | `directus/directus@sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d` |
| License identifier in release | `MSCL-1.0-GPL` |
| Decision | `ARCH-011` |
| Status | VERIFIED TECHNICAL BASELINE / LEGAL REVIEW REQUIRED IF BUSINESS MODEL CHANGES |

Không dùng tag `latest` trong local/staging/production definitions. Manifest digest được pin để cùng version không âm thầm đổi image.

## 2. Cross-check evidence

| Official source | Verified result |
|---|---|
| npm registry `directus/latest` | Version `12.1.1`; package requires Node `>=22`; tarball `directus-12.1.1.tgz` |
| GitHub latest release | Stable, non-draft, non-prerelease tag `v12.1.1`; published 2026-07-01 |
| Docker Hub tag `12.1.1` | Active manifest digest `sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d` |
| License file in GitHub tag `v12.1.1` | File SHA `7b0f6c55a4fc66494f7d7e4a4d8db7d073d7e64e`; title `Monospace Sustainable Core License, Version 1.0`; abbreviation `MSCL-1.0-GPL` |

Official references checked:

- https://registry.npmjs.org/directus/latest
- https://github.com/directus/directus/releases/tag/v12.1.1
- https://hub.docker.com/r/directus/directus/tags?name=12.1.1
- https://github.com/directus/directus/blob/v12.1.1/license
- https://directus.com/license
- https://directus.com/docs/self-hosting/overview

## 3. License fit recorded for this product

The included license defines permitted purpose as any purpose other than a competing use. The planned product uses Directus internally as backend/Admin Studio for a weather-aware travel application and does not offer Directus itself as a competing standalone/hosted product.

The release license also:

- Prohibits bypassing protected license-key functionality.
- Requires keeping the license/copyright conditions when redistributing copies or derivatives.
- Grants a future GPL-3.0 license on the fourth anniversary of the release availability date, under the terms in the included license.

This is a technical/compliance record, not legal advice. A qualified legal review is required if the product begins reselling, hosting or exposing Directus itself as a commercial service, modifies protected functionality, redistributes a derivative, or otherwise changes business model.

## 4. Version and upgrade policy

- `12.1.1` is the build baseline, not a promise to remain on an insecure patch forever.
- Before staging and production release, recheck the current supported patch, release notes, included license, extension compatibility, database migration and security advisories.
- Any version/digest change requires an updated evidence record, migration/rollback rehearsal and Decision ID or approved superseding ADR.
- Image digest, extension dependencies and Node runtime are externalized/version-pinned configuration; they are not scattered literals in product code.
- Database backup and restore evidence is mandatory before every Directus upgrade.

## 5. Remaining implementation evidence

Phase 2 must prove that the pinned image starts reproducibly, migrations run from a clean database and upgrade/rollback procedures preserve schema, roles/policies and audit data. Phase 13 must revalidate the production candidate version/license before go-live.
