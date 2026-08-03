import type { Pool, PoolClient, QueryResultRow } from "pg";

import { ApiError } from "./errors.js";

export interface StoredSession {
  readonly sessionIdHash: string;
  readonly sessionFamilyId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly directusAccessTokenCiphertext: string;
  readonly directusRefreshTokenCiphertext: string;
  readonly accessTokenExpiresAt: Date;
  readonly expiresAt: Date;
  readonly rotationCounter: number;
}

export interface NewSession extends StoredSession {
  readonly createdAt: Date;
  readonly userAgentHash: string | null;
  readonly ipAddressHash: string | null;
}

export interface SessionRotation {
  readonly currentSessionIdHash: string;
  readonly nextSessionIdHash: string;
  readonly directusAccessTokenCiphertext: string;
  readonly directusRefreshTokenCiphertext: string;
  readonly accessTokenExpiresAt: Date;
  readonly lastSeenAt: Date;
}

export interface SecurityAuditEvent {
  readonly eventType: string;
  readonly result: "success" | "denied" | "error";
  readonly actorUserId: string | null;
  readonly sessionFamilyId: string | null;
  readonly correlationId: string;
  readonly reasonCode: string | null;
  readonly ipAddressHash: string | null;
  readonly userAgentHash: string | null;
}

export interface SessionStore {
  create(session: NewSession, concurrencyLimit: number): Promise<void>;
  findActive(sessionIdHash: string, now: Date): Promise<StoredSession | null>;
  rotate(rotation: SessionRotation): Promise<StoredSession | null>;
  touch(sessionIdHash: string, lastSeenAt: Date): Promise<void>;
  revoke(sessionIdHash: string, reason: string, revokedAt: Date): Promise<boolean>;
  revokeFamily(sessionFamilyId: string, reason: string, revokedAt: Date): Promise<number>;
  recordAudit(event: SecurityAuditEvent): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

interface SessionRow extends QueryResultRow {
  session_id_hash: string;
  session_family_id: string;
  user_id: string;
  role_id: string;
  directus_access_token_ciphertext: string;
  directus_refresh_token_ciphertext: string;
  access_token_expires_at: Date;
  expires_at: Date;
  rotation_counter: number;
}

function mapSession(row: SessionRow): StoredSession {
  return {
    sessionIdHash: row.session_id_hash,
    sessionFamilyId: row.session_family_id,
    userId: row.user_id,
    roleId: row.role_id,
    directusAccessTokenCiphertext: row.directus_access_token_ciphertext,
    directusRefreshTokenCiphertext: row.directus_refresh_token_ciphertext,
    accessTokenExpiresAt: new Date(row.access_token_expires_at),
    expiresAt: new Date(row.expires_at),
    rotationCounter: row.rotation_counter
  };
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  async create(session: NewSession, concurrencyLimit: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [session.userId]
      );
      const count = await client.query<{ active_count: string }>(
        `SELECT COUNT(*)::text AS active_count
           FROM app_security.sessions
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND expires_at > $2`,
        [session.userId, session.createdAt]
      );
      if (Number(count.rows[0]?.active_count ?? 0) >= concurrencyLimit) {
        throw new ApiError(409, "SESSION_LIMIT_REACHED", false, "Session limit reached");
      }
      await client.query(
        `INSERT INTO app_security.sessions (
           session_id_hash, session_family_id, user_id, role_id,
           directus_access_token_ciphertext, directus_refresh_token_ciphertext,
           access_token_expires_at, created_at, last_seen_at, expires_at,
           rotation_counter, user_agent_hash, ip_address_hash
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12)`,
        [
          session.sessionIdHash,
          session.sessionFamilyId,
          session.userId,
          session.roleId,
          session.directusAccessTokenCiphertext,
          session.directusRefreshTokenCiphertext,
          session.accessTokenExpiresAt,
          session.createdAt,
          session.expiresAt,
          session.rotationCounter,
          session.userAgentHash,
          session.ipAddressHash
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async findActive(sessionIdHash: string, now: Date): Promise<StoredSession | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT session_id_hash, session_family_id, user_id, role_id,
              directus_access_token_ciphertext, directus_refresh_token_ciphertext,
              access_token_expires_at, expires_at, rotation_counter
         FROM app_security.sessions
        WHERE session_id_hash = $1
          AND revoked_at IS NULL
          AND expires_at > $2`,
      [sessionIdHash, now]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async rotate(rotation: SessionRotation): Promise<StoredSession | null> {
    const result = await this.pool.query<SessionRow>(
      `UPDATE app_security.sessions
          SET session_id_hash = $2,
              rotated_from_hash = $1,
              directus_access_token_ciphertext = $3,
              directus_refresh_token_ciphertext = $4,
              access_token_expires_at = $5,
              last_seen_at = $6,
              rotation_counter = rotation_counter + 1
        WHERE session_id_hash = $1
          AND revoked_at IS NULL
          AND expires_at > $6
      RETURNING session_id_hash, session_family_id, user_id, role_id,
                directus_access_token_ciphertext, directus_refresh_token_ciphertext,
                access_token_expires_at, expires_at, rotation_counter`,
      [
        rotation.currentSessionIdHash,
        rotation.nextSessionIdHash,
        rotation.directusAccessTokenCiphertext,
        rotation.directusRefreshTokenCiphertext,
        rotation.accessTokenExpiresAt,
        rotation.lastSeenAt
      ]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async touch(sessionIdHash: string, lastSeenAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE app_security.sessions
          SET last_seen_at = $2
        WHERE session_id_hash = $1
          AND revoked_at IS NULL
          AND expires_at > $2`,
      [sessionIdHash, lastSeenAt]
    );
  }

  async revoke(sessionIdHash: string, reason: string, revokedAt: Date): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE app_security.sessions
          SET revoked_at = $2, revoke_reason = $3
        WHERE session_id_hash = $1
          AND revoked_at IS NULL`,
      [sessionIdHash, revokedAt, reason]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async revokeFamily(sessionFamilyId: string, reason: string, revokedAt: Date): Promise<number> {
    const result = await this.pool.query(
      `UPDATE app_security.sessions
          SET revoked_at = $2, revoke_reason = $3
        WHERE session_family_id = $1
          AND revoked_at IS NULL`,
      [sessionFamilyId, revokedAt, reason]
    );
    return result.rowCount ?? 0;
  }

  async recordAudit(event: SecurityAuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_security.audit_events (
         event_type, result, actor_user_id, session_family_id, correlation_id,
         reason_code, ip_address_hash, user_agent_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.eventType,
        event.result,
        event.actorUserId,
        event.sessionFamilyId,
        event.correlationId,
        event.reasonCode,
        event.ipAddressHash,
        event.userAgentHash
      ]
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1 FROM app_security.sessions LIMIT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
