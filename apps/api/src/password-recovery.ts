import {
  createOpaqueToken,
  decryptSecret,
  encryptSecret,
  hashOpaqueToken,
  hashOptionalValue
} from "./crypto.js";
import type { AuthRequestContext } from "./auth-service.js";
import type { IdentityProvider } from "./directus-client.js";
import { ApiError } from "./errors.js";
import type { RecoveryStore } from "./recovery-store.js";
import type { SecurityAuditEvent, SessionStore } from "./session-store.js";

export interface PasswordRecoveryOptions {
  readonly directus: IdentityProvider;
  readonly recovery: RecoveryStore;
  readonly audit: SessionStore;
  readonly encryptionKey: Buffer;
  readonly consumeUrl: URL;
  readonly ttlSeconds: number;
  readonly minimumPasswordLength: number;
  readonly now?: () => Date;
}

function auditHashes(context: AuthRequestContext): Pick<SecurityAuditEvent, "ipAddressHash" | "userAgentHash"> {
  return {
    ipAddressHash: hashOptionalValue(context.ipAddress),
    userAgentHash: hashOptionalValue(context.userAgent)
  };
}

function requireRecoveryToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 1024) {
    throw new ApiError(400, "PASSWORD_RESET_INVALID", false, "Password reset link is invalid or expired");
  }
  return value;
}

export class PasswordRecoveryService {
  private readonly now: () => Date;

  constructor(private readonly options: PasswordRecoveryOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async request(email: string, context: AuthRequestContext): Promise<void> {
    try {
      await this.options.directus.requestPasswordReset(email, this.options.consumeUrl.toString());
      await this.recordAudit({
        eventType: "auth.password_reset.requested",
        result: "success",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: null,
        ...auditHashes(context)
      });
    } catch (error) {
      await this.recordAudit({
        eventType: "auth.password_reset.requested",
        result: "error",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: error instanceof ApiError ? error.code : "UPSTREAM_UNAVAILABLE",
        ...auditHashes(context)
      });
      throw error;
    }
  }

  async consume(resetToken: unknown, context: AuthRequestContext): Promise<string> {
    const token = requireRecoveryToken(resetToken);
    const now = this.now();
    const handle = createOpaqueToken(32);
    await this.options.recovery.create({
      recoveryHandleHash: hashOpaqueToken(handle),
      directusResetTokenCiphertext: encryptSecret(token, this.options.encryptionKey),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.options.ttlSeconds * 1_000)
    });
    await this.recordAudit({
      eventType: "auth.password_reset.consumed_link",
      result: "success",
      actorUserId: null,
      sessionFamilyId: null,
      correlationId: context.correlationId,
      reasonCode: null,
      ...auditHashes(context)
    });
    return handle;
  }

  async reset(handleValue: unknown, password: unknown, context: AuthRequestContext): Promise<void> {
    if (typeof handleValue !== "string" || handleValue.length < 16 || handleValue.length > 512) {
      throw new ApiError(400, "PASSWORD_RESET_INVALID", false, "Password reset link is invalid or expired");
    }
    if (typeof password !== "string" || password.length < this.options.minimumPasswordLength || password.length > 1024) {
      throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
    }

    const token = await this.options.recovery.consume(hashOpaqueToken(handleValue), this.now());
    if (!token) {
      throw new ApiError(400, "PASSWORD_RESET_INVALID", false, "Password reset link is invalid or expired");
    }

    try {
      const resetToken = decryptSecret(token.directusResetTokenCiphertext, this.options.encryptionKey);
      await this.options.directus.resetPassword(resetToken, password);
      await this.recordAudit({
        eventType: "auth.password_reset.completed",
        result: "success",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: null,
        ...auditHashes(context)
      });
    } catch (error) {
      await this.recordAudit({
        eventType: "auth.password_reset.completed",
        result: "denied",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: error instanceof ApiError ? error.code : "PASSWORD_RESET_INVALID",
        ...auditHashes(context)
      });
      if (error instanceof ApiError && error.code === "UPSTREAM_UNAVAILABLE") throw error;
      throw new ApiError(400, "PASSWORD_RESET_INVALID", false, "Password reset link is invalid or expired");
    }
  }

  private async recordAudit(event: SecurityAuditEvent): Promise<void> {
    try {
      await this.options.audit.recordAudit(event);
    } catch {
      // Reset correctness does not depend on audit availability; the token remains single-use.
    }
  }
}
