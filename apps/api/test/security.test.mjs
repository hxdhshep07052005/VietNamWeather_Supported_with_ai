import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../dist/errors.js";
import { createApiServer } from "../dist/server.js";
import { MemoryVerificationStore } from "../dist/verification-store.js";

const ORIGIN = "http://localhost:8080";
const TRAVELER_ROLE_ID = "03b314c5-30b7-475d-a626-3b291a7fabc2";

class MemorySessionStore {
  sessions = new Map();
  audits = [];

  async create(session, concurrencyLimit) {
    const active = [...this.sessions.values()].filter((entry) =>
      entry.userId === session.userId && !entry.revokedAt && entry.expiresAt > session.createdAt
    );
    if (active.length >= concurrencyLimit) {
      throw new ApiError(409, "SESSION_LIMIT_REACHED", false, "Session limit reached");
    }
    this.sessions.set(session.sessionIdHash, { ...session, revokedAt: null });
  }

  async findActive(sessionIdHash, now) {
    const value = this.sessions.get(sessionIdHash);
    return value && !value.revokedAt && value.expiresAt > now ? value : null;
  }

  async rotate(rotation) {
    const value = this.sessions.get(rotation.currentSessionIdHash);
    if (!value || value.revokedAt || value.expiresAt <= rotation.lastSeenAt) return null;
    this.sessions.delete(rotation.currentSessionIdHash);
    const next = {
      ...value,
      sessionIdHash: rotation.nextSessionIdHash,
      directusAccessTokenCiphertext: rotation.directusAccessTokenCiphertext,
      directusRefreshTokenCiphertext: rotation.directusRefreshTokenCiphertext,
      accessTokenExpiresAt: rotation.accessTokenExpiresAt,
      rotationCounter: value.rotationCounter + 1
    };
    this.sessions.set(rotation.nextSessionIdHash, next);
    return next;
  }

  async touch() {}

  async revoke(sessionIdHash, reason, revokedAt) {
    const value = this.sessions.get(sessionIdHash);
    if (!value || value.revokedAt) return false;
    value.revokedAt = revokedAt;
    value.revokeReason = reason;
    return true;
  }

  async revokeFamily(sessionFamilyId, reason, revokedAt) {
    let count = 0;
    for (const value of this.sessions.values()) {
      if (value.sessionFamilyId === sessionFamilyId && !value.revokedAt) {
        value.revokedAt = revokedAt;
        value.revokeReason = reason;
        count++;
      }
    }
    return count;
  }

  async recordAudit(event) {
    this.audits.push(event);
  }

  async ping() { return true; }
  async close() {}
}

class TestIdentityProvider {
  refreshCount = 0;
  loggedOut = [];
  resetRequests = [];
  resetCalls = [];
  registrationRequests = [];
  verificationCalls = [];

  async login(email, password) {
    if (email !== "traveler@example.test" || password !== "correct-password") {
      const error = new Error("Authentication failed");
      error.statusCode = 401;
      error.code = "AUTHENTICATION_FAILED";
      error.retryable = false;
      throw error;
    }
    return { accessToken: "access-login", refreshToken: "refresh-login", expiresInMilliseconds: 600_000 };
  }

  async refresh(refreshToken) {
    if (!refreshToken.startsWith("refresh-")) throw new Error("Invalid refresh");
    this.refreshCount++;
    return {
      accessToken: `access-${this.refreshCount}`,
      refreshToken: `refresh-${this.refreshCount}`,
      expiresInMilliseconds: 600_000
    };
  }

  async logout(refreshToken) {
    this.loggedOut.push(refreshToken);
  }

  async register(email, password, verificationUrl) {
    this.registrationRequests.push({ email, password, verificationUrl });
  }

  async verifyRegistration(verificationToken) {
    this.verificationCalls.push(verificationToken);
  }

  async requestPasswordReset(email, resetUrl) {
    this.resetRequests.push({ email, resetUrl });
  }

  async resetPassword(resetToken, password) {
    this.resetCalls.push({ resetToken, password });
  }

  async getCurrentUser(accessToken) {
    if (!accessToken.startsWith("access-")) throw new Error("Invalid access token");
    return {
      id: "11111111-1111-4111-8111-111111111111",
      roleId: TRAVELER_ROLE_ID
    };
  }

  async isReady() { return true; }
}

