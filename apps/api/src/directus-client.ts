import { ApiError } from "./errors.js";

export interface DirectusTokenBundle {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInMilliseconds: number;
}

export interface DirectusUser {
  readonly id: string;
  readonly roleId: string;
}

interface DirectusClientOptions {
  readonly baseUrl: URL;
  readonly requestTimeoutMilliseconds?: number;
}

export interface IdentityProvider {
  login(email: string, password: string): Promise<DirectusTokenBundle>;
  refresh(refreshToken: string): Promise<DirectusTokenBundle>;
  logout(refreshToken: string): Promise<void>;
  register(email: string, password: string, verificationUrl: string): Promise<void>;
  verifyRegistration(verificationToken: string): Promise<void>;
  requestPasswordReset(email: string, resetUrl: string): Promise<void>;
  resetPassword(resetToken: string, password: string): Promise<void>;
  getCurrentUser(accessToken: string): Promise<DirectusUser>;
  isReady(): Promise<boolean>;
}

interface DirectusLoginData {
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly expires?: unknown;
}

interface DirectusUserData {
  readonly id?: unknown;
  readonly role?: unknown;
}

interface DirectusAccessClaims {
  readonly id: string;
  readonly role: string;
}

function requireAccessClaims(accessToken: string): DirectusAccessClaims {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
  try {
    const value = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as { id?: unknown }).id !== "string" ||
      typeof (value as { role?: unknown }).role !== "string"
    ) {
      throw new Error("Missing identity claims");
    }
    return {
      id: (value as { id: string }).id,
      role: (value as { role: string }).role
    };
  } catch {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
}

function requireTokenBundle(value: unknown): DirectusTokenBundle {
  if (!value || typeof value !== "object") {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
  const data = (value as { data?: DirectusLoginData }).data;
  if (
    !data ||
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires !== "number" ||
    !Number.isFinite(data.expires) ||
    data.expires <= 0
  ) {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInMilliseconds: data.expires
  };
}

function requireDirectusUser(value: unknown, accessToken: string): DirectusUser {
  if (!value || typeof value !== "object") {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
  const data = (value as { data?: DirectusUserData }).data;
  const roleValue = data?.role;
  const responseRoleId = typeof roleValue === "string"
    ? roleValue
    : roleValue && typeof roleValue === "object" && typeof (roleValue as { id?: unknown }).id === "string"
      ? (roleValue as { id: string }).id
      : null;
  const claims = requireAccessClaims(accessToken);
  if (
    !data ||
    typeof data.id !== "string" ||
    claims.id !== data.id ||
    (responseRoleId !== null && responseRoleId !== claims.role)
  ) {
    throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Invalid identity response");
  }
  return {
    id: data.id,
    roleId: claims.role
  };
}

export class DirectusClient implements IdentityProvider {
  private readonly timeoutMilliseconds: number;

  constructor(private readonly options: DirectusClientOptions) {
    this.timeoutMilliseconds = options.requestTimeoutMilliseconds ?? 10_000;
  }

  async login(email: string, password: string): Promise<DirectusTokenBundle> {
    const response = await this.request("auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, mode: "json" })
    }, true);
    return requireTokenBundle(await response.json());
  }

  async refresh(refreshToken: string): Promise<DirectusTokenBundle> {
    const response = await this.request("auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken, mode: "json" })
    }, true);
    return requireTokenBundle(await response.json());
  }

  async logout(refreshToken: string): Promise<void> {
    const response = await this.request("auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken, mode: "json" })
    }, true, true);
    await response.body?.cancel();
  }

  async register(email: string, password: string, verificationUrl: string): Promise<void> {
    try {
      const response = await fetch(new URL("users/register", this.options.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, verification_url: verificationUrl }),
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMilliseconds)
      });
      await response.body?.cancel();
      if (response.ok) return;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    }
  }

  async verifyRegistration(verificationToken: string): Promise<void> {
    try {
      const url = new URL("users/register/verify-email", this.options.baseUrl);
      url.searchParams.set("token", verificationToken);
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMilliseconds)
      });
      await response.body?.cancel();
      if (response.status >= 200 && response.status < 400) return;
      if (response.status === 400 || response.status === 403) {
        throw new ApiError(400, "EMAIL_VERIFICATION_INVALID", false, "Email verification link is invalid or expired");
      }
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    }
  }

  async requestPasswordReset(email: string, resetUrl: string): Promise<void> {
    try {
      const response = await fetch(new URL("auth/password/request", this.options.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, reset_url: resetUrl }),
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMilliseconds)
      });
      await response.body?.cancel();
      if (response.status >= 500) {
        throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
      }
      // Directus intentionally does not reveal whether an email exists.
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    }
  }

  async resetPassword(resetToken: string, password: string): Promise<void> {
    const response = await this.request("auth/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, password })
    }, true);
    await response.body?.cancel();
  }

  async getCurrentUser(accessToken: string): Promise<DirectusUser> {
    const response = await this.request("users/me?fields=id", {
      headers: { authorization: `Bearer ${accessToken}` }
    }, true);
    return requireDirectusUser(await response.json(), accessToken);
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await this.request("server/info", {}, false);
      await response.body?.cancel();
      return true;
    } catch {
      return false;
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    authSensitive: boolean,
    allowUnauthorized = false
  ): Promise<Response> {
    try {
      const response = await fetch(new URL(path, this.options.baseUrl), {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMilliseconds)
      });
      if (response.ok || (allowUnauthorized && response.status === 401)) {
        return response;
      }
      await response.body?.cancel();
      if (authSensitive && (response.status === 400 || response.status === 401 || response.status === 403)) {
        throw new ApiError(401, "AUTHENTICATION_FAILED", false, "Authentication failed");
      }
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", true, "Identity service unavailable");
    }
  }
}
