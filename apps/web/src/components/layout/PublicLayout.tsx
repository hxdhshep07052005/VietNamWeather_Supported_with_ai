/**
 * Phase 9 Public Layout Component
 * Layout for public pages (landing, auth, legal)
 */

import { Outlet, Link } from "react-router-dom";
import styles from "./PublicLayout.module.css";

export function PublicLayout() {
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
            <Link to="/login" className={styles.navLink}>
              Đăng nhập
            </Link>
            <Link to="/register" className={styles.navLinkPrimary}>
              Đăng ký
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <p className={styles.copyright}>
              © 2026 VietnamWeather AI. Mọi quyền được bảo lưu.
            </p>
            <nav className={styles.footerNav}>
              <Link to="/legal/terms">Điều khoản sử dụng</Link>
              <Link to="/legal/privacy">Chính sách bảo mật</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
