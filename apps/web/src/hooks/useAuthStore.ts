/**
 * Phase 9 Auth Store
 * Per FRONT-001: Zustand for state management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/api/client";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email, password });

          // Store tokens
          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Fetch user profile
          await get().refreshAccessToken();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Login failed",
          });
          throw error;
        }
      },

      register: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.register({ email, password, name });

          // Auto-login after registration
          await get().login(email, password);
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Registration failed",
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;

        try {
          const response = await authApi.refreshToken({ refresh_token: refreshToken });

          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            isAuthenticated: true,
          });

          // Fetch user profile
          const profile = await authApi.getProfile();
          set({ user: profile });
        } catch (error) {
          // Token refresh failed - logout
          await get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
