/**
 * Phase 9 Typed API Client
 * Per ARCH-003: API-only integration, no backend imports
 */

import type {
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  RiskCapabilitiesResponse,
  RouteRequest,
  RouteResponse,
} from "@/types/api";
import type {
  ChatMessageDto,
  PlanDto,
  EntitlementStatusDto,
  UserQuotaStatusDto,
  CheckoutSessionResponse,
} from "@vietnam-weather/contracts";

// =============================================================================
// API Client Configuration
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// =============================================================================
// HTTP Client
// =============================================================================

export interface ApiError {
  code: string;
  message: string;
  correlation_id?: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(hasBody: boolean): HeadersInit {
    const headers: HeadersInit = {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
    };

    // Add auth token if available
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token if available
    const csrfToken = localStorage.getItem("csrf_token");
    if (csrfToken) {
      (headers as Record<string, string>)["x-csrf-token"] = csrfToken;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      credentials: "include", // Include cookies for session auth
      headers: {
        ...this.getHeaders(options?.body != null),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errPayload =
        errorData && typeof errorData === "object" && "error" in errorData
          ? (errorData as { error: ApiError }).error
          : (errorData as ApiError);

      const err = Object.assign(
        new Error(errPayload?.message || "An unexpected error occurred"),
        {
          code: errPayload?.code || "UNKNOWN_ERROR",
          status: response.status,
          retryAfterSeconds: (() => {
            const header = response.headers.get("retry-after");
            if (!header) return undefined;
            const seconds = Number(header);
            return Number.isFinite(seconds) ? Math.max(1, seconds) : Math.max(1, (Date.parse(header) - Date.now()) / 1000);
          })(),
          correlation_id: errPayload?.correlation_id,
        }
      );
      throw err;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // GET request
  async get<T>(endpoint: string, options?: Pick<RequestInit, "signal">): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", ...options });
  }

  // POST request
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// =============================================================================
// API Instances
// =============================================================================

export const apiClient = new ApiClient(API_BASE_URL);

// =============================================================================
// Weather API
// =============================================================================

export const weatherApi = {
  /**
   * Get capabilities (available datasets)
   */
  getCapabilities: () =>
    apiClient.get<{ data: { datasets: string[] } }>("/weather/capabilities").then(r => r.data),

  /**
   * Get live observation for coordinates or locationId
   */
  getObservation: (params: { locationId?: string; latitude?: number; longitude?: number }) => {
    const query = new URLSearchParams();
    if (params.locationId) query.set("locationId", params.locationId);
    if (params.latitude !== undefined) query.set("latitude", String(params.latitude));
    if (params.longitude !== undefined) query.set("longitude", String(params.longitude));
    return apiClient.get<{ data: unknown }>(`/weather/observation?${query.toString()}`).then(r => r.data);
  },

  /**
   * Post complex weather query (current, hourly, daily)
   */
  query: (params: unknown) =>
    apiClient.post<{ data: unknown }>("/weather/query", params).then(r => r.data),
};

// =============================================================================
// Risk API
// =============================================================================

export const riskApi = {
  /**
   * Get risk capabilities
   */
  getCapabilities: () =>
    apiClient.get<{ data: RiskCapabilitiesResponse }>("/risk/capabilities").then(r => r.data || r),

  /**
   * Get risk assessment
   */
  getAssessment: (params: RiskAssessmentRequest) =>
    apiClient.post<{ data: RiskAssessmentResponse }>("/risk/assessment", params).then(r => r.data || r),
};

// =============================================================================
// Route API
// =============================================================================

export const routeApi = {
  /**
   * Calculate weather-aware routes
   */
  calculateRoutes: (params: RouteRequest) =>
    apiClient.post<{ data: RouteResponse }>("/route/calculate", params).then(r => r.data || (r as unknown as RouteResponse)),
};

// =============================================================================
// Chat API
// =============================================================================

export const chatApi = {
  /**
   * Send chat prompt with automatic grounding
   */
  sendMessage: (params: { message: string; locale?: string; conversationId?: string }) =>
    apiClient
      .post<{ data: { message: ChatMessageDto; remainingQuota: number } }>("/chat/message", params)
      .then(r => r.data),

  /**
   * Get conversation history
   */
  getHistory: (params?: { conversationId?: string }) => {
    const q = params?.conversationId ? `?conversationId=${encodeURIComponent(params.conversationId)}` : "";
    return apiClient.get<{ data: ChatMessageDto[] }>(`/chat/history${q}`).then(r => r.data);
  },

  /**
   * Clear conversation history
   */
  clearHistory: (params?: { conversationId?: string }) => {
    const q = params?.conversationId ? `?conversationId=${encodeURIComponent(params.conversationId)}` : "";
    return apiClient.delete<void>(`/chat/history${q}`);
  },

  /**
   * Get user chat quota status
   */
  getQuota: () =>
    apiClient.get<{ data: { used: number; limit: number; remaining: number; resetAt: string; plan: string } }>("/chat/quota").then(r => r.data),
};

// =============================================================================
// Billing API
// =============================================================================

export const billingApi = {
  getPlans: (locale?: string) =>
    apiClient.get<{ data: { plans: PlanDto[] } }>(`/billing/plans${locale ? `?locale=${locale}` : ""}`).then(r => r.data),

  getEntitlements: () =>
    apiClient.get<{ data: EntitlementStatusDto }>("/billing/entitlements").then(r => r.data),

  getQuotas: () =>
    apiClient.get<{ data: UserQuotaStatusDto }>("/billing/quotas").then(r => r.data),

  createCheckoutSession: (params: { plan: string; interval: string; provider: string; successUrl?: string; cancelUrl?: string }) =>
    apiClient.post<{ data: CheckoutSessionResponse }>("/billing/checkout", params).then(r => r.data),
};

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
  /**
   * Login
   */
  login: (params: { email: string; password: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; expires: number }>(
      "/auth/login",
      params
    ),

  /**
   * Register
   */
  register: (params: { email: string; password: string; name?: string }) =>
    apiClient.post<{ message: string }>("/auth/register", params),

  /**
   * Refresh token
   */
  refreshToken: (params: { refresh_token: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; expires: number }>(
      "/auth/refresh",
      params
    ),

  /**
   * Logout
   */
  logout: () => apiClient.post<void>("/auth/logout"),

  /**
   * Verify email
   */
  verifyEmail: (params: { token: string }) =>
    apiClient.post<{ message: string }>("/auth/verify-email", params),

  /**
   * Request password reset
   */
  requestPasswordReset: (params: { email: string }) =>
    apiClient.post<{ message: string }>("/auth/password-reset/request", params),

  /**
   * Confirm password reset
   */
  confirmPasswordReset: (params: { token: string; password: string }) =>
    apiClient.post<{ message: string }>("/auth/password-reset/confirm", params),
};

// =============================================================================
// User API
// =============================================================================

export const userApi = {
  /**
   * Get current user profile
   */
  getProfile: () =>
    apiClient.get<{
      id: string;
      email: string;
      name?: string;
      role: string;
      entitlements: Record<string, unknown>;
    }>("/user/profile"),

  /**
   * Update profile
   */
  updateProfile: (params: { name?: string }) =>
    apiClient.put<{ message: string }>("/user/profile", params),

  /**
   * Get entitlements
   */
  getEntitlements: () =>
    apiClient.get<{
      plan: "free" | "pro";
      quotas: Record<string, number>;
      features: Record<string, boolean>;
    }>("/user/entitlements"),
};
