# Secrets, Bootstrap and Break-Glass Runbook

## 1. Local initialization

Generate local configuration without printing secret values:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/initialize-local-env.ps1 `
  -AdminEmail "<owner-controlled-local-email>"
```

The command creates `.env.local` and `.env.bootstrap.local`. Both are Git-ignored. It refuses to overwrite either file unless `-Force` is explicitly supplied.

Validate the files without displaying their contents:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/validate-local-env.ps1
```

For an existing local environment, add the Phase 3 API/session values without replacing existing secrets:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/upgrade-local-phase3-env.ps1
```

`API_SESSION_ENCRYPTION_KEY`, `API_CSRF_SIGNING_KEY` and `API_DB_PASSWORD` are generated locally, Git-ignored and never printed. Email-verification and password-recovery URLs/TTLs are generated as non-secret configuration and validated against the Application API allowlist. The keys remain distinct from Directus `KEY`/`SECRET` and the admin password.

## 2. Bootstrap lifecycle

1. Start the clean Directus database with both local environment files.
2. Sign in using the bootstrap admin over the local trusted origin.
3. For local development, run `tools/environment/rotate-local-admin.ps1`; it generates a distinct password, verifies it in a separate login and stores it only in Git-ignored `.env.admin.local`.
4. For staging/production, replace the generated password with a password stored in the Product Owner's password manager and verify it in a separate session.
5. Remove `.env.bootstrap.local` only after verification; the local rotation command performs this automatically.
6. Restart without the bootstrap file and verify health/admin login.
7. Record rotation time and evidence without recording either password.

Cleanup command:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/remove-local-bootstrap.ps1
```

Local rotation command:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/rotate-local-admin.ps1
```

## 3. CI and VPS contract

- GitHub Actions consumes GitHub encrypted secrets and never prints secret-bearing environment variables.
- VPS deployment material is encrypted using SOPS/age; the age private key remains outside Git and outside container images.
- Decrypted files are created only under `secrets/decrypted/`, use restrictive filesystem permissions where supported and are removed after runtime injection.
- Production release does not accept `.env.local`, `.env.bootstrap.local` or local database volumes.
- Directus license material is injected as exactly one of `DIRECTUS_LICENSE_KEY` or `DIRECTUS_LICENSE_TOKEN`. It is never committed, copied into an image or stored in seed/evidence output.
- `LICENSE_KEY` may require Directus licensing-service connectivity for activation/refresh. An official offline `LICENSE_TOKEN`, when supplied by Directus, is verified locally. Do not invent or bypass either credential format.
- After injection, recreate Directus and run `tools/directus/validate-license.ps1 -RequireLicensed` before applying custom business permissions.
- Application API deployment also requires its own database identity/password and session/CSRF encryption keys. Inject them at runtime; never reuse Directus `KEY`, `SECRET`, admin, provider or payment credentials.
- A database grant/migration must leave the API identity limited to `app_security` session/audit objects. Verify the credential-column denial check before promoting the API image.
- Rotate Application API ciphertext with [`PHASE_3_SECURITY_OPERATIONS.md`](PHASE_3_SECURITY_OPERATIONS.md); never replace `API_SESSION_ENCRYPTION_KEY` without running the transactional re-encryption tool and an active-session/revoke check.

## 4. Break-glass access

- Product Owner stores the credential in a password manager and an encrypted offline recovery copy.
- Use requires a reason, timestamp and affected environment record.
- After access, review audit events, revoke suspicious sessions/tokens and rotate the break-glass credential.
- Break-glass identity is not used by CI, worker, seed scripts or routine Admin Studio access.

## 5. Prohibited evidence

Do not place passwords, keys, tokens, connection strings, decrypted SOPS content or screenshots containing them in Git, logs, issue trackers or Phase evidence.

If any runtime secret is displayed accidentally, rotate it immediately, invalidate affected sessions and record only the rotation result. Local Directus key/secret rotation uses `tools/environment/rotate-local-directus-secrets.ps1`.
