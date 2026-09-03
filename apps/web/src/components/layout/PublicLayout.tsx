/**
 * Phase 9 Public Layout Component
 * Layout for public pages with dark/light mode toggle
 */

import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import styles from "./PublicLayout.module.css";

export function PublicLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/verify-otp", "/forgot-password"].includes(location.pathname);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("vietnam-weather-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("vietnam-weather-theme", newTheme);
  };

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : ""}`}>
        <div className={styles.container}>
          {/* Logo - non-clickable on auth pages to prevent leaving auth flow */}
          {isAuthPage ? (
            <div className={styles.logo} style={{ cursor: "default" }}>
              <div className={styles.logoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="4" fill="white" />
                </svg>
              </div>
              <span className={styles.logoText}>VietnamWeather AI</span>
            </div>
          ) : (
            <Link to="/" className={styles.logo}>
              <div className={styles.logoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="4" fill="white" />
                </svg>
              </div>
              <span className={styles.logoText}>VietnamWeather AI</span>
            </Link>
          )}

          <div className={styles.headerRight}>
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={styles.themeToggle}
              aria-label={theme === "light" ? "Chuyển sang chế độ tối" : "Switch to light mode"}
            >
              {theme === "light" ? (
                // Moon icon for dark mode
                <svg className={`${styles.themeToggleIcon} ${styles.moonIcon}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              ) : (
                // Sun icon for light mode
                <svg className={`${styles.themeToggleIcon} ${styles.sunIcon}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {/* Navigation */}
            <nav className={styles.nav}>
              <Link to="/login" className={styles.navLink}>
                {t("auth.login")}
              </Link>
              <Link to="/register" className={styles.navLinkPrimary}>
                {t("auth.register")}
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className={styles.mobileMenuButton}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Mở menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.open : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div
          className={styles.mobileMenuContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.mobileMenuHeader}>
            {isAuthPage ? (
              <div className={styles.logo} style={{ cursor: "default" }}>
                <div className={styles.logoIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="4" fill="white" />
                  </svg>
                </div>
              </div>
            ) : (
              <Link to="/" className={styles.logo} onClick={() => setIsMobileMenuOpen(false)}>
                <div className={styles.logoIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="4" fill="white" />
                  </svg>
                </div>
              </Link>
            )}
            <button
              className={styles.mobileMenuClose}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Đóng menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={styles.mobileNavLinks}>
            <Link
              to="/login"
              className={styles.mobileNavLink}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("auth.login")}
            </Link>
            <Link
              to="/register"
              className={styles.mobileNavLinkPrimary}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("auth.register")}
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <p className={styles.copyright}>
              © {new Date().getFullYear()} VietNam Weather. {t("footer.allRightsReserved") || "Mọi quyền được bảo lưu."}
            </p>
            <nav className={styles.footerNav}>
              <Link to="/legal/terms">{t("footer.terms")}</Link>
              <Link to="/legal/privacy">{t("footer.privacy")}</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
