import { createHash } from "node:crypto";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Checksum input must contain only finite numbers.");
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record).sort().map((key) => {
      if (record[key] === undefined) {
        throw new TypeError("Checksum input must not contain undefined values.");
      }
      return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
    });
    return `{${entries.join(",")}}`;
  }

  throw new TypeError("Checksum input contains an unsupported value.");
}

export function calculateNormalizedPayloadChecksum(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
