import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { decryptSecret, encryptSecret } from "./crypto.js";

interface CiphertextRow extends QueryResultRow {
  readonly record_id: string;
  readonly first_ciphertext: string;
  readonly second_ciphertext: string | null;
}

interface RotationTarget {
  readonly table: string;
  readonly idColumn: string;
  readonly firstColumn: string;
  readonly secondColumn?: string;
}

const TARGETS: readonly RotationTarget[] = [
  {
    table: "app_security.sessions",
    idColumn: "session_id_hash",
    firstColumn: "directus_access_token_ciphertext",
    secondColumn: "directus_refresh_token_ciphertext"
  },
  {
    table: "app_security.password_recovery_tokens",
    idColumn: "recovery_handle_hash",
    firstColumn: "directus_reset_token_ciphertext"
  },
  {
    table: "app_security.email_verification_tokens",
    idColumn: "verification_handle_hash",
    firstColumn: "directus_verification_token_ciphertext"
  }
];

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireKey(name: string): Buffer {
  const value = requireEnvironment(name);
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid base64url key: ${name}`);
  }
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error(`Key must decode to 32 bytes: ${name}`);
  return key;
}

function requirePort(name: string): number {
  const value = Number(requireEnvironment(name));
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid port environment variable: ${name}`);
  }
  return value;
}

function selectSql(target: RotationTarget): string {
  const second = target.secondColumn ? `${target.secondColumn} AS second_ciphertext` : "NULL::text AS second_ciphertext";
  return `SELECT ${target.idColumn}::text AS record_id, ${target.firstColumn} AS first_ciphertext, ${second}
            FROM ${target.table}
           ORDER BY ${target.idColumn}
             FOR UPDATE`;
}

function updateSql(target: RotationTarget): string {
  if (target.secondColumn) {
    return `UPDATE ${target.table}
               SET ${target.firstColumn} = $2, ${target.secondColumn} = $3
             WHERE ${target.idColumn} = $1`;
  }
  return `UPDATE ${target.table}
             SET ${target.firstColumn} = $2
           WHERE ${target.idColumn} = $1`;
}

function rotateCiphertext(ciphertext: string, currentKey: Buffer, nextKey: Buffer): string {
  const plaintext = decryptSecret(ciphertext, currentKey);
  const rotated = encryptSecret(plaintext, nextKey);
  if (decryptSecret(rotated, nextKey) !== plaintext) {
    throw new Error("Rotated ciphertext verification failed");
  }
  return rotated;
}

async function rotateTarget(
  client: PoolClient,
  target: RotationTarget,
  currentKey: Buffer,
  nextKey: Buffer
): Promise<number> {
  const result = await client.query<CiphertextRow>(selectSql(target));
  const statement = updateSql(target);
  for (const row of result.rows) {
    const first = rotateCiphertext(row.first_ciphertext, currentKey, nextKey);
    if (target.secondColumn) {
      if (!row.second_ciphertext) throw new Error(`Missing secondary ciphertext in ${target.table}`);
      const second = rotateCiphertext(row.second_ciphertext, currentKey, nextKey);
      await client.query(statement, [row.record_id, first, second]);
    } else {
      await client.query(statement, [row.record_id, first]);
    }
  }
  return result.rowCount ?? 0;
}

async function main(): Promise<void> {
  const currentKey = requireKey("API_SESSION_ENCRYPTION_KEY");
  const nextKey = requireKey("API_SESSION_ENCRYPTION_KEY_NEXT");
  if (currentKey.equals(nextKey)) throw new Error("Current and next encryption keys must differ");

  const rollbackOnly = process.argv.includes("--rollback");
  const pool = new Pool({
    host: requireEnvironment("DB_HOST"),
    port: requirePort("DB_PORT"),
    database: requireEnvironment("DB_DATABASE"),
    user: requireEnvironment("API_DB_USER"),
    password: requireEnvironment("API_DB_PASSWORD"),
    max: 1,
    application_name: "application-api-key-rotation"
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE app_security.sessions, app_security.password_recovery_tokens, app_security.email_verification_tokens IN ACCESS EXCLUSIVE MODE"
    );
    const counts: number[] = [];
    for (const target of TARGETS) {
      counts.push(await rotateTarget(client, target, currentKey, nextKey));
    }
    await client.query(rollbackOnly ? "ROLLBACK" : "COMMIT");
    const mode = rollbackOnly ? "rollback" : "apply";
    process.stdout.write(
      `API_ENCRYPTION_KEY_ROTATION_OK mode=${mode} sessions=${counts[0]} recovery_tokens=${counts[1]} verification_tokens=${counts[2]} secrets_printed=false\n`
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original rotation failure.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown encryption-key rotation failure";
  process.stderr.write(`API_ENCRYPTION_KEY_ROTATION_FAILED ${message}\n`);
  process.exitCode = 1;
});
