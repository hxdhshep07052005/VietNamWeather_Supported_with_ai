import {
  requireEnvironmentPort,
  requireEnvironmentValue
} from "@vietnam-weather/config";

const MAX_SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
const PASSWORD_RESET_CONSUME_PATH = "/api/v1/auth/password/consume";
const EMAIL_VERIFICATION_CONSUME_PATH = "/api/v1/auth/verification/consume";

export interface ApiConfig {
  readonly appEnvironment: string;
  readonly serviceName: string;
  readonly port: number;
  readonly directusUrl: URL;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly passwordResetConsumeUrl: URL;
  readonly passwordResetRedirectUrl: URL;
  readonly emailVerificationConsumeUrl: URL;
  readonly emailVerificationRedirectUrl: URL;
  readonly passwordResetTtlSeconds: number;
  readonly emailVerificationTtlSeconds: number;
  readonly passwordResetMinLength: number;
  readonly registrationMinLength: number;
  readonly travelerRoleId: string;
  readonly sessionCookieName: string;
  readonly csrfCookieName: string;
  readonly sessionSameSite: "strict" | "lax";
  readonly sessionTtlSeconds: number;
  readonly userSessionLimit: number;
  readonly staffSessionLimit: number;
  readonly bodyLimitBytes: number;
  readonly defaultRateLimitMax: number;
  readonly loginRateLimitMax: number;
  readonly weatherRateLimitMax: number;
  readonly weatherCacheTtlSeconds: number;
  readonly weatherPendingRetrySeconds: number;
  readonly rateLimitWindowMilliseconds: number;
  readonly redisTimeoutMilliseconds: number;
  readonly accessRefreshSkewMilliseconds: number;
  readonly trustProxy: boolean;
  readonly sessionEncryptionKey: Buffer;
  readonly csrfSigningKey: Buffer;
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly password: string;
  };
  readonly redisUrl: string;
}

function requireInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number
): number {
  const rawValue = requireEnvironmentValue(environment, name);
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid integer environment variable: ${name}`);
  }
  return value;
}

function requireBoolean(environment: NodeJS.ProcessEnv, name: string): boolean {
  const value = requireEnvironmentValue(environment, name).toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean environment variable: ${name}`);
}

function requireUrl(environment: NodeJS.ProcessEnv, name: string): URL {
  const value = new URL(requireEnvironmentValue(environment, name));
  if (value.protocol !== "http:" && value.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol in environment variable: ${name}`);
  }
  if (value.username || value.password || value.search || value.hash) {
    throw new Error(`URL must not contain credentials, query or fragment: ${name}`);
  }
  return value;
}

function requireOrigins(
  environment: NodeJS.ProcessEnv,
  name: string
): ReadonlySet<string> {
  const origins = requireEnvironmentValue(environment, name)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const url = new URL(entry);
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== entry) {
        throw new Error(`Invalid origin in environment variable: ${name}`);
      }
      return url.origin;
    });
  if (origins.length === 0 || origins.includes("*")) {
    throw new Error(`At least one explicit origin is required: ${name}`);
  }
  return new Set(origins);
}

function requireBase64UrlKey(
  environment: NodeJS.ProcessEnv,
  name: string
): Buffer {
  const value = requireEnvironmentValue(environment, name);
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid base64url key in environment variable: ${name}`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32) {
    throw new Error(`Environment key must decode to 32 bytes: ${name}`);
  }
  return decoded;
}

