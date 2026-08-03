import type { Pool, QueryResultRow } from "pg";

export interface NewVerificationToken {
  readonly verificationHandleHash: string;
  readonly directusVerificationTokenCiphertext: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface StoredVerificationToken {
  readonly verificationHandleHash: string;
  readonly directusVerificationTokenCiphertext: string;
  readonly expiresAt: Date;
}

export interface VerificationStore {
  create(token: NewVerificationToken): Promise<void>;
  consume(handleHash: string, consumedAt: Date): Promise<StoredVerificationToken | null>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

interface VerificationTokenRow extends QueryResultRow {
  verification_handle_hash: string;
  directus_verification_token_ciphertext: string;
  expires_at: Date;
}

function mapToken(row: VerificationTokenRow): StoredVerificationToken {
  return {
    verificationHandleHash: row.verification_handle_hash,
    directusVerificationTokenCiphertext: row.directus_verification_token_ciphertext,
    expiresAt: new Date(row.expires_at)
  };
}

export class PostgresVerificationStore implements VerificationStore {
  constructor(private readonly pool: Pool) {}

  async create(token: NewVerificationToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_security.email_verification_tokens (
         verification_handle_hash, directus_verification_token_ciphertext, created_at, expires_at
       ) VALUES ($1, $2, $3, $4)`,
      [
        token.verificationHandleHash,
        token.directusVerificationTokenCiphertext,
        token.createdAt,
        token.expiresAt
      ]
    );
  }

  async consume(handleHash: string, consumedAt: Date): Promise<StoredVerificationToken | null> {
    const result = await this.pool.query<VerificationTokenRow>(
      `UPDATE app_security.email_verification_tokens
          SET consumed_at = $2
        WHERE verification_handle_hash = $1
          AND consumed_at IS NULL
          AND expires_at > $2
      RETURNING verification_handle_hash, directus_verification_token_ciphertext, expires_at`,
      [handleHash, consumedAt]
    );
    return result.rows[0] ? mapToken(result.rows[0]) : null;
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1 FROM app_security.email_verification_tokens LIMIT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // The session store owns the shared pool.
  }
}

export class MemoryVerificationStore implements VerificationStore {
  readonly tokens = new Map<string, StoredVerificationToken & { consumedAt: Date | null }>();

  async create(token: NewVerificationToken): Promise<void> {
    this.tokens.set(token.verificationHandleHash, { ...token, consumedAt: null });
  }

  async consume(handleHash: string, consumedAt: Date): Promise<StoredVerificationToken | null> {
    const token = this.tokens.get(handleHash);
    if (!token || token.consumedAt || token.expiresAt <= consumedAt) return null;
    token.consumedAt = consumedAt;
    return {
      verificationHandleHash: token.verificationHandleHash,
      directusVerificationTokenCiphertext: token.directusVerificationTokenCiphertext,
      expiresAt: token.expiresAt
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}
