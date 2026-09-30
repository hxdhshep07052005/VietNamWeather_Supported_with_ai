/**
 * AppHeader.tsx
 * Single, unified navigation header across the entire VietnamWeather AI web platform.
 * Provides consistent logo, routing, active pill indication, theme toggle, language switcher,
 * user authentication profile dropdown, and mobile navigation drawer.
 */

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Settings,
  MapPin,
  Navigation,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useTheme, useToggleTheme } from "@/hooks/useThemeStore";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const theme = useTheme();
  const toggleTheme = useToggleTheme();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPro = user?.plan === "pro";
  const userInitial = (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase();
  const displayName = user?.name || user?.email?.split("@")[0] || "Người dùng";

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  // Close dropdown and mobile menu on route change
  useEffect(() => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  const isPathActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    if (path === "/pricing") {
      return location.pathname === "/pricing" || location.pathname === "/upgrade";
    }
    if (path === "/weather") {
      return location.pathname === "/weather" || location.pathname.startsWith("/location");
    }
    return location.pathname === path;
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Brand Logo - Always returns to Home (/) */}
        <Link to="/" className={styles.logo} title="VietnamWeather AI - Trang chủ">
          <img src="/logo.svg" alt="Logo" className={styles.logoImg} width={32} height={32} />
          <span className={styles.logoText}>VietnamWeather AI</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className={styles.nav}>
          <Link
            to="/"
            className={`${styles.navLink} ${isPathActive("/") ? styles.navLinkActive : ""}`}
          >
            <span>{t("nav.home") || "Trang chủ"}</span>
          </Link>
          <Link
            to="/map"
            className={`${styles.navLink} ${isPathActive("/map") ? styles.navLinkActive : ""}`}
          >
            <span>{t("nav.map") || "Bản đồ"}</span>
          </Link>
          <Link
            to="/weather"
            className={`${styles.navLink} ${isPathActive("/weather") ? styles.navLinkActive : ""}`}
          >
            <span>{t("nav.weather") || "Thời tiết"}</span>
          </Link>
          <Link
            to="/route"
            className={`${styles.navLink} ${isPathActive("/route") ? styles.navLinkActive : ""}`}
          >
            <span>{t("nav.route") || "Lộ trình"}</span>
          </Link>
          <Link
            to="/pricing"
            className={`${styles.navLink} ${isPathActive("/pricing") ? styles.navLinkActive : ""}`}
          >
            <span>{t("nav.pricing") || "Bảng giá"}</span>
          </Link>
          {isAuthenticated && (
            <Link
              to="/settings"
              className={`${styles.navLink} ${isPathActive("/settings") ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.settings") || "Cài đặt"}</span>
            </Link>
          )}
        </nav>

        {/* Header Right Controls */}
        <div className={styles.headerRight}>
          {/* Theme Toggle (Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeToggle}
            aria-label={theme === "light" ? "Chuyển sang chế độ tối" : "Switch to light mode"}
            title={theme === "light" ? "Chuyển sang chế độ tối" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* User Profile or Guest Login/Register */}
          {isAuthenticated ? (
            <div className={styles.userMenu} ref={dropdownRef}>
              <button
                type="button"
                className={`${styles.userButton} ${isDropdownOpen ? styles.userButtonActive : ""}`}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-label="Tài khoản cá nhân"
              >
                <div className={`${styles.avatar} ${isPro ? styles.avatarPro : ""}`}>
                  {userInitial}
                </div>

                <span className={styles.userButtonName}>{displayName}</span>

                {isPro && (
                  <span className={styles.planTagPro}>
                    <Crown size={10} strokeWidth={2.5} />
                    <span>PRO</span>
                  </span>
                )}

                <ChevronDown
                  size={15}
                  strokeWidth={2.5}
                  className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ""}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.profileHeader}>
                    <div className={`${styles.avatar} ${isPro ? styles.avatarPro : ""}`} style={{ width: 38, height: 38, fontSize: 15 }}>
                      {userInitial}
                    </div>
                    <div className={styles.profileDetails}>
                      <span className={styles.profileName}>{user?.name || displayName}</span>
                      <span className={styles.profileEmail}>{user?.email}</span>
                      <div style={{ marginTop: "4px" }}>
                        {isPro ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#f59e0b", fontWeight: 700 }}>
                            <Crown size={11} />
                            <span>Gói PRO Cao Cấp</span>
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--color-primary, #0066cc)", fontWeight: 600 }}>
                            <Zap size={11} />
                            <span>Gói Miễn Phí</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.menuList}>
                    <Link to="/settings" className={styles.menuItem}>
                      <div className={styles.menuItemLeft}>
                        <Settings size={15} />
                        <span>Hồ sơ & Cài đặt</span>
                      </div>
                    </Link>

                    <Link to="/map" className={styles.menuItem}>
                      <div className={styles.menuItemLeft}>
                        <MapPin size={15} />
                        <span>Địa điểm đã lưu</span>
                      </div>
                    </Link>

                    <Link to="/route" className={styles.menuItem}>
                      <div className={styles.menuItemLeft}>
                        <Navigation size={15} />
                        <span>Lộ trình đã lưu</span>
                      </div>
                    </Link>

                    <Link to="/upgrade" className={styles.menuItem}>
                      <div className={styles.menuItemLeft}>
                        <Crown size={15} />
                        <span>Gói Dịch Vụ & Hạn Mức</span>
                      </div>
                      {!isPro && <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700 }}>Nâng cấp</span>}
                    </Link>
                  </div>

                  <div className={styles.divider} />

                  <button type="button" className={styles.logoutItem} onClick={handleLogout}>
                    <LogOut size={15} />
                    <span>{t("nav.logout") || "Đăng xuất"}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.guestActions}>
              <Link to="/login" className={styles.loginBtn}>
                {t("auth.login") || "Đăng nhập"}
              </Link>
              <Link to="/register" className={styles.registerBtn}>
                {t("auth.register") || "Đăng ký"}
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Mở menu điều hướng"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        className={`${styles.mobileDrawer} ${isMobileMenuOpen ? styles.mobileDrawerOpen : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div className={styles.mobileDrawerContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.mobileDrawerHeader}>
            <Link to="/" className={styles.logo} onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/logo.svg" alt="Logo" width={28} height={28} />
              <span className={styles.logoText}>VietnamWeather AI</span>
            </Link>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.mobileNavLinks}>
            <Link
              to="/"
              className={`${styles.mobileNavLink} ${isPathActive("/") ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("nav.home") || "Trang chủ"}
            </Link>
            <Link
              to="/map"
              className={`${styles.mobileNavLink} ${isPathActive("/map") ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("nav.map") || "Bản đồ"}
            </Link>
            <Link
              to="/weather"
              className={`${styles.mobileNavLink} ${isPathActive("/weather") ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("nav.weather") || "Thời tiết"}
            </Link>
            <Link
              to="/route"
              className={`${styles.mobileNavLink} ${isPathActive("/route") ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("nav.route") || "Lộ trình"}
            </Link>
            <Link
              to="/pricing"
              className={`${styles.mobileNavLink} ${isPathActive("/pricing") ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("nav.pricing") || "Bảng giá & Gói cước"}
            </Link>
            {isAuthenticated && (
              <Link
                to="/settings"
                className={`${styles.mobileNavLink} ${isPathActive("/settings") ? styles.mobileNavLinkActive : ""}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t("nav.settings") || "Cài đặt tài khoản"}
              </Link>
            )}
          </div>

          <div className={styles.mobileDrawerFooter}>
            {isAuthenticated ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" }}>
                  <div className={`${styles.avatar} ${isPro ? styles.avatarPro : ""}`}>
                    {userInitial}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {user?.name || displayName}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>
                      {user?.email}
                    </div>
                  </div>
                </div>
                <button type="button" className={styles.logoutItem} onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>{t("nav.logout") || "Đăng xuất"}</span>
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  to="/login"
                  className={styles.loginBtn}
                  style={{ textAlign: "center" }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("auth.login") || "Đăng nhập"}
                </Link>
                <Link
                  to="/register"
                  className={styles.registerBtn}
                  style={{ textAlign: "center" }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("auth.register") || "Đăng ký tài khoản"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
