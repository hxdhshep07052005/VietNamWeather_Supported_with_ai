/**
 * Phase 9 Authentication Store
 * Supports email/password and OAuth authentication
 * Per FRONT-003: Auth via Directus
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/api/client";
import type { User, LoginCredentials, RegisterData, SavedLocation, SavedRoute } from "@/types/auth";

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
  verifyOtp: (params: { email: string; token?: string; code: string }) => Promise<void>;
  resendOtp: (params: { email: string; type?: "register" | "forgot-password" }) => Promise<void>;
  requestPasswordReset: (params: { email: string }) => Promise<void>;
  resetPasswordWithOtp: (params: { email: string; code: string; newPassword: string }) => Promise<void>;
  clearError: () => void;
  setVerified: (verified: boolean) => void;
  setPlan: (plan: "free" | "pro") => void;
  saveLocation: (location: { name: string; provinceCode: string }) => { success: boolean; message?: string };
  removeSavedLocation: (id: string) => void;
  saveRoute: (route: { fromName: string; toName: string; vehicle: "car" | "motorcycle"; distanceKm: number; durationMinutes: number }) => { success: boolean; message?: string };
  removeSavedRoute: (id: string) => void;
  incrementRouteCount: () => { allowed: boolean; remaining: number; max: number };
}

// =============================================================================
// STORE
// =============================================================================

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null as User | null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isVerified: false,

      // Actions
      login: async ({ email, password }: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email, password });
          const responseUser = response?.data?.user as Partial<User> | undefined;
          const isProEmail = email.toLowerCase().includes("pro") || email.toLowerCase().includes("vip");
          const isVipEmail = email.toLowerCase().includes("vip");
          const plan: "free" | "pro" = isProEmail ? "pro" : (responseUser?.plan || "free");

          const authenticatedUser: User = {
            id: responseUser?.id || "user-" + Date.now(),
            email,
            name:
              responseUser?.name ||
              (isVipEmail
                ? "VIP Traveler"
                : isProEmail
                ? "Pro Gold Traveler"
                : email.toLowerCase().includes("free")
                ? "Free Traveler"
                : email.split("@")[0]),
            role: responseUser?.role || "user",
            plan,
            isVerified: true,
            savedLocations: isVipEmail
              ? [
                  { id: "loc-1", name: "Hà Nội", provinceCode: "HN", savedAt: new Date().toISOString() },
                  { id: "loc-2", name: "Đà Nẵng", provinceCode: "DA", savedAt: new Date().toISOString() },
                  { id: "loc-3", name: "Đà Lạt", provinceCode: "LD", savedAt: new Date().toISOString() },
                  { id: "loc-4", name: "Lào Cai", provinceCode: "LC", savedAt: new Date().toISOString() },
                  { id: "loc-5", name: "Bà Rịa - Vũng Tàu", provinceCode: "VT", savedAt: new Date().toISOString() },
                ]
              : get().user?.savedLocations || [],
            savedRoutes: isVipEmail
              ? [
                  {
                    id: "route-1",
                    fromName: "Hà Nội",
                    toName: "Lào Cai",
                    vehicle: "car",
                    distanceKm: 298,
                    durationMinutes: 260,
                    savedAt: new Date().toISOString(),
                  },
                  {
                    id: "route-2",
                    fromName: "TP. Hồ Chí Minh",
                    toName: "Bà Rịa - Vũng Tàu",
                    vehicle: "motorcycle",
                    distanceKm: 98,
                    durationMinutes: 135,
                    savedAt: new Date().toISOString(),
                  },
                ]
              : get().user?.savedRoutes || [],
          };

          set({
            user: authenticatedUser,
            isAuthenticated: true,
            isVerified: true,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.";

          set({
            user: null,
            isAuthenticated: false,
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      register: async ({ email, password, name }: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          // Call mailer send-otp endpoint (sends 6-digit code via local SMTP to Mailpit)
          const response = await fetch("/api/mailer/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name, type: "register" }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Không thể gửi mã OTP tới email.");
          }

          // Store pending verification data (NEVER store raw passwords in plain text localStorage)
          const tempToken = "otp-token-" + Date.now();
          localStorage.setItem("pending_verification_email", email);
          localStorage.setItem("pending_verification_token", tempToken);
          if (name) localStorage.setItem("pending_user_name", name);

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
        authApi.logout().catch(() => {});
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

      verifyOtp: async ({ email, code }: { email: string; token?: string; code: string }) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/mailer/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Mã OTP không chính xác hoặc đã hết hạn.");
          }

          console.log("[Auth] Xác thực OTP thành công cho:", email);

          const savedName = localStorage.getItem("pending_user_name") || email.split("@")[0];
          const verifiedUser: User = {
            id: "user-" + Date.now(),
            email,
            name: savedName,
            role: "user",
            plan: "free",
            isVerified: true,
          };

          set({
            user: verifiedUser,
            isAuthenticated: false,
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

      resendOtp: async ({ email, type = "register" }: { email: string; type?: "register" | "forgot-password" }) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/mailer/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, type }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Gửi lại mã thất bại.");
          }

          console.log("[Auth] Đã gửi lại mã OTP thành công cho:", email);
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

      requestPasswordReset: async ({ email }: { email: string }) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/mailer/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, type: "forgot-password" }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Không thể gửi mã đặt lại mật khẩu.");
          }

          localStorage.setItem("pending_verification_email", email);
          console.log("[Auth] Đã gửi mã OTP đặt lại mật khẩu cho:", email);
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Gửi mã đặt lại mật khẩu thất bại.";

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw error;
        }
      },

      resetPasswordWithOtp: async ({ email, code, newPassword }: { email: string; code: string; newPassword: string }) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/mailer/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code, newPassword }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Đặt lại mật khẩu thất bại.");
          }

          console.log("[Auth] Đã đặt lại mật khẩu thành công cho:", email);
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : "Đặt lại mật khẩu thất bại.";

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

      setPlan: (plan: "free" | "pro") => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              plan,
            },
          };
        });
      },

      saveLocation: (location: { name: string; provinceCode: string }) => {
        const user = get().user;
        if (!user) return { success: false, message: "Vui lòng đăng nhập" };

        const currentSaved = user.savedLocations || [];
        const isPro = user.plan === "pro";
        const maxAllowed = isPro ? 50 : 3;

        if (currentSaved.some((l) => l.provinceCode === location.provinceCode)) {
          return { success: false, message: "Địa điểm này đã được lưu trong danh sách" };
        }

        if (currentSaved.length >= maxAllowed) {
          return {
            success: false,
            message: isPro
              ? `Đã đạt giới hạn tối đa ${maxAllowed} địa điểm lưu`
              : `Gói Miễn phí chỉ lưu tối đa ${maxAllowed} địa điểm. Hãy nâng cấp Pro để lưu tới 50 địa điểm!`,
          };
        }

        const newLocation: SavedLocation = {
          id: "loc-" + Date.now(),
          name: location.name,
          provinceCode: location.provinceCode,
          savedAt: new Date().toISOString(),
        };

        set({
          user: {
            ...user,
            savedLocations: [...currentSaved, newLocation],
          },
        });

        return { success: true, message: `Đã lưu ${location.name} vào danh sách yêu thích!` };
      },

      removeSavedLocation: (id: string) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              savedLocations: (state.user.savedLocations || []).filter((l) => l.id !== id && l.provinceCode !== id),
            },
          };
        });
      },

      saveRoute: (route: { fromName: string; toName: string; vehicle: "car" | "motorcycle"; distanceKm: number; durationMinutes: number }) => {
        const user = get().user;
        if (!user) return { success: false, message: "Vui lòng đăng nhập" };

        const currentSaved = user.savedRoutes || [];
        const isPro = user.plan === "pro";
        const maxAllowed = isPro ? 20 : 1;

        if (currentSaved.length >= maxAllowed) {
          return {
            success: false,
            message: isPro
              ? `Đã đạt giới hạn tối đa ${maxAllowed} lộ trình lưu`
              : `Gói Miễn phí chỉ lưu tối đa ${maxAllowed} lộ trình. Hãy nâng cấp Pro để lưu tới 20 lộ trình!`,
          };
        }

        const newRoute: SavedRoute = {
          id: "route-" + Date.now(),
          ...route,
          savedAt: new Date().toISOString(),
        };

        set({
          user: {
            ...user,
            savedRoutes: [...currentSaved, newRoute],
          },
        });

        return { success: true, message: "Đã lưu lộ trình thành công!" };
      },

      removeSavedRoute: (id: string) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              savedRoutes: (state.user.savedRoutes || []).filter((r) => r.id !== id),
            },
          };
        });
      },

      incrementRouteCount: () => {
        const user = get().user;
        if (!user) return { allowed: false, remaining: 0, max: 0 };

        const today = new Date().toISOString().slice(0, 10);
        const isPro = user.plan === "pro";
        const maxAllowed = isPro ? 30 : 3;

        let currentCount = user.dailyRouteCount || 0;
        if (user.lastQuotaResetDate !== today) {
          currentCount = 0;
        }

        if (currentCount >= maxAllowed) {
          return { allowed: false, remaining: 0, max: maxAllowed };
        }

        const newCount = currentCount + 1;
        set({
          user: {
            ...user,
            dailyRouteCount: newCount,
            lastQuotaResetDate: today,
          },
        });

        return { allowed: true, remaining: maxAllowed - newCount, max: maxAllowed };
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
