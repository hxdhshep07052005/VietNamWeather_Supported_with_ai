/**
 * Auth Types
 * Type definitions for authentication
 */

export interface SavedLocation {
  id: string;
  name: string;
  provinceCode: string;
  savedAt: string;
}

export interface SavedRoute {
  id: string;
  fromName: string;
  toName: string;
  vehicle: "car" | "motorcycle";
  distanceKm: number;
  durationMinutes: number;
  savedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  plan: "free" | "pro";
  isVerified: boolean;
  savedLocations?: SavedLocation[];
  savedRoutes?: SavedRoute[];
  dailyRouteCount?: number;
  lastQuotaResetDate?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  csrfToken: string;
}

export interface VerifyOtpParams {
  email: string;
  token: string;
  code: string;
}

export interface ResendOtpParams {
  email: string;
}
