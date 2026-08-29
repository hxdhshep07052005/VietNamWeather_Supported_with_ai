/**
 * API Types
 * Type definitions for API client
 */

// Weather Types
export interface ForecastRequest {
  target: {
    locationId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  include: ("current" | "hourly" | "daily")[];
  horizon?: number;
}

export interface ForecastSeries {
  status: "success" | "degraded" | "error";
  data?: unknown;
}

// Risk Types
export interface RiskAssessmentRequest {
  target: {
    locationId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  horizon?: number;
}

export interface RiskAssessmentResponse {
  status: "success" | "degraded" | "error";
  data?: unknown;
}

export interface RiskCapabilitiesResponse {
  status: "success" | "error";
  data?: unknown;
}

// Route Types
export interface RouteRequest {
  origin: {
    locationId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  destination: {
    locationId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  vehicle_type?: "car" | "motorcycle";
  departure_time?: string;
  scoring_weights?: {
    risk_weight?: number;
    time_weight?: number;
    distance_weight?: number;
  };
}

export interface RouteResponse {
  status: "success" | "error";
  data?: unknown;
}

// Auth Types
export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  expires: number;
}

export interface AuthRegisterResponse {
  message: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface PasswordResetRequestResponse {
  message: string;
}

export interface PasswordResetConfirmResponse {
  message: string;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  entitlements: Record<string, unknown>;
}

export interface UserEntitlements {
  plan: "free" | "pro";
  quotas: Record<string, number>;
  features: Record<string, boolean>;
}
