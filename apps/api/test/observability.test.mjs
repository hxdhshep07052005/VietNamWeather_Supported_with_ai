/**
 * Phase 12 Observability Test Suite
 * Validates QUAL-004: Health Probes, Distributed Correlation Tracking, and Security Headers
 *
 * Decisions: QUAL-001, QUAL-004, SEC-002, OPS-005..006
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiServer } from "../dist/server.js";

const ORIGIN = "http://localhost:8080";
const TRAVELER_ROLE_ID = "03b314c5-30b7-475d-a626-3b291a7fabc2";

class MemorySessionStore {
  sessions = new Map();
  healthy = true;

  async ping() {
    return this.healthy;
  }
  async close() {}
}

class TestIdentityProvider {
  ready = true;

  async isReady() {
    return this.ready;
  }
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

describe("QUAL-004: Health Check Probes (/health/live & /health/ready)", () => {
  it("should respond HTTP 200 with status 'live' on liveness probe", async (context) => {
    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.service, "application-api-test");
    assert.equal(body.status, "live");
    assert.ok(body.timestamp);
    assert.ok(!isNaN(Date.parse(body.timestamp)));
  });

  it("should respond HTTP 200 with status 'ready' when all subsystems are healthy", async (context) => {
    const identity = new TestIdentityProvider();
    const sessions = new MemorySessionStore();
    const app = await createApiServer({
      config: createConfig(),
      directus: identity,
      sessions
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/ready",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.service, "application-api-test");
    assert.equal(body.status, "ready");
    assert.ok(body.timestamp);
  });

  it("should respond HTTP 503 with status 'not_ready' when a dependency is down", async (context) => {
    const identity = new TestIdentityProvider();
    identity.ready = false; // Simulate Directus backend outage

    const app = await createApiServer({
      config: createConfig(),
      directus: identity,
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/ready",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 503);
    const body = res.json();
    assert.equal(body.status, "not_ready");
  });

  it("should respond HTTP 503 when session store ping fails", async (context) => {
    const sessions = new MemorySessionStore();
    sessions.healthy = false; // Simulate database / session pool failure

    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/ready",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().status, "not_ready");
  });
});

describe("QUAL-004: Distributed Correlation Tracking (x-correlation-id)", () => {
  it("should preserve incoming x-correlation-id and return it in response headers", async (context) => {
    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const customCorrelationId = "corr-test-trace-uuid-12345";
    const res = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: {
        host: "localhost:8080",
        "x-correlation-id": customCorrelationId
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-correlation-id"], customCorrelationId);
  });

  it("should automatically generate an api_ prefixed correlation ID when absent", async (context) => {
    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 200);
    const cid = res.headers["x-correlation-id"];
    assert.ok(cid, "x-correlation-id header must be present in response");
    assert.match(cid, /^api_[0-9a-f]{24}$/);
  });

  it("should bind the correlation ID into error responses and error headers", async (context) => {
    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const customCid = "corr-error-trace-777";
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/unknown-endpoint-for-error",
      headers: {
        host: "localhost:8080",
        "x-correlation-id": customCid
      }
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.headers["x-correlation-id"], customCid);
    assert.equal(res.json().error.correlationId, customCid);
  });
});

describe("QUAL-001: Security & Cache Header Hygiene", () => {
  it("should enforce no-store cache control and nosniff on all responses", async (context) => {
    const app = await createApiServer({
      config: createConfig(),
      directus: new TestIdentityProvider(),
      sessions: new MemorySessionStore()
    });
    context.after(() => app.close());

    const res = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { host: "localhost:8080" }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
  });
});
