import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const ENCRYPTION_VERSION = "v1";

export function createOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashOptionalValue(value: string | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function encryptSecret(value: string, key: Buffer): string {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const authenticationTag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

export function decryptSecret(value: string, key: Buffer): string {
  const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
  if (
    version !== ENCRYPTION_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error("Unsupported encrypted secret envelope");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function signCsrfToken(token: string, key: Buffer): string {
  return createHmac("sha256", key).update(token, "utf8").digest("base64url");
}

export function verifyCsrfSignature(
  token: string,
  signature: string,
  key: Buffer
): boolean {
  const expected = Buffer.from(signCsrfToken(token, key), "utf8");
  const actual = Buffer.from(signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
