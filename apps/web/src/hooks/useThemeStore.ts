/**
 * Theme Store Hook
 * Dark / Light theme state management with persistent localStorage sync
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("vietnam-weather-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
      return saved;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
      return "dark";
    }
  } catch {
    // fallback if localStorage not accessible
  }
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", "light");
  }
  return "light";
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: getInitialTheme(),

      setTheme: (theme: ThemeMode) => {
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
        try {
          localStorage.setItem("vietnam-weather-theme", theme);
        } catch {
          // ignore
        }
        set({ theme });
      },

      toggleTheme: () => {
        const nextTheme: ThemeMode = get().theme === "light" ? "dark" : "light";
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", nextTheme);
        }
        try {
          localStorage.setItem("vietnam-weather-theme", nextTheme);
        } catch {
          // ignore
        }
        set({ theme: nextTheme });
      },
    }),
    {
      name: "vietnam-weather-theme-store",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

export const useTheme = () => useThemeStore((s) => s.theme);
export const useSetTheme = () => useThemeStore((s) => s.setTheme);
export const useToggleTheme = () => useThemeStore((s) => s.toggleTheme);
