/**
 * Auth Types
 * Type definitions for authentication
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  plan: "free" | "pro";
  isVerified: boolean;
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
