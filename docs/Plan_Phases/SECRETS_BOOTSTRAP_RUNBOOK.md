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

## 4. Break-glass access

- Product Owner stores the credential in a password manager and an encrypted offline recovery copy.
- Use requires a reason, timestamp and affected environment record.
- After access, review audit events, revoke suspicious sessions/tokens and rotate the break-glass credential.
- Break-glass identity is not used by CI, worker, seed scripts or routine Admin Studio access.

## 5. Prohibited evidence

Do not place passwords, keys, tokens, connection strings, decrypted SOPS content or screenshots containing them in Git, logs, issue trackers or Phase evidence.
