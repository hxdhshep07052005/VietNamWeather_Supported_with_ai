/**
 * Phase 9 Protected Layout Component
 * Layout for authenticated pages (map, route, settings)
 * Per ADR-007: Hybrid i18n approach
 */

import { Outlet, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import styles from "./ProtectedLayout.module.css";

export function ProtectedLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/map" className={styles.logo}>
            <img src="/logo.svg" alt="VietnamWeather AI" width={32} height={32} />
            <span>VietnamWeather AI</span>
          </Link>

          <nav className={styles.nav}>
            <Link to="/map" className={styles.navLink}>
              {t("nav.map")}
            </Link>
            <Link to="/route" className={styles.navLink}>
              {t("nav.route")}
            </Link>
            <Link to="/settings" className={styles.navLink}>
              {t("nav.settings")}
            </Link>
            <Link to="/upgrade" className={styles.navLink}>
              {t("nav.upgrade") || "Gói Dịch Vụ"}
            </Link>
          </nav>

          <div className={styles.userMenu}>
            <LanguageSwitcher />
            {user?.plan === "pro" ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, rgba(255, 205, 0, 0.2), rgba(251, 146, 60, 0.15))",
                  border: "1px solid rgba(255, 205, 0, 0.5)",
                  color: "#FFCD00",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                👑 PRO
              </span>
            ) : (
              <Link
                to="/upgrade"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, #FFCD00, #F59E0B)",
                  color: "#0F172A",
                  fontSize: "11px",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                ⭐ Nâng cấp Pro
              </Link>
            )}
            <span className={styles.userName}>{user?.name || user?.email}</span>
            <button onClick={handleLogout} className={styles.logoutButton}>
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
