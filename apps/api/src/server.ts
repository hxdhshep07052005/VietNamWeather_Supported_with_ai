import { randomBytes } from "node:crypto";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { Redis } from "ioredis";
import { Pool } from "pg";

import { AuthService, type AuthenticatedSession } from "./auth-service.js";
import { createOpaqueToken, signCsrfToken, verifyCsrfSignature } from "./crypto.js";
import type { ApiConfig } from "./config.js";
import { ApiError } from "./errors.js";
import { DirectusClient, type IdentityProvider } from "./directus-client.js";
import { EmailVerificationService } from "./email-verification.js";
import { MemoryRecoveryStore, PostgresRecoveryStore, type RecoveryStore } from "./recovery-store.js";
import { PasswordRecoveryService } from "./password-recovery.js";
import { PostgresSessionStore, type SessionStore } from "./session-store.js";
import { MemoryVerificationStore, PostgresVerificationStore, type VerificationStore } from "./verification-store.js";

declare module "fastify" {
  interface FastifyRequest {
    authSession?: AuthenticatedSession;
  }
}

export interface ApiServerDependencies {
  readonly config: ApiConfig;
  readonly directus?: IdentityProvider;
  readonly sessions?: SessionStore;
  readonly recovery?: RecoveryStore;
  readonly verification?: VerificationStore;
  readonly redis?: Redis;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCredentials(value: unknown): { email: string; password: string } {
  if (!isRecord(value) || typeof value.email !== "string" || typeof value.password !== "string") {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  const email = value.email.trim().toLowerCase();
  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 320 ||
    value.password.length < 1 ||
    value.password.length > 1024
  ) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  return { email, password: value.password };
}

function readEmail(value: unknown): string {
  if (!isRecord(value) || typeof value.email !== "string") {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  const email = value.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  return email;
}

function readPasswordResetBody(value: unknown): { handle: string; password: string } {
  if (!isRecord(value) || typeof value.handle !== "string" || typeof value.password !== "string") {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  return { handle: value.handle, password: value.password };
}

function readHandleBody(value: unknown): string {
  if (!isRecord(value) || typeof value.handle !== "string") {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid request");
  }
  return value.handle;
}

function recoveryRedirect(config: ApiConfig, fragment: string): string {
  const redirect = new URL(config.passwordResetRedirectUrl.toString());
  redirect.hash = fragment;
  return redirect.toString();
}

function emailVerificationRedirect(config: ApiConfig, fragment: string): string {
  const redirect = new URL(config.emailVerificationRedirectUrl.toString());
  redirect.hash = fragment;
  return redirect.toString();
}

function correlationId(request: FastifyRequest): string {
  return request.id;
}

function contextFor(request: FastifyRequest): {
  correlationId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    correlationId: correlationId(request),
    ipAddress: request.ip,
    userAgent: typeof request.headers["user-agent"] === "string"
      ? request.headers["user-agent"]
      : undefined
  };
}

function originGuard(config: ApiConfig, request: FastifyRequest): void {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== "string" || typeof host !== "string") {
    throw new ApiError(403, "ORIGIN_REJECTED", false, "Origin rejected");
  }
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new ApiError(403, "ORIGIN_REJECTED", false, "Origin rejected");
  }
  if (!config.allowedOrigins.has(originUrl.origin)) {
    throw new ApiError(403, "ORIGIN_REJECTED", false, "Origin rejected");
  }
  const forwardedProto = config.trustProxy && typeof request.headers["x-forwarded-proto"] === "string"
    ? request.headers["x-forwarded-proto"].split(",")[0]?.trim()
    : undefined;
  const forwardedHost = config.trustProxy && typeof request.headers["x-forwarded-host"] === "string"
    ? request.headers["x-forwarded-host"].split(",")[0]?.trim()
    : undefined;
  const hostOrigin = `${forwardedProto ?? (request.protocol || originUrl.protocol.replace(":", ""))}://${forwardedHost ?? host}`;
  if (!config.allowedOrigins.has(hostOrigin) || hostOrigin !== originUrl.origin) {
    throw new ApiError(403, "ORIGIN_REJECTED", false, "Origin rejected");
  }
}