function createConfig(overrides = {}) {
  return {
    appEnvironment: "test",
    serviceName: "application-api-test",
    port: 8080,
    directusUrl: new URL("http://directus:8055"),
    allowedOrigins: new Set([ORIGIN]),
    passwordResetConsumeUrl: new URL(`${ORIGIN}/api/v1/auth/password/consume`),
    passwordResetRedirectUrl: new URL(`${ORIGIN}/reset-password`),
    emailVerificationConsumeUrl: new URL(`${ORIGIN}/api/v1/auth/verification/consume`),
    emailVerificationRedirectUrl: new URL(`${ORIGIN}/verify-email`),
    passwordResetTtlSeconds: 900,
    emailVerificationTtlSeconds: 900,
    passwordResetMinLength: 12,
    registrationMinLength: 12,
    travelerRoleId: TRAVELER_ROLE_ID,
    sessionCookieName: "__Host-vnwa_session",
    csrfCookieName: "__Host-vnwa_csrf",
    sessionSameSite: "strict",
    sessionTtlSeconds: 1209600,
    userSessionLimit: 5,
    staffSessionLimit: 2,
    bodyLimitBytes: 1024,
    defaultRateLimitMax: 100,
    loginRateLimitMax: 5,
    rateLimitWindowMilliseconds: 60_000,
    redisTimeoutMilliseconds: 2_000,
    accessRefreshSkewMilliseconds: 60_000,
    trustProxy: false,
    sessionEncryptionKey: Buffer.alloc(32, 1),
    csrfSigningKey: Buffer.alloc(32, 2),
    database: { host: "database", port: 5432, database: "directus", user: "api", password: "unused" },
    redisUrl: "redis://unused",
    ...overrides
  };
}

function getSetCookies(response) {
  const value = response.headers["set-cookie"];
  if (!value) return [];
  return Array.isArray(value) ? value : value.split(/, (?=__Host-)/);
}

function cookiePair(cookie) {
  return cookie.split(";", 1)[0];
}

function findCookie(response, name) {
  const cookie = getSetCookies(response).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(cookie, `Missing cookie ${name}`);
  return cookie;
}

async function issueCsrf(app) {
  const response = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { host: "localhost:8080" } });
  assert.equal(response.statusCode, 200);
  return {
    token: response.json().data.csrfToken,
    cookie: cookiePair(findCookie(response, "__Host-vnwa_csrf"))
  };
}

async function login(app, csrf) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: csrf.cookie,
      "x-csrf-token": csrf.token,
      "content-type": "application/json"
    },
    payload: { email: "traveler@example.test", password: "correct-password" }
  });
}

test("auth flow keeps Directus tokens server-side and rotates opaque sessions", async (context) => {
  const sessions = new MemorySessionStore();
  const identity = new TestIdentityProvider();
  const app = await createApiServer({ config: createConfig(), directus: identity, sessions });
  context.after(() => app.close());

  const csrf = await issueCsrf(app);
  const loginResponse = await login(app, csrf);
  assert.equal(loginResponse.statusCode, 200);
  const serializedLogin = `${loginResponse.body}\n${JSON.stringify(loginResponse.headers)}`;
  assert.doesNotMatch(serializedLogin, /access-login|refresh-login/);

  const sessionCookie = findCookie(loginResponse, "__Host-vnwa_session");
  const loginCsrfCookie = findCookie(loginResponse, "__Host-vnwa_csrf");
  for (const cookie of [sessionCookie, loginCsrfCookie]) {
    assert.match(cookie, /; HttpOnly/i);
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /; SameSite=Strict/i);
    assert.match(cookie, /; Path=\//i);
    assert.doesNotMatch(cookie, /; Domain=/i);
  }

  const oldSessionPair = cookiePair(sessionCookie);
  const meResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/me",
    headers: { host: "localhost:8080", cookie: oldSessionPair }
  });
  assert.equal(meResponse.statusCode, 200);
  assert.deepEqual(meResponse.json().data.user, {
    id: "11111111-1111-4111-8111-111111111111"
  });

  const loginBody = loginResponse.json();
  const refreshResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: `${oldSessionPair}; ${cookiePair(loginCsrfCookie)}`,
      "x-csrf-token": loginBody.data.csrfToken
    }
  });
  assert.equal(refreshResponse.statusCode, 200);
  const newSessionPair = cookiePair(findCookie(refreshResponse, "__Host-vnwa_session"));
  assert.notEqual(newSessionPair, oldSessionPair);

  const replayResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/me",
    headers: { host: "localhost:8080", cookie: oldSessionPair }
  });
  assert.equal(replayResponse.statusCode, 401);
  assert.equal(replayResponse.json().error.code, "SESSION_REVOKED");

  const refreshCsrfCookie = findCookie(refreshResponse, "__Host-vnwa_csrf");
  const refreshBody = refreshResponse.json();
  const logoutResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: `${newSessionPair}; ${cookiePair(refreshCsrfCookie)}`,
      "x-csrf-token": refreshBody.data.csrfToken
    }
  });
  assert.equal(logoutResponse.statusCode, 204);
  const revokedResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/me",
    headers: { host: "localhost:8080", cookie: newSessionPair }
  });
  assert.equal(revokedResponse.statusCode, 401);
  assert.ok(sessions.audits.some((event) => event.eventType === "auth.login" && event.result === "success"));
  assert.ok(sessions.audits.some((event) => event.eventType === "auth.refresh" && event.result === "success"));
  assert.ok(sessions.audits.some((event) => event.eventType === "auth.logout" && event.result === "success"));
});

