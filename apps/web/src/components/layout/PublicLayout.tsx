/**
 * PublicLayout.tsx
 * Layout for public and auth pages rendering the unified AppHeader,
 * main page content Outlet, Footer, FloatingChatWidget, and RequireLoginModal.
 */

import { Outlet, Link } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { FloatingChatWidget } from "../chat/FloatingChatWidget";
import { RequireLoginModal } from "../common/RequireLoginModal";
import styles from "./PublicLayout.module.css";

export function PublicLayout() {
  return (
    <div className={styles.layout}>
      {/* Single Unified Header */}
      <AppHeader />

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <p className={styles.copyright}>
              © {new Date().getFullYear()} VietnamWeather AI. Mọi quyền được bảo lưu.
            </p>
            <nav className={styles.footerNav}>
              <Link to="/legal/terms">Điều khoản</Link>
              <Link to="/legal/privacy">Chính sách bảo mật</Link>
            </nav>
          </div>
        </div>
      </footer>

      {/* Phase 11 AI Travel Chatbot Widget */}
      <FloatingChatWidget />

      {/* Global Require Login Modal */}
      <RequireLoginModal />
    </div>
  );
}
