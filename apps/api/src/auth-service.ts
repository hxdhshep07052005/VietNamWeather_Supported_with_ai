import { randomUUID } from "node:crypto";

import {
  createOpaqueToken,
  decryptSecret,
  encryptSecret,
  hashOpaqueToken,
  hashOptionalValue
} from "./crypto.js";
import type {
  DirectusTokenBundle,
  DirectusUser,
  IdentityProvider
} from "./directus-client.js";
import { ApiError } from "./errors.js";
import type {
  SecurityAuditEvent,
  SessionStore,
  StoredSession
} from "./session-store.js";

export interface PublicUserDto {
  readonly id: string;
}

export interface AuthRequestContext {
  readonly correlationId: string;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

export interface AuthenticatedSession {
  readonly handle: string;
  readonly rotated: boolean;
  readonly user: PublicUserDto;
}

interface AuthServiceOptions {
  readonly directus: IdentityProvider;
  readonly sessions: SessionStore;
  readonly encryptionKey: Buffer;
  readonly travelerRoleId: string;
  readonly sessionTtlSeconds: number;
  readonly userSessionLimit: number;
  readonly accessRefreshSkewMilliseconds: number;
  readonly now?: () => Date;
}

export class AuthService {
  private readonly now: () => Date;

  constructor(private readonly options: AuthServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async login(
    email: string,
    password: string,
    context: AuthRequestContext
  ): Promise<AuthenticatedSession> {
    let tokens: DirectusTokenBundle;
    let user: DirectusUser;
    try {
      tokens = await this.options.directus.login(email, password);
      user = await this.options.directus.getCurrentUser(tokens.accessToken);
      this.assertProductUser(user);
    } catch (error) {
      await this.audit({
        eventType: "auth.login",
        result: error instanceof ApiError && error.code === "UPSTREAM_UNAVAILABLE" ? "error" : "denied",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: error instanceof ApiError ? error.code : "AUTHENTICATION_FAILED",
        ...this.auditHashes(context)
      });
      throw error;
    }

    const now = this.now();
    const handle = createOpaqueToken();
    const familyId = randomUUID();
    try {
      await this.options.sessions.create({
        sessionIdHash: hashOpaqueToken(handle),
        sessionFamilyId: familyId,
        userId: user.id,
        roleId: user.roleId,
        directusAccessTokenCiphertext: encryptSecret(tokens.accessToken, this.options.encryptionKey),
        directusRefreshTokenCiphertext: encryptSecret(tokens.refreshToken, this.options.encryptionKey),
        accessTokenExpiresAt: new Date(now.getTime() + tokens.expiresInMilliseconds),
        createdAt: now,
        expiresAt: new Date(now.getTime() + this.options.sessionTtlSeconds * 1_000),
        rotationCounter: 0,
        userAgentHash: hashOptionalValue(context.userAgent),
        ipAddressHash: hashOptionalValue(context.ipAddress)
      }, this.options.userSessionLimit);
    } catch (error) {
      await this.options.directus.logout(tokens.refreshToken).catch(() => undefined);
      await this.audit({
        eventType: "auth.login",
        result: "denied",
        actorUserId: user.id,
        sessionFamilyId: familyId,
        correlationId: context.correlationId,
        reasonCode: error instanceof ApiError ? error.code : "SESSION_REVOKED",
        ...this.auditHashes(context)
      });
      throw error;
    }

    await this.audit({
      eventType: "auth.login",
      result: "success",
      actorUserId: user.id,
      sessionFamilyId: familyId,
      correlationId: context.correlationId,
      reasonCode: null,
      ...this.auditHashes(context)
    });
    return { handle, rotated: true, user: this.toPublicUser(user) };
  }

  async resolve(
    handle: string | undefined,
    context: AuthRequestContext,
    forceRefresh = false
  ): Promise<AuthenticatedSession> {
    if (!handle) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "Authentication required");
    }
    const now = this.now();
    const sessionHash = hashOpaqueToken(handle);
    const session = await this.options.sessions.findActive(sessionHash, now);
    if (!session) {
      throw new ApiError(401, "SESSION_REVOKED", false, "Session is invalid");
    }
    if (
      forceRefresh ||
      session.accessTokenExpiresAt.getTime() <= now.getTime() + this.options.accessRefreshSkewMilliseconds
    ) {
      return this.refreshSession(handle, session, context);
    }