test("mutations reject missing origin, unknown origin and missing CSRF", async (context) => {
  const app = await createApiServer({
    config: createConfig(),
    directus: new TestIdentityProvider(),
    sessions: new MemorySessionStore()
  });
  context.after(() => app.close());
  const csrf = await issueCsrf(app);

  const missingOrigin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { host: "localhost:8080", cookie: csrf.cookie, "x-csrf-token": csrf.token },
    payload: { email: "traveler@example.test", password: "correct-password" }
  });
  assert.equal(missingOrigin.statusCode, 403);
  assert.equal(missingOrigin.json().error.code, "ORIGIN_REJECTED");

  const unknownOrigin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { host: "localhost:8080", origin: "https://attacker.invalid", cookie: csrf.cookie, "x-csrf-token": csrf.token },
    payload: { email: "traveler@example.test", password: "correct-password" }
  });
  assert.equal(unknownOrigin.statusCode, 403);

  const missingCsrf = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { host: "localhost:8080", origin: ORIGIN },
    payload: { email: "traveler@example.test", password: "correct-password" }
  });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().error.code, "CSRF_REJECTED");
});

test("API applies secure headers and route rate limit", async (context) => {
  const app = await createApiServer({
    config: createConfig({ loginRateLimitMax: 2 }),
    directus: new TestIdentityProvider(),
    sessions: new MemorySessionStore()
  });
  context.after(() => app.close());

  const csrf = await issueCsrf(app);
  const first = await login(app, csrf);
  const second = await login(app, csrf);
  const third = await login(app, csrf);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.json().error.code, "RATE_LIMITED");
  assert.match(first.headers["content-security-policy"], /default-src 'none'/);
  assert.match(first.headers["strict-transport-security"], /max-age=31536000/);
  assert.equal(first.headers["x-frame-options"], "SAMEORIGIN");
  assert.equal(first.headers["cache-control"], "no-store");
});

test("API rejects oversized authentication payloads", async (context) => {
  const app = await createApiServer({
    config: createConfig(),
    directus: new TestIdentityProvider(),
    sessions: new MemorySessionStore()
  });
  context.after(() => app.close());
  const csrf = await issueCsrf(app);
  const oversized = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { host: "localhost:8080", origin: ORIGIN, cookie: csrf.cookie, "x-csrf-token": csrf.token },
    payload: { email: "traveler@example.test", password: "x".repeat(2000) }
  });
  assert.equal(oversized.statusCode, 413);
  assert.equal(oversized.json().error.code, "VALIDATION_FAILED");
});

test("sixth traveler session is denied without evicting active sessions", async (context) => {
  const sessions = new MemorySessionStore();
  const identity = new TestIdentityProvider();
  const app = await createApiServer({
    config: createConfig({ loginRateLimitMax: 20 }),
    directus: identity,
    sessions
  });
  context.after(() => app.close());
  const csrf = await issueCsrf(app);

  for (let index = 0; index < 5; index++) {
    const response = await login(app, csrf);
    assert.equal(response.statusCode, 200);
  }
  const denied = await login(app, csrf);
  assert.equal(denied.statusCode, 409);
  assert.equal(denied.json().error.code, "SESSION_LIMIT_REACHED");
  assert.equal(sessions.sessions.size, 5);
  assert.equal(identity.loggedOut.length, 1);
});

test("password reset bridge stores Directus token server-side and consumes the opaque handle once", async (context) => {
  const sessions = new MemorySessionStore();
  const identity = new TestIdentityProvider();
  const app = await createApiServer({ config: createConfig(), directus: identity, sessions });
  context.after(() => app.close());

  const csrf = await issueCsrf(app);
  const requestResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/password/request",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: csrf.cookie,
      "x-csrf-token": csrf.token,
      "content-type": "application/json"
    },
    payload: { email: "traveler@example.test" }
  });
  assert.equal(requestResponse.statusCode, 202);
  assert.deepEqual(identity.resetRequests, [{
    email: "traveler@example.test",
    resetUrl: `${ORIGIN}/api/v1/auth/password/consume`
  }]);

  const consumeResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/password/consume?token=directus-reset-secret"
  });
  assert.equal(consumeResponse.statusCode, 303);
  assert.match(consumeResponse.headers.location, /^http:\/\/localhost:8080\/reset-password#recovery=/);
  assert.doesNotMatch(consumeResponse.headers.location, /directus-reset-secret/);
  const handle = new URL(consumeResponse.headers.location).hash.slice("#recovery=".length);
  assert.ok(handle.length >= 16);
  assert.equal(consumeResponse.headers["referrer-policy"], "no-referrer");

  const resetCsrf = await issueCsrf(app);
  const resetResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/password/reset",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: resetCsrf.cookie,
      "x-csrf-token": resetCsrf.token,
      "content-type": "application/json"
    },
    payload: { handle, password: "new-password-123" }
  });
  assert.equal(resetResponse.statusCode, 204);
  assert.deepEqual(identity.resetCalls, [{
    resetToken: "directus-reset-secret",
    password: "new-password-123"
  }]);

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/auth/password/reset",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: resetCsrf.cookie,
      "x-csrf-token": resetCsrf.token,
      "content-type": "application/json"
    },
    payload: { handle, password: "another-password-123" }
  });
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.json().error.code, "PASSWORD_RESET_INVALID");
});

