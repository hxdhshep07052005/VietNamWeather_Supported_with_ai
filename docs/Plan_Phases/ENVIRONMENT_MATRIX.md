# Environment and Configuration Matrix

## 1. Environment isolation

| Environment | Purpose | Data policy | Secret source | Deployment authority |
|---|---|---|---|---|
| Local | Developer runtime and destructive rebuild tests | Local technical data only | `.env.local` and temporary `.env.bootstrap.local`, both Git-ignored | Product Owner / developer |
| Development | Shared integration environment when introduced | Synthetic technical fixtures or approved reference data; no production copy | CI/deployment secret injection | Protected development workflow |
| Staging | Production-like release rehearsal | Anonymized approved fixtures; ephemeral test accounts only | GitHub encrypted secrets plus SOPS/age deployment material | Manual protected approval |
| Production | Real users and business state | Approved production seed/reference data only | SOPS/age and runtime/Docker secret injection | Product Owner release approval |

Database, Redis namespace/credential, storage scope, Directus keys, bootstrap identity and provider credentials are unique per environment. Production data is never copied to a lower environment without anonymization evidence and explicit approval.

## 2. Configuration ownership

| Configuration | Source of truth | Secret | Promotion rule |
|---|---|---:|---|
| Image versions/digests | Versioned Compose/build files and evidence | No | Review and immutable artifact build |
| Ports, service names, environment labels | Environment file/deployment configuration | No | Environment-specific validation |
| Database/Redis credentials | Runtime secret injection | Yes | Never copied between environments |
| Directus key/secret | Runtime secret injection | Yes | Unique per environment; rotate through runbook |
| Bootstrap admin credential | Temporary bootstrap environment file | Yes | First initialization only; remove after rotation |
| Provider/payment credentials | Runtime secret injection | Yes | Enable only after provider-specific evidence |
| Business plans, feature keys, locale/reference manifests | Versioned seed manifest plus Directus records | No | Idempotent audited promotion |

## 3. Local files

- `.env.example`: non-secret variable contract.
- `.env.bootstrap.example`: temporary bootstrap variable contract.
- `.env.local`: generated local runtime configuration; Git-ignored.
- `.env.bootstrap.local`: generated one-time bootstrap identity; Git-ignored and removed after admin rotation.
- `.env.admin.local`: local-only rotated admin credential used for development verification; Git-ignored and never promoted to VPS/staging/production.

Compose commands must specify the environment file explicitly. They must not rely on a developer's unrelated global environment variables.

## 4. Fail-closed rules

- Missing secret stops startup with a clear configuration error.
- Lower environments cannot use a production database hostname, credential or backup by convention alone; CI/deployment policy must validate the environment identity.
- A missing provider/payment credential disables that adapter capability; it does not create fallback data or entitlement.
- Bootstrap admin variables are not a recovery mechanism. Break-glass access follows `SEC-003` and is separately rotated/audited.
