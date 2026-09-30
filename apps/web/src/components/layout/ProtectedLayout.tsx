import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  Zap,
  Settings,
  MapPin,
  Navigation,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useTheme, useToggleTheme } from "@/hooks/useThemeStore";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import { FloatingChatWidget } from "../chat/FloatingChatWidget";
import { RequireLoginModal } from "../common/RequireLoginModal";
import styles from "./ProtectedLayout.module.css";

export function ProtectedLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const theme = useTheme();
  const toggleTheme = useToggleTheme();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPro = user?.plan === "pro";
  const userInitial = (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase();
  const displayName = user?.name || user?.email?.split("@")[0] || "Người dùng";
  const savedLocationsCount = user?.savedLocations?.length || 0;
  const savedRoutesCount = user?.savedRoutes?.length || 0;

  // Handle Logout
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isDropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [location.pathname]);

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          {/* Logo */}
          <Link to="/map" className={styles.logo} title="VietnamWeather AI">
            <img src="/logo.svg" alt="VietnamWeather AI" width={32} height={32} />
            <span>VietnamWeather AI</span>
          </Link>

          {/* Navigation Links */}
          <nav className={styles.nav}>
            <Link
              to="/map"
              className={`${styles.navLink} ${location.pathname === "/map" ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.map") || "Bản đồ"}</span>
            </Link>
            <Link
              to="/weather"
              className={`${styles.navLink} ${location.pathname === "/weather" ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.weather") || "Thời tiết"}</span>
            </Link>
            <Link
              to="/route"
              className={`${styles.navLink} ${location.pathname === "/route" ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.route") || "Lộ trình"}</span>
            </Link>
            <Link
              to="/settings"
              className={`${styles.navLink} ${location.pathname === "/settings" ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.settings") || "Cài đặt"}</span>
            </Link>
            <Link
              to="/upgrade"
              className={`${styles.navLink} ${location.pathname === "/upgrade" || location.pathname === "/pricing" ? styles.navLinkActive : ""}`}
            >
              <span>{t("nav.pricing") || "Bảng giá & Gói cước"}</span>
            </Link>
          </nav>

          {/* Right Header Area */}
          <div className={styles.userMenu} ref={dropdownRef}>
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* User Profile Button */}
            <button
              type="button"
              className={`${styles.userButton} ${isDropdownOpen ? styles.userButtonActive : ""}`}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-label="Menu cài đặt người dùng"
            >
              <div className={`${styles.avatar} ${isPro ? styles.avatarPro : ""}`}>
                {userInitial}
              </div>

              <span className={styles.userButtonName}>{displayName}</span>

              {isPro && (
                <span className={styles.planTagPro}>
                  <Crown size={11} strokeWidth={2.5} />
                  <span>PRO</span>
                </span>
              )}

              <ChevronDown
                size={16}
                strokeWidth={2.5}
                className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className={styles.dropdown}>
                {/* Profile Header */}
                <div className={styles.profileHeader}>
                  <div className={`${styles.avatar} ${isPro ? styles.avatarPro : ""}`} style={{ width: 40, height: 40, fontSize: 16 }}>
                    {userInitial}
                  </div>
                  <div className={styles.profileDetails}>
                    <span className={styles.profileName}>{user?.name || displayName}</span>
                    <span className={styles.profileEmail}>{user?.email}</span>
                    <div className={styles.profilePlanStatus}>
                      {isPro ? (
                        <span className={styles.proBadge}>
                          <Crown size={12} />
                          <span>Gói PRO Cao Cấp</span>
                        </span>
                      ) : (
                        <span className={styles.freeBadge}>
                          <Zap size={12} />
                          <span>Gói Miễn Phí</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Theme Mode Setting Card */}
                <div
                  className={styles.themeCard}
                  onClick={toggleTheme}
                  title="Bấm để đổi chế độ Sáng / Tối"
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.themeLeft}>
                    <div className={styles.themeIconWrap}>
                      {theme === "dark" ? (
                        <Moon size={16} />
                      ) : (
                        <Sun size={16} />
                      )}
                    </div>
                    <div className={styles.themeText}>
                      <span className={styles.themeLabel}>Giao diện {theme === "dark" ? "Chế độ Tối" : "Chế độ Sáng"}</span>
                      <span className={styles.themeSub}>Bấm để chuyển sang {theme === "dark" ? "Sáng" : "Tối"}</span>
                    </div>
                  </div>

                  <div className={`${styles.themeSwitchTrack} ${theme === "dark" ? styles.themeSwitchTrackDark : ""}`}>
                    <div className={`${styles.themeSwitchThumb} ${theme === "dark" ? styles.themeSwitchThumbDark : ""}`} />
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Navigation Menu Items */}
                <div className={styles.menuItems}>
                  <Link to="/settings" className={styles.menuItem} onClick={() => setIsDropdownOpen(false)}>
                    <div className={styles.menuItemLeft}>
                      <Settings size={16} />
                      <span>{t("nav.settings") || "Cài đặt tài khoản"}</span>
                    </div>
                  </Link>

                  <Link to="/settings" className={styles.menuItem} onClick={() => setIsDropdownOpen(false)}>
                    <div className={styles.menuItemLeft}>
                      <MapPin size={16} />
                      <span>Địa điểm đã lưu</span>
                    </div>
                    <span className={styles.menuItemCount}>{savedLocationsCount}</span>
                  </Link>

                  <Link to="/settings" className={styles.menuItem} onClick={() => setIsDropdownOpen(false)}>
                    <div className={styles.menuItemLeft}>
                      <Navigation size={16} />
                      <span>Lộ trình đã lưu</span>
                    </div>
                    <span className={styles.menuItemCount}>{savedRoutesCount}</span>
                  </Link>

                  <Link to="/upgrade" className={styles.menuItem} onClick={() => setIsDropdownOpen(false)}>
                    <div className={styles.menuItemLeft}>
                      <Crown size={16} />
                      <span>Gói Dịch Vụ & Hạn Mức</span>
                    </div>
                    {!isPro && <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 700 }}>Nâng cấp</span>}
                  </Link>
                </div>

                <div className={styles.divider} />

                {/* Logout Action */}
                <button type="button" className={styles.logoutItem} onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>{t("nav.logout") || "Đăng xuất"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Phase 11 AI Travel Chatbot Widget */}
      <FloatingChatWidget />
      <RequireLoginModal />
    </div>
  );
}