test("registration returns only a generic acceptance response", async (context) => {
  const identity = new TestIdentityProvider();
  const app = await createApiServer({
    config: createConfig(),
    directus: identity,
    sessions: new MemorySessionStore()
  });
  context.after(() => app.close());

  const csrf = await issueCsrf(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: csrf.cookie,
      "x-csrf-token": csrf.token,
      "content-type": "application/json"
    },
    payload: { email: "new-traveler@example.test", password: "registration-password" }
  });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { data: { accepted: true } });
  assert.doesNotMatch(response.body, /new-traveler|registration-password|verification|token/i);
  assert.deepEqual(identity.registrationRequests, [{
    email: "new-traveler@example.test",
    password: "registration-password",
    verificationUrl: `${ORIGIN}/api/v1/auth/verification/consume`
  }]);
});

test("email verification bridge encrypts the Directus token and denies expiry and replay", async (context) => {
  const identity = new TestIdentityProvider();
  const verification = new MemoryVerificationStore();
  const app = await createApiServer({
    config: createConfig(),
    directus: identity,
    sessions: new MemorySessionStore(),
    verification
  });
  context.after(() => app.close());

  const invalidConsume = await app.inject({
    method: "GET",
    url: "/api/v1/auth/verification/consume?token=short"
  });
  assert.equal(invalidConsume.statusCode, 303);
  assert.equal(invalidConsume.headers.location, `${ORIGIN}/verify-email#verification_error=invalid`);
  assert.equal(verification.tokens.size, 0);

  const consume = await app.inject({
    method: "GET",
    url: "/api/v1/auth/verification/consume?token=directus-verification-secret"
  });
  assert.equal(consume.statusCode, 303);
  assert.match(consume.headers.location, /^http:\/\/localhost:8080\/verify-email#verification=/);
  assert.doesNotMatch(consume.headers.location, /directus-verification-secret/);
  assert.equal(consume.headers["referrer-policy"], "no-referrer");

  const handle = new URL(consume.headers.location).hash.slice("#verification=".length);
  const [stored] = verification.tokens.values();
  assert.ok(stored);
  assert.match(stored.directusVerificationTokenCiphertext, /^v1\./);
  assert.doesNotMatch(stored.directusVerificationTokenCiphertext, /directus-verification-secret/);

  stored.expiresAt = new Date(0);
  const expiredCsrf = await issueCsrf(app);
  const expired = await app.inject({
    method: "POST",
    url: "/api/v1/auth/verification/complete",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: expiredCsrf.cookie,
      "x-csrf-token": expiredCsrf.token,
      "content-type": "application/json"
    },
    payload: { handle }
  });
  assert.equal(expired.statusCode, 400);
  assert.equal(expired.json().error.code, "EMAIL_VERIFICATION_INVALID");
  assert.deepEqual(identity.verificationCalls, []);

  const secondConsume = await app.inject({
    method: "GET",
    url: "/api/v1/auth/verification/consume?token=second-directus-verification-secret"
  });
  const validHandle = new URL(secondConsume.headers.location).hash.slice("#verification=".length);
  const validCsrf = await issueCsrf(app);
  const complete = await app.inject({
    method: "POST",
    url: "/api/v1/auth/verification/complete",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: validCsrf.cookie,
      "x-csrf-token": validCsrf.token,
      "content-type": "application/json"
    },
    payload: { handle: validHandle }
  });
  assert.equal(complete.statusCode, 204);
  assert.deepEqual(identity.verificationCalls, ["second-directus-verification-secret"]);

  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/auth/verification/complete",
    headers: {
      host: "localhost:8080",
      origin: ORIGIN,
      cookie: validCsrf.cookie,
      "x-csrf-token": validCsrf.token,
      "content-type": "application/json"
    },
    payload: { handle: validHandle }
  });
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.json().error.code, "EMAIL_VERIFICATION_INVALID");
  assert.deepEqual(identity.verificationCalls, ["second-directus-verification-secret"]);
});
