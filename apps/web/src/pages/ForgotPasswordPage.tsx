/**
 * Phase 9 Forgot Password Page - Professional Design
 * Clean form with success state
 */

import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import {
  AuthCard,
  AuthVisualPanel,
  AuthFormPanel,
  AuthFormHeader,
  AuthErrorAlert,
  AuthSuccessAlert,
} from "@/components/auth/AuthCard";
import styles from "@/components/auth/AuthCard.module.css";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuthStore();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const validateEmail = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return t("auth.errors.emailRequired") || t("auth.errors.required") || "Vui lòng nhập địa chỉ email";
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed)) {
      return t("auth.errors.invalidEmail") || "Email không đúng định dạng (ví dụ: name@example.com)";
    }
    return null;
  }, [t]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailTouched || emailError) {
      setEmailError(validateEmail(value));
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    setEmailError(emailErr);
    setEmailTouched(true);

    if (emailErr) {
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset({ email });
      // Redirect to OTP verification for password reset
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=forgot-password`);
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("common.error") || "Đã xảy ra lỗi"));
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <AuthCard>
        <AuthVisualPanel />
        <AuthFormPanel>
          <AuthSuccessAlert
            title={t("common.success") || "Thành công!"}
            message={t("auth.success.resetSent") || "Đã gửi liên kết đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư và làm theo hướng dẫn."}
          />

          <div style={{ marginTop: "var(--space-6)", textAlign: "center" }}>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
              {t("auth.notReceivedEmail")}
            </p>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSuccess(false);
                setEmail("");
              }}
            >
              {t("common.resend") || "Gửi lại"}
            </Button>
          </div>

          <div className={styles.links}>
            <Link to="/login" className={styles.linkHighlight}>
              {t("auth.backToLogin") || "← Quay lại đăng nhập"}
            </Link>
          </div>
        </AuthFormPanel>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthVisualPanel />
      <AuthFormPanel>
        <AuthFormHeader
          title={t("auth.resetTitle") || "Khôi phục mật khẩu"}
          subtitle={t("auth.resetSubtitle") || "Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu"}
        />

        {/* Info box */}
        <div style={{
          padding: "var(--space-4)",
          background: "var(--color-info-light)",
          border: "1px solid rgba(14, 165, 233, 0.2)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-4)",
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start"
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-info)" }}>
            {t("auth.resetNotice")}
          </p>
        </div>

        {error && (
          <AuthErrorAlert
            title={t("common.error") || "Lỗi"}
            message={error}
          />
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="email"
            type="email"
            label={t("auth.email") || "Email"}
            placeholder="email@example.com"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            error={emailError || undefined}
            leftIcon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
            autoComplete="email"
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={!email && !emailTouched}
          >
            {t("auth.sendResetLink") || "Gửi liên kết đặt lại"}
          </Button>
        </form>

        <div className={styles.links}>
          <Link to="/login" className={styles.linkHighlight}>
            {t("auth.backToLogin") || "← Quay lại đăng nhập"}
          </Link>
        </div>
      </AuthFormPanel>
    </AuthCard>
  );
}
