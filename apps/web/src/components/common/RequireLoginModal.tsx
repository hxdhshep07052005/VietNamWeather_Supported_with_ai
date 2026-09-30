/**
 * Require Login Modal Component
 * Prompts unauthenticated guests to log in or create an account
 * when they attempt to interact with protected features
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, X, LogIn, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import styles from "./RequireLoginModal.module.css";

export function RequireLoginModal() {
  const { i18n } = useTranslation();
  const isEn =
    i18n?.language === "en" ||
    (typeof window !== "undefined" &&
      localStorage.getItem("vietnam-weather-language") === "en");

  const { isOpen, featureName, description, closeModal } = useRequireLoginModal();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  const defaultTitle = isEn
    ? featureName
      ? `Log in to use ${featureName}`
      : "Sign in required"
    : featureName
    ? `Đăng nhập để ${featureName}`
    : "Yêu cầu đăng nhập";

  const defaultDescription =
    description ||
    (isEn
      ? "You are currently browsing as a guest. Please log in or create a free account to use this feature and save your travel data!"
      : "Bạn đang trải nghiệm ở chế độ khách. Hãy đăng nhập hoặc đăng ký tài khoản miễn phí để sử dụng tính năng này và lưu dữ liệu!");

  const handleLoginClick = () => {
    closeModal();
    navigate("/login");
  };

  const handleRegisterClick = () => {
    closeModal();
    navigate("/register");
  };

  return (
    <div
      className={styles.backdrop}
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={closeModal}
          aria-label={isEn ? "Close" : "Đóng"}
        >
          <X size={18} />
        </button>

        <div className={styles.iconWrapper}>
          <Lock size={28} />
        </div>

        <h3 className={styles.title}>{defaultTitle}</h3>
        <p className={styles.description}>{defaultDescription}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.loginButton}
            onClick={handleLoginClick}
          >
            <LogIn size={16} />
            <span>{isEn ? "Sign In Now" : "Đăng nhập ngay"}</span>
          </button>

          <button
            type="button"
            className={styles.registerButton}
            onClick={handleRegisterClick}
          >
            <Sparkles size={16} />
            <span>{isEn ? "Create Free Account" : "Đăng ký tài khoản miễn phí"}</span>
          </button>

          <button
            type="button"
            className={styles.cancelButton}
            onClick={closeModal}
          >
            {isEn ? "Continue browsing as guest" : "Tiếp tục xem ở chế độ khách"}
          </button>
        </div>
      </div>
    </div>
  );
}