    try {
      const accessToken = decryptSecret(
        session.directusAccessTokenCiphertext,
        this.options.encryptionKey
      );
      const user = await this.options.directus.getCurrentUser(accessToken);
      this.assertSessionUser(session, user);
      await this.options.sessions.touch(sessionHash, now);
      return { handle, rotated: false, user: this.toPublicUser(user) };
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_FAILED") {
        return this.refreshSession(handle, session, context);
      }
      await this.revokeFailedSession(session, sessionHash, context, error);
      throw error;
    }
  }

  async logout(
    handle: string | undefined,
    context: AuthRequestContext
  ): Promise<void> {
    if (!handle) return;
    const now = this.now();
    const sessionHash = hashOpaqueToken(handle);
    const session = await this.options.sessions.findActive(sessionHash, now);
    if (!session) return;
    await this.options.sessions.revoke(sessionHash, "user_logout", now);
    try {
      const refreshToken = decryptSecret(
        session.directusRefreshTokenCiphertext,
        this.options.encryptionKey
      );
      await this.options.directus.logout(refreshToken).catch(() => undefined);
    } catch {
      // Local revocation remains authoritative when upstream logout is unavailable.
    }
    await this.audit({
      eventType: "auth.logout",
      result: "success",
      actorUserId: session.userId,
      sessionFamilyId: session.sessionFamilyId,
      correlationId: context.correlationId,
      reasonCode: "user_logout",
      ...this.auditHashes(context)
    });
  }

  private async refreshSession(
    currentHandle: string,
    session: StoredSession,
    context: AuthRequestContext
  ): Promise<AuthenticatedSession> {
    const now = this.now();
    const currentHash = hashOpaqueToken(currentHandle);
    try {
      const refreshToken = decryptSecret(
        session.directusRefreshTokenCiphertext,
        this.options.encryptionKey
      );
      const tokens = await this.options.directus.refresh(refreshToken);
      const user = await this.options.directus.getCurrentUser(tokens.accessToken);
      this.assertSessionUser(session, user);
      const nextHandle = createOpaqueToken();
      const rotated = await this.options.sessions.rotate({
        currentSessionIdHash: currentHash,
        nextSessionIdHash: hashOpaqueToken(nextHandle),
        directusAccessTokenCiphertext: encryptSecret(tokens.accessToken, this.options.encryptionKey),
        directusRefreshTokenCiphertext: encryptSecret(tokens.refreshToken, this.options.encryptionKey),
        accessTokenExpiresAt: new Date(now.getTime() + tokens.expiresInMilliseconds),
        lastSeenAt: now
      });
      if (!rotated) {
        throw new ApiError(401, "SESSION_REVOKED", false, "Session is invalid");
      }
      await this.audit({
        eventType: "auth.refresh",
        result: "success",
        actorUserId: session.userId,
        sessionFamilyId: session.sessionFamilyId,
        correlationId: context.correlationId,
        reasonCode: null,
        ...this.auditHashes(context)
      });
      return { handle: nextHandle, rotated: true, user: this.toPublicUser(user) };
    } catch (error) {
      await this.revokeFailedSession(session, currentHash, context, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, "SESSION_REVOKED", false, "Session is invalid");
    }
  }

  private assertProductUser(user: DirectusUser): void {
    if (user.roleId !== this.options.travelerRoleId) {
      throw new ApiError(403, "ROLE_NOT_ALLOWED", false, "Role is not allowed");
    }
  }

  private assertSessionUser(session: StoredSession, user: DirectusUser): void {
    this.assertProductUser(user);
    if (session.userId !== user.id || session.roleId !== user.roleId) {
      throw new ApiError(401, "SESSION_REVOKED", false, "Session is invalid");
    }
  }

  private async revokeFailedSession(
    session: StoredSession,
    sessionHash: string,
    context: AuthRequestContext,
    error: unknown
  ): Promise<void> {
    await this.options.sessions.revokeFamily(
      session.sessionFamilyId,
      "identity_revalidation_failed",
      this.now()
    );
    await this.audit({
      eventType: "auth.session_revalidation",
      result: "denied",
      actorUserId: session.userId,
      sessionFamilyId: session.sessionFamilyId,
      correlationId: context.correlationId,
      reasonCode: error instanceof ApiError ? error.code : "SESSION_REVOKED",
      ...this.auditHashes(context)
    });
    await this.options.sessions.revoke(sessionHash, "identity_revalidation_failed", this.now());
  }

  private auditHashes(context: AuthRequestContext): Pick<
    SecurityAuditEvent,
    "ipAddressHash" | "userAgentHash"
  > {
    return {
      ipAddressHash: hashOptionalValue(context.ipAddress),
      userAgentHash: hashOptionalValue(context.userAgent)
    };
  }

  private async audit(event: SecurityAuditEvent): Promise<void> {
    try {
      await this.options.sessions.recordAudit(event);
    } catch {
      // Authentication remains fail-closed; sanitized process logs still carry the correlation ID.
    }
  }

  private toPublicUser(user: DirectusUser): PublicUserDto {
    return { id: user.id };
  }
}
