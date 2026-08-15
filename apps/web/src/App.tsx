/**
 * Phase 9 Main Application Component
 * Per FRONT-001: React + React Router
 */

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./hooks/useAuthStore";

// Layout
import { PublicLayout } from "./components/layout/PublicLayout";
import { ProtectedLayout } from "./components/layout/ProtectedLayout";

// Public Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";

// Protected Pages
import { MapPage } from "./pages/MapPage";
import { LocationPage } from "./pages/LocationPage";
import { RoutePlannerPage } from "./pages/RoutePlannerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpgradePage } from "./pages/UpgradePage";

// Route Guard Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Admin Route Guard
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  // TODO: Check user role from entitlements
  const isAdmin = user?.role === "admin";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
      </Route>

      {/* Protected Routes */}
      <Route element={<ProtectedLayout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/map" element={<MapPage />} />
          <Route path="/location/:id" element={<LocationPage />} />
          <Route path="/route" element={<RoutePlannerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
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
