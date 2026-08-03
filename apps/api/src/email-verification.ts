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
import type { SessionStore, SecurityAuditEvent } from "./session-store.js";
import type { VerificationStore } from "./verification-store.js";

export interface EmailVerificationOptions {
  readonly directus: IdentityProvider;
  readonly verification: VerificationStore;
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

function requireVerificationToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 4096) {
    throw new ApiError(400, "EMAIL_VERIFICATION_INVALID", false, "Email verification link is invalid or expired");
  }
  return value;
}

export class EmailVerificationService {
  private readonly now: () => Date;

  constructor(private readonly options: EmailVerificationOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async request(email: string, password: string, context: AuthRequestContext): Promise<void> {
    if (password.length < this.options.minimumPasswordLength || password.length > 1024) {
      throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
    }
    try {
      await this.options.directus.register(email, password, this.options.consumeUrl.toString());
      await this.recordAudit({
        eventType: "auth.email_verification.requested",
        result: "success",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: null,
        ...auditHashes(context)
      });
    } catch (error) {
      await this.recordAudit({
        eventType: "auth.email_verification.requested",
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

  async consume(verificationToken: unknown, context: AuthRequestContext): Promise<string> {
    const token = requireVerificationToken(verificationToken);
    const now = this.now();
    const handle = createOpaqueToken(32);
    await this.options.verification.create({
      verificationHandleHash: hashOpaqueToken(handle),
      directusVerificationTokenCiphertext: encryptSecret(token, this.options.encryptionKey),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.options.ttlSeconds * 1_000)
    });
    await this.recordAudit({
      eventType: "auth.email_verification.consumed_link",
      result: "success",
      actorUserId: null,
      sessionFamilyId: null,
      correlationId: context.correlationId,
      reasonCode: null,
      ...auditHashes(context)
    });
    return handle;
  }

  async complete(handleValue: unknown, context: AuthRequestContext): Promise<void> {
    if (typeof handleValue !== "string" || handleValue.length < 16 || handleValue.length > 512) {
      throw new ApiError(400, "EMAIL_VERIFICATION_INVALID", false, "Email verification link is invalid or expired");
    }
    const token = await this.options.verification.consume(hashOpaqueToken(handleValue), this.now());
    if (!token) {
      throw new ApiError(400, "EMAIL_VERIFICATION_INVALID", false, "Email verification link is invalid or expired");
    }

    try {
      const directusToken = decryptSecret(token.directusVerificationTokenCiphertext, this.options.encryptionKey);
      await this.options.directus.verifyRegistration(directusToken);
      await this.recordAudit({
        eventType: "auth.email_verification.completed",
        result: "success",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: null,
        ...auditHashes(context)
      });
    } catch (error) {
      await this.recordAudit({
        eventType: "auth.email_verification.completed",
        result: "denied",
        actorUserId: null,
        sessionFamilyId: null,
        correlationId: context.correlationId,
        reasonCode: error instanceof ApiError ? error.code : "EMAIL_VERIFICATION_INVALID",
        ...auditHashes(context)
      });
      if (error instanceof ApiError && error.code === "UPSTREAM_UNAVAILABLE") throw error;
      throw new ApiError(400, "EMAIL_VERIFICATION_INVALID", false, "Email verification link is invalid or expired");
    }
  }

  private async recordAudit(event: SecurityAuditEvent): Promise<void> {
    try {
      await this.options.audit.recordAudit(event);
    } catch {
      // Verification correctness does not depend on audit availability.
    }
  }
}
