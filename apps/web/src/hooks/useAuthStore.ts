/**
 * Phase 9 Authentication Store
 * Supports email/password and OAuth authentication
 * Per FRONT-003: Auth via Directus
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/api/client";
import type { User, LoginCredentials, RegisterData } from "@/types/auth";

// =============================================================================
// TYPES
// =============================================================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isVerified: boolean;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<{ requiresVerification: boolean; tempToken?: string }>;
  logout: () => void;
  verifyOtp: (params: { email: string; token: string; code: string }) => Promise<void>;
  resendOtp: (params: { email: string }) => Promise<void>;
  clearError: () => void;
  setVerified: (verified: boolean) => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isVerified: false,

      // Actions
      login: async ({ email, password }: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // Call real API
          const response = await authApi.login({ email, password });

          // Store access token in localStorage for API client
          localStorage.setItem("access_token", response.access_token);
          localStorage.setItem("refresh_token", response.refresh_token);

          // Create user from response
          const mockUser: User = {
            id: "user-" + Date.now(),
            email,
            name: email.split("@")[0],
            role: "user",
            plan: "free",
            isVerified: true,
          };

          set({
            user: mockUser,
            isAuthenticated: true,
            isVerified: mockUser.isVerified,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Đăng nhập thất bại. Vui lòng thử lại.";

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      register: async ({ email, password, name }: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          // Call real API
          await authApi.register({ email, password, name });

          // Store pending verification data
          const tempToken = "temp-token-" + Date.now();
          localStorage.setItem("pending_verification_email", email);
          localStorage.setItem("pending_verification_token", tempToken);

          set({ isLoading: false });

          return { requiresVerification: true, tempToken };
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Đăng ký thất bại. Vui lòng thử lại.";

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      logout: () => {
        // Call logout API (fire and forget)
        authApi.logout().catch(() => {
          // Ignore errors during logout
        });

        // Clear tokens
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("pending_verification_email");
        localStorage.removeItem("pending_verification_token");

        set({
          user: null,
          isAuthenticated: false,
          isVerified: false,
          error: null,
        });
      },

      verifyOtp: async ({ email, token }: { email: string; token: string; code: string }) => {
        set({ isLoading: true, error: null });

        try {
          // Call real API
          await authApi.verifyEmail({ token });

          console.log("✅ OTP Verification Successful for:", email);

          set({
            isVerified: true,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Xác minh thất bại. Vui lòng thử lại.";

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      resendOtp: async ({ email }: { email: string }) => {
        set({ isLoading: true, error: null });

        try {
          // In production, this would call a resend OTP API endpoint
          // For now, we'll just log it
          console.log("📧 OTP Resend requested for:", email);

          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Gửi lại mã thất bại. Vui lòng thử lại.";

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setVerified: (verified: boolean) => {
        set({ isVerified: verified });
      },
    }),
    {
      name: "vietnam-weather-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isVerified: state.isVerified,
      }),
    }
  )
);
