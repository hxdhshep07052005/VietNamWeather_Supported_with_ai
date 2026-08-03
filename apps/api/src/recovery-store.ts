import type { Pool, QueryResultRow } from "pg";

export interface NewRecoveryToken {
  readonly recoveryHandleHash: string;
  readonly directusResetTokenCiphertext: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface StoredRecoveryToken {
  readonly recoveryHandleHash: string;
  readonly directusResetTokenCiphertext: string;
  readonly expiresAt: Date;
}

export interface RecoveryStore {
  create(token: NewRecoveryToken): Promise<void>;
  consume(recoveryHandleHash: string, consumedAt: Date): Promise<StoredRecoveryToken | null>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

interface RecoveryTokenRow extends QueryResultRow {
  recovery_handle_hash: string;
  directus_reset_token_ciphertext: string;
  expires_at: Date;
}

function mapRecoveryToken(row: RecoveryTokenRow): StoredRecoveryToken {
  return {
    recoveryHandleHash: row.recovery_handle_hash,
    directusResetTokenCiphertext: row.directus_reset_token_ciphertext,
    expiresAt: new Date(row.expires_at)
  };
}

export class PostgresRecoveryStore implements RecoveryStore {
  constructor(private readonly pool: Pool) {}

  async create(token: NewRecoveryToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_security.password_recovery_tokens (
         recovery_handle_hash, directus_reset_token_ciphertext, created_at, expires_at
       ) VALUES ($1, $2, $3, $4)`,
      [
        token.recoveryHandleHash,
        token.directusResetTokenCiphertext,
        token.createdAt,
        token.expiresAt
      ]
    );
  }

  async consume(recoveryHandleHash: string, consumedAt: Date): Promise<StoredRecoveryToken | null> {
    const result = await this.pool.query<RecoveryTokenRow>(
      `UPDATE app_security.password_recovery_tokens
          SET consumed_at = $2
        WHERE recovery_handle_hash = $1
          AND consumed_at IS NULL
          AND expires_at > $2
      RETURNING recovery_handle_hash, directus_reset_token_ciphertext, expires_at`,
      [recoveryHandleHash, consumedAt]
    );
    return result.rows[0] ? mapRecoveryToken(result.rows[0]) : null;
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1 FROM app_security.password_recovery_tokens LIMIT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // The session store owns the shared pool.
  }
}

export class MemoryRecoveryStore implements RecoveryStore {
  readonly tokens = new Map<string, StoredRecoveryToken & { consumedAt: Date | null }>();

  async create(token: NewRecoveryToken): Promise<void> {
    this.tokens.set(token.recoveryHandleHash, { ...token, consumedAt: null });
  }

  async consume(recoveryHandleHash: string, consumedAt: Date): Promise<StoredRecoveryToken | null> {
    const token = this.tokens.get(recoveryHandleHash);
    if (!token || token.consumedAt || token.expiresAt <= consumedAt) return null;
    token.consumedAt = consumedAt;
    return {
      recoveryHandleHash: token.recoveryHandleHash,
      directusResetTokenCiphertext: token.directusResetTokenCiphertext,
      expiresAt: token.expiresAt
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}
