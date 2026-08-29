/**
 * Phase 9 Forgot Password Page - Professional Design
 * Clean form with success state
 */

import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return t("auth.errors.required") || "Trường này là bắt buộc";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return t("auth.errors.invalidEmail") || "Email không hợp lệ";
    }
    return null;
  }, [t]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailTouched) {
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
      // Simulate API call - replace with actual API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // TODO: Call actual password reset API
      // await authApi.requestPasswordReset({ email });

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi / An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Visual panel features (simplified for password reset)
  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
      text: "Khôi phục tài khoản an toàn / Secure account recovery",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      text: "Liên kết đặt lại qua email / Reset link via email",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      text: "Bảo mật theo tiêu chuẩn / Standard security",
    },
  ];

  // Success state
  if (isSuccess) {
    return (
      <AuthCard>
        <AuthVisualPanel
          tagline="Liên kết đặt lại đã được gửi đến email của bạn"
          features={features}
        />
        <AuthFormPanel>
          <AuthSuccessAlert
            title={t("common.success") || "Thành công!"}
            message={t("auth.success.resetSent") || "Đã gửi liên kết đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư và làm theo hướng dẫn."}
          />

          <div style={{ marginTop: "var(--space-6)", textAlign: "center" }}>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
              Không nhận được email? Kiểm tra thư mục spam hoặc thử lại sau vài phút.
              <br />
              Didn't receive the email? Check spam folder or try again in a few minutes.
            </p>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSuccess(false);
                setEmail("");
              }}
            >
              Gửi lại / Resend
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
      <AuthVisualPanel
        tagline={t("landing.heroSubtitle") || "Đưa ra quyết định du lịch thông minh với thời tiết"}
        features={features}
      />
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
            Liên kết đặt lại sẽ hết hạn sau 24 giờ vì lý do bảo mật.
            <br />
            <span style={{ opacity: 0.8 }}>
              Reset link expires after 24 hours for security.
            </span>
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
