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
    navigate("/");
  };

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
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
          </nav>

          <div className={styles.userMenu}>
            <LanguageSwitcher />
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
