/**
 * Phase 9 Main Application Component
 * Per FRONT-001: React + React Router
 */

import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "./hooks/useAuthStore";

// Layout
import { ProtectedLayout } from "./components/layout/ProtectedLayout";

// Public Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { OtpPage } from "./pages/OtpPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";

// Protected Pages
import { MapPage } from "./pages/MapPage";
import { LocationPage } from "./pages/LocationPage";
import { RoutePlannerPage } from "./pages/RoutePlannerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpgradePage } from "./pages/UpgradePage";
import { WeatherPage } from "./pages/WeatherPage";

// Route Guard Component using Outlet pattern
function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Admin Route Guard
function AdminRoute() {
  const { isAuthenticated, user } = useAuthStore();

  // Note: In production, check user role from entitlements via userApi.getEntitlements()
  // For now, we check the role from the user object
  const isAdmin = user?.role === "admin";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <Routes>
      {/* Unified Application Shell - Seamless Header across all pages */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/cities" element={<Navigate to="/weather" replace />} />
        <Route path="/location/:id" element={<LocationPage />} />
        <Route path="/route" element={<RoutePlannerPage />} />
        <Route path="/pricing" element={<UpgradePage />} />
        <Route path="/upgrade" element={<UpgradePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<OtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />

        {/* Strictly Authenticated Settings Route */}
        <Route element={<ProtectedRoute />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Admin Routes (via Directus Studio) */}
      <Route element={<AdminRoute />}>
        <Route path="/admin/*" element={<Navigate to="/admin" />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