function csrfGuard(config: ApiConfig, request: FastifyRequest): void {
  const headerValue = request.headers["x-csrf-token"];
  const cookieValue = request.cookies[config.csrfCookieName];
  if (typeof headerValue !== "string" || typeof cookieValue !== "string") {
    throw new ApiError(403, "CSRF_REJECTED", false, "CSRF validation failed");
  }
  const [token, signature, extra] = cookieValue.split(".");
  if (!token || !signature || extra || token !== headerValue || !verifyCsrfSignature(token, signature, config.csrfSigningKey)) {
    throw new ApiError(403, "CSRF_REJECTED", false, "CSRF validation failed");
  }
}

function setCsrfCookie(config: ApiConfig, reply: FastifyReply): string {
  const token = createOpaqueToken(32);
  const signature = signCsrfToken(token, config.csrfSigningKey);
  reply.setCookie(config.csrfCookieName, `${token}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: config.sessionSameSite,
    path: "/"
  });
  return token;
}

function setSessionCookie(config: ApiConfig, reply: FastifyReply, handle: string): void {
  reply.setCookie(config.sessionCookieName, handle, {
    httpOnly: true,
    secure: true,
    sameSite: config.sessionSameSite,
    path: "/",
    maxAge: config.sessionTtlSeconds
  });
}

function clearAuthCookies(config: ApiConfig, reply: FastifyReply): void {
  reply.clearCookie(config.sessionCookieName, { path: "/", secure: true, httpOnly: true, sameSite: config.sessionSameSite });
  reply.clearCookie(config.csrfCookieName, { path: "/", secure: true, httpOnly: true, sameSite: config.sessionSameSite });
}

function publicError(error: unknown, request: FastifyRequest): { statusCode: number; body: object } {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          correlationId: correlationId(request),
          retryable: error.retryable
        }
      }
    };
  }
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "UNKNOWN";
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "ENOTFOUND", "NR_CLOSED"].includes(code) ||
    /max retries per request|stream isn't writeable|connection is closed|redis/i.test(errorMessage)
  ) {
    return {
      statusCode: 503,
      body: {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Required security dependency is unavailable",
          correlationId: correlationId(request),
          retryable: true
        }
      }
    };
  }
  if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return {
      statusCode: 413,
      body: {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request is too large",
          correlationId: correlationId(request),
          retryable: false
        }
      }
    };
  }
  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        correlationId: correlationId(request),
        retryable: true
      }
    }
  };
}

export async function createApiServer(dependencies: ApiServerDependencies): Promise<FastifyInstance> {
  const { config } = dependencies;
  const directus = dependencies.directus ?? new DirectusClient({ baseUrl: config.directusUrl });
  const pool = dependencies.sessions
    ? null
    : new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 10,
      application_name: config.serviceName
    });
  const sessions = dependencies.sessions ?? new PostgresSessionStore(pool as Pool);
  const ownsSessions = !dependencies.sessions;
  const recovery = dependencies.recovery ?? (ownsSessions
    ? new PostgresRecoveryStore(pool as Pool)
    : new MemoryRecoveryStore());
  const verification = dependencies.verification ?? (ownsSessions
    ? new PostgresVerificationStore(pool as Pool)
    : new MemoryVerificationStore());
  const ownsRedis = !dependencies.redis && ownsSessions;
  const redis = dependencies.redis ?? (ownsRedis
    ? new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: config.redisTimeoutMilliseconds,
      commandTimeout: config.redisTimeoutMilliseconds
    })
    : undefined);
  let redisAvailable = !redis;
  redis?.on("ready", () => { redisAvailable = true; });
  redis?.on("error", () => { redisAvailable = false; });
  redis?.on("close", () => { redisAvailable = false; });
  redis?.on("end", () => { redisAvailable = false; });

  const app = Fastify({
    bodyLimit: config.bodyLimitBytes,
    trustProxy: config.trustProxy,
    logger: config.appEnvironment === "test" ? false : {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.url",
          "req.query.token",
          "req.body.password",
          "req.body.refresh_token",
          "res.headers['set-cookie']",
          "res.headers.location"
        ],
        censor: "[REDACTED]"
      }
    },
    genReqId: () => `api_${randomBytes(12).toString("hex")}`
  });
  app.decorateRequest("authSession");

  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new ApiError(403, "ORIGIN_REJECTED", false, "Origin rejected"), false);
      }
    }
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"]
      }
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true }
  });
  app.addHook("onRequest", async (request) => {
    if (redis && !redisAvailable && !request.url.startsWith("/health/")) {
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", true, "Required security dependency is unavailable");
    }
  });
  await app.register(rateLimit, {
    global: true,
    max: config.defaultRateLimitMax,
    timeWindow: config.rateLimitWindowMilliseconds,
    ...(redis ? { redis } : {}),
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => new ApiError(
      429,
      "RATE_LIMITED",
      true,
      `Rate limit exceeded; retry after ${context.after}`
    )
  });

  const auth = new AuthService({
    directus,
    sessions,
    encryptionKey: config.sessionEncryptionKey,
    travelerRoleId: config.travelerRoleId,
    sessionTtlSeconds: config.sessionTtlSeconds,
    userSessionLimit: config.userSessionLimit,
    accessRefreshSkewMilliseconds: config.accessRefreshSkewMilliseconds
  });
  const passwordRecovery = new PasswordRecoveryService({
    directus,
    recovery,
    audit: sessions,
    encryptionKey: config.sessionEncryptionKey,
    consumeUrl: config.passwordResetConsumeUrl,
    ttlSeconds: config.passwordResetTtlSeconds,
    minimumPasswordLength: config.passwordResetMinLength
  });
  const emailVerification = new EmailVerificationService({
    directus,
    verification,
    audit: sessions,
    encryptionKey: config.sessionEncryptionKey,
    consumeUrl: config.emailVerificationConsumeUrl,
    ttlSeconds: config.emailVerificationTtlSeconds,
    minimumPasswordLength: config.registrationMinLength
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
  });
  app.setErrorHandler((error, request, reply) => {
    const result = publicError(error, request);
    reply.code(result.statusCode).send(result.body);
  });
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Not found",
        correlationId: correlationId(request),
        retryable: false
      }
    });
  });

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    request.authSession = await auth.resolve(
      request.cookies[config.sessionCookieName],
      contextFor(request)
    );
    if (request.authSession.rotated) {
      setSessionCookie(config, reply, request.authSession.handle);
    }
  };
  const requireMutationSecurity = async (request: FastifyRequest): Promise<void> => {
    originGuard(config, request);
    csrfGuard(config, request);
  };

  app.get("/health/live", { config: { rateLimit: false } }, async () => ({
    service: config.serviceName,
    status: "live",
    timestamp: new Date().toISOString()
  }));
  app.get("/health/ready", { config: { rateLimit: false } }, async (_request, reply) => {
    let redisReady = true;
    if (redis) {
      try {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
          redisReady = (await Promise.race([
            redis.ping(),
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => reject(new Error("Redis readiness timeout")), config.redisTimeoutMilliseconds);
            })
          ])) === "PONG";
          redisAvailable = redisReady;
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
      } catch {
        redisReady = false;
        redisAvailable = false;
      }
    }
    const ready = redisReady && (await sessions.ping()) && (await recovery.ping()) && (await verification.ping()) && (await directus.isReady());
    reply.code(ready ? 200 : 503);
    return {
      service: config.serviceName,
      status: ready ? "ready" : "not_ready",
      timestamp: new Date().toISOString()
    };
  });

  app.get("/api/v1/auth/csrf", async (_request, reply) => {
    const token = setCsrfCookie(config, reply);
    return { data: { csrfToken: token } };
  });
  app.post("/api/v1/auth/register", {
    config: { rateLimit: { max: config.loginRateLimitMax, timeWindow: config.rateLimitWindowMilliseconds } },
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    const credentials = readCredentials(request.body);
    await emailVerification.request(credentials.email, credentials.password, contextFor(request));
    reply.code(202).send({ data: { accepted: true } });
  });
  app.get("/api/v1/auth/verification/consume", async (request, reply) => {
    const token = isRecord(request.query) ? request.query.token : undefined;
    try {
      const handle = await emailVerification.consume(token, contextFor(request));
      reply.header("referrer-policy", "no-referrer");
      return reply.code(303).redirect(emailVerificationRedirect(config, `verification=${encodeURIComponent(handle)}`));
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "EMAIL_VERIFICATION_INVALID") throw error;
      reply.header("referrer-policy", "no-referrer");
      return reply.code(303).redirect(emailVerificationRedirect(config, "verification_error=invalid"));
    }
  });
  app.post("/api/v1/auth/verification/complete", {
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    await emailVerification.complete(readHandleBody(request.body), contextFor(request));
    reply.code(204).send();
  });
  app.post("/api/v1/auth/password/request", {
    config: { rateLimit: { max: config.loginRateLimitMax, timeWindow: config.rateLimitWindowMilliseconds } },
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    await passwordRecovery.request(readEmail(request.body), contextFor(request));
    reply.code(202).send({ data: { accepted: true } });
  });
  app.get("/api/v1/auth/password/consume", async (request, reply) => {
    const token = isRecord(request.query) ? request.query.token : undefined;
    try {
      const handle = await passwordRecovery.consume(token, contextFor(request));
      reply.header("referrer-policy", "no-referrer");
      return reply.code(303).redirect(recoveryRedirect(config, `recovery=${encodeURIComponent(handle)}`));
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "PASSWORD_RESET_INVALID") throw error;
      reply.header("referrer-policy", "no-referrer");
      return reply.code(303).redirect(recoveryRedirect(config, "recovery_error=invalid"));
    }
  });
  app.post("/api/v1/auth/password/reset", {
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    const body = readPasswordResetBody(request.body);
    await passwordRecovery.reset(body.handle, body.password, contextFor(request));
    reply.code(204).send();
  });
  app.post("/api/v1/auth/login", {
    config: { rateLimit: { max: config.loginRateLimitMax, timeWindow: config.rateLimitWindowMilliseconds } },
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    const credentials = readCredentials(request.body);
    const session = await auth.login(credentials.email, credentials.password, contextFor(request));
    setSessionCookie(config, reply, session.handle);
    const csrfToken = setCsrfCookie(config, reply);
    return { data: { user: session.user, csrfToken } };
  });
  app.post("/api/v1/auth/refresh", {
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    const currentHandle = request.cookies[config.sessionCookieName];
    const session = await auth.resolve(currentHandle, contextFor(request), true);
    setSessionCookie(config, reply, session.handle);
    const csrfToken = setCsrfCookie(config, reply);
    return { data: { user: session.user, csrfToken } };
  });
  app.post("/api/v1/auth/logout", {
    preHandler: requireMutationSecurity
  }, async (request, reply) => {
    await auth.logout(request.cookies[config.sessionCookieName], contextFor(request));
    clearAuthCookies(config, reply);
    reply.code(204).send();
  });
  app.get("/api/v1/auth/me", { preHandler: requireAuth }, async (request) => ({
    data: { user: request.authSession?.user }
  }));

  app.addHook("onClose", async () => {
    await recovery.close();
    await verification.close();
    if (ownsSessions) await sessions.close();
    if (ownsRedis && redis) await redis.quit().catch(() => undefined);
  });
  return app;
}
