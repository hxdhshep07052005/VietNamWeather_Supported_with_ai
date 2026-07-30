# Secret Material Boundary

Only encrypted deployment material and non-secret documentation may be committed here. Plaintext/decrypted output belongs under `secrets/decrypted/`, which is Git-ignored.

The SOPS age recipient is environment-owner data and must not be invented or committed as a placeholder production recipient. Phase 13 records the real production recipient fingerprint and recovery ownership before deployment.