function requireCookieName(environment: NodeJS.ProcessEnv, name: string): string {
  const value = requireEnvironmentValue(environment, name);
  if (!/^__Host-[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Cookie name must use a valid __Host- prefix: ${name}`);
  }
  return value;
}

function requireSameSite(
  environment: NodeJS.ProcessEnv,
  name: string
): "strict" | "lax" {
  const value = requireEnvironmentValue(environment, name).toLowerCase();
  if (value === "strict" || value === "lax") return value;
  throw new Error(`SameSite must be strict or lax: ${name}`);
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const sessionTtlSeconds = requireInteger(
    environment,
    "API_SESSION_TTL_SECONDS",
    60,
    MAX_SESSION_TTL_SECONDS
  );

  const allowedOrigins = requireOrigins(environment, "API_ALLOWED_ORIGINS");
  const passwordResetConsumeUrl = requireUrl(environment, "API_PASSWORD_RESET_CONSUME_URL");
  const passwordResetRedirectUrl = requireUrl(environment, "API_PASSWORD_RESET_REDIRECT_URL");
  const emailVerificationConsumeUrl = requireUrl(environment, "API_EMAIL_VERIFICATION_CONSUME_URL");
  const emailVerificationRedirectUrl = requireUrl(environment, "API_EMAIL_VERIFICATION_REDIRECT_URL");
  if (passwordResetConsumeUrl.pathname !== PASSWORD_RESET_CONSUME_PATH) {
    throw new Error(`Password reset consume URL must use ${PASSWORD_RESET_CONSUME_PATH}`);
  }
  if (emailVerificationConsumeUrl.pathname !== EMAIL_VERIFICATION_CONSUME_PATH) {
    throw new Error(`Email verification consume URL must use ${EMAIL_VERIFICATION_CONSUME_PATH}`);
  }
  if (
    !allowedOrigins.has(passwordResetConsumeUrl.origin) ||
    !allowedOrigins.has(passwordResetRedirectUrl.origin) ||
    !allowedOrigins.has(emailVerificationConsumeUrl.origin) ||
    !allowedOrigins.has(emailVerificationRedirectUrl.origin)
  ) {
    throw new Error("Authentication URLs must use an allowed application origin");
  }

  return {
    appEnvironment: requireEnvironmentValue(environment, "APP_ENV"),
    serviceName: requireEnvironmentValue(environment, "API_SERVICE_NAME"),
    port: requireEnvironmentPort(environment, "API_PORT"),
    directusUrl: requireUrl(environment, "API_DIRECTUS_URL"),
    allowedOrigins,
    passwordResetConsumeUrl,
    passwordResetRedirectUrl,
    emailVerificationConsumeUrl,
    emailVerificationRedirectUrl,
    passwordResetTtlSeconds: requireInteger(
      environment,
      "API_PASSWORD_RESET_TTL_SECONDS",
      300,
      3_600
    ),
    passwordResetMinLength: requireInteger(
      environment,
      "API_PASSWORD_RESET_MIN_LENGTH",
      8,
      128
    ),
    emailVerificationTtlSeconds: requireInteger(
      environment,
      "API_EMAIL_VERIFICATION_TTL_SECONDS",
      300,
      3_600
    ),
    registrationMinLength: requireInteger(
      environment,
      "API_REGISTRATION_MIN_LENGTH",
      8,
      128
    ),
    travelerRoleId: requireEnvironmentValue(environment, "API_TRAVELER_ROLE_ID"),
    sessionCookieName: requireCookieName(environment, "API_SESSION_COOKIE_NAME"),
    csrfCookieName: requireCookieName(environment, "API_CSRF_COOKIE_NAME"),
    sessionSameSite: requireSameSite(environment, "API_SESSION_SAME_SITE"),
    sessionTtlSeconds,
    userSessionLimit: requireInteger(environment, "API_USER_SESSION_LIMIT", 1, 20),
    staffSessionLimit: requireInteger(environment, "API_STAFF_SESSION_LIMIT", 1, 10),
    bodyLimitBytes: requireInteger(environment, "API_MAX_BODY_BYTES", 1024, 1_048_576),
    defaultRateLimitMax: requireInteger(environment, "API_RATE_LIMIT_DEFAULT_MAX", 1, 10_000),
    loginRateLimitMax: requireInteger(environment, "API_RATE_LIMIT_LOGIN_MAX", 1, 100),
    weatherRateLimitMax: requireInteger(environment, "API_RATE_LIMIT_WEATHER_MAX", 1, 100),
    weatherCacheTtlSeconds: requireInteger(environment, "API_WEATHER_CACHE_TTL_SECONDS", 10, 300),
    weatherPendingRetrySeconds: requireInteger(environment, "API_WEATHER_PENDING_RETRY_SECONDS", 1, 60),
    rateLimitWindowMilliseconds: requireInteger(
      environment,
      "API_RATE_LIMIT_WINDOW_MS",
      1_000,
      3_600_000
    ),
    redisTimeoutMilliseconds: requireInteger(
      environment,
      "API_REDIS_TIMEOUT_MS",
      250,
      10_000
    ),
    accessRefreshSkewMilliseconds: requireInteger(
      environment,
      "API_ACCESS_REFRESH_SKEW_MS",
      0,
      300_000
    ),
    trustProxy: requireBoolean(environment, "API_TRUST_PROXY"),
    sessionEncryptionKey: requireBase64UrlKey(environment, "API_SESSION_ENCRYPTION_KEY"),
    csrfSigningKey: requireBase64UrlKey(environment, "API_CSRF_SIGNING_KEY"),
    database: {
      host: requireEnvironmentValue(environment, "DB_HOST"),
      port: requireEnvironmentPort(environment, "DB_PORT"),
      database: requireEnvironmentValue(environment, "DB_DATABASE"),
      user: requireEnvironmentValue(environment, "API_DB_USER"),
      password: requireEnvironmentValue(environment, "API_DB_PASSWORD")
    },
    redisUrl: requireEnvironmentValue(environment, "API_REDIS_URL")
  };
}
