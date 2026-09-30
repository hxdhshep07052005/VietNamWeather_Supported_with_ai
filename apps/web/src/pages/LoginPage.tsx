/**
 * Phase 9 Login Page - Professional Design
 * Split-screen layout with real-time validation
 */

import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import { MailIcon, LockIcon } from "@/components/ui/Icons";
import {
  AuthCard,
  AuthVisualPanel,
  AuthFormPanel,
  AuthFormHeader,
  AuthErrorAlert,
  AuthSuccessAlert,
} from "@/components/auth/AuthCard";
import styles from "@/components/auth/AuthCard.module.css";

export function LoginPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return") || "/map";
  const justRegistered = searchParams.get("registered") === "true";
  const prefillEmail = searchParams.get("email") || "";

  const { isAuthenticated, login, isLoading: storeLoading, error: storeError } = useAuthStore();
  const navigate = useNavigate();

  // If already authenticated, redirect directly to /map
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/map", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Form state
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update email if prefill changes
  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  // Validation state
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Validate email
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

  // Validate password
  const validatePassword = useCallback((value: string): string | null => {
    if (!value) {
      return t("auth.errors.passwordRequired") || t("auth.errors.required") || "Vui lòng nhập mật khẩu";
    }
    if (value.length < 8) {
      return t("auth.errors.passwordMinLength") || "Mật khẩu phải có ít nhất 8 ký tự";
    }
    return null;
  }, [t]);

  // Handle input changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailTouched || emailError) {
      setEmailError(validateEmail(value));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (passwordTouched || passwordError) {
      setPasswordError(validatePassword(value));
    }
  };

  // Handle blur
  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setEmailTouched(true);
    setPasswordTouched(true);

    if (emailErr || passwordErr) {
      return;
    }

    setIsLoading(true);

    try {
      await login({ email, password });
      navigate(returnUrl, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("auth.errors.loginFailed") || "Email hoặc mật khẩu không đúng"));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if form is valid
  const isFormValid = !emailError && !passwordError && email.length > 0 && password.length > 0;

  return (
    <AuthCard>
      {/* Left Visual Panel - Pure Vietnam Map */}
      <AuthVisualPanel />

      {/* Right Form Panel */}
      <AuthFormPanel>
        {/* Auth Switcher Tabs */}
        <div className={styles.authTabs}>
          <span className={`${styles.authTab} ${styles.authTabActive}`}>
            {t("auth.login") || "Đăng nhập"}
          </span>
          <Link to="/register" className={styles.authTab}>
            {t("auth.register") || "Đăng ký"}
          </Link>
        </div>

        <AuthFormHeader
          title={t("auth.loginTitle") || "Chào mừng trở lại"}
          subtitle={t("auth.loginSubtitle") || "Đăng nhập để xem dự báo chi tiết và lộ trình thông minh"}
        />

        {/* Success Alert if just registered */}
        {justRegistered && (
          <AuthSuccessAlert
            title="Đăng ký thành công!"
            message="Tài khoản của bạn đã được xác minh thành công. Vui lòng nhập mật khẩu để đăng nhập."
          />
        )}

        {/* Error Alert */}
        {(error || storeError) && (
          <AuthErrorAlert
            title={t("common.error") || "Lỗi"}
            message={error || storeError || ""}
          />
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
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
                <MailIcon size={20} />
              }
              autoComplete="email"
              required
            />

            <Input
              id="password"
              type="password"
              label={t("auth.password") || "Mật khẩu"}
              placeholder="••••••••"
              value={password}
              onChange={handlePasswordChange}
              onBlur={handlePasswordBlur}
              error={passwordError || undefined}
              togglePasswordVisibility
              leftIcon={
                <LockIcon size={20} />
              }
              autoComplete="current-password"
              required
            />
          </div>

          {/* Remember Me & Forgot Password */}
          <div className={styles.optionsRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>{t("auth.rememberMe") || "Ghi nhớ đăng nhập"}</span>
            </label>
            <Link to="/forgot-password" className={styles.forgotLink}>
              {t("auth.forgotPassword") || "Quên mật khẩu?"}
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading || storeLoading}
            disabled={!isFormValid && (emailTouched || passwordTouched)}
          >
            {t("auth.login") || "Đăng nhập"}
          </Button>
        </form>

        {/* Register Link */}
        <div className={styles.links}>
          <span>{t("auth.noAccount") || "Chưa có tài khoản?"}</span>
          <Link to="/register" className={styles.linkHighlight}>
            {t("auth.register") || "Đăng ký ngay"}
          </Link>
        </div>
      </AuthFormPanel>
    </AuthCard>
  );
}
