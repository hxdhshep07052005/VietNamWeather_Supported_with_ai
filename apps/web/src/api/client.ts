/**
 * Phase 9 Typed API Client
 * Per ARCH-003: API-only integration, no backend imports
 */

import type {
  ForecastRequest,
  ForecastSeries,
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  RiskCapabilitiesResponse,
  RouteRequest,
  RouteResponse,
} from "@/types/api";

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
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Add auth token if available
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
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
        ...this.getHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: "UNKNOWN_ERROR",
        message: "An unexpected error occurred",
      }));

      throw new Error(error.message);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
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
    apiClient.get<{ datasets: string[] }>("/weather/capabilities"),

  /**
   * Get current weather
   */
  getCurrentWeather: (params: { location_id: string }) =>
    apiClient.get<unknown>(`/weather/current?location_id=${params.location_id}`),

  /**
   * Get forecast series
   */
  getForecast: (params: ForecastRequest) =>
    apiClient.post<ForecastSeries>("/weather/forecast", params),
};

// =============================================================================
// Risk API
// =============================================================================

export const riskApi = {
  /**
   * Get risk capabilities
   */
  getCapabilities: () =>
    apiClient.get<RiskCapabilitiesResponse>("/risk/capabilities"),

  /**
   * Get risk assessment
   */
  getAssessment: (params: RiskAssessmentRequest) =>
    apiClient.post<RiskAssessmentResponse>("/risk/assessment", params),
};

// =============================================================================
// Route API
// =============================================================================

export const routeApi = {
  /**
   * Calculate weather-aware routes
   */
  calculateRoutes: (params: RouteRequest) =>
    apiClient.post<RouteResponse>("/route/calculate", params),
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
