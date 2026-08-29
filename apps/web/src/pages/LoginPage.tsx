/**
 * Phase 9 Login Page - Professional Design
 * Split-screen layout with real-time validation
 */

import { useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import { WeatherIcon, RiskIcon, RouteIcon, MailIcon, LockIcon } from "@/components/ui/Icons";
import {
  AuthCard,
  AuthVisualPanel,
  AuthFormPanel,
  AuthFormHeader,
  AuthErrorAlert,
} from "@/components/auth/AuthCard";
import styles from "@/components/auth/AuthCard.module.css";

export function LoginPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return") || "/map";

  const { login, isLoading: storeLoading, error: storeError } = useAuthStore();
  const navigate = useNavigate();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation state
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Validate email
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

  // Validate password
  const validatePassword = useCallback((value: string): string | null => {
    if (!value) {
      return t("auth.errors.required") || "Trường này là bắt buộc";
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
    if (emailTouched) {
      setEmailError(validateEmail(value));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (passwordTouched) {
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
      navigate(returnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("auth.errors.loginFailed") || "Email hoặc mật khẩu không đúng"));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if form is valid
  const isFormValid = !emailError && !passwordError && email.length > 0 && password.length > 0;

  // Visual panel features
  const features = [
    {
      icon: <WeatherIcon size={20} />,
      text: t("landing.featureAccurateForecast") || "Dự báo chính xác với độ phủ toàn quốc",
    },
    {
      icon: <RiskIcon size={20} />,
      text: t("landing.featureRiskAssessment") || "Đánh giá rủi ro 6 chiều",
    },
    {
      icon: <RouteIcon size={20} />,
      text: t("landing.featureRoutePlanning") || "Lập kế hoạch lộ trình thông minh",
    },
  ];

  return (
    <AuthCard>
      {/* Left Visual Panel */}
      <AuthVisualPanel
        tagline={t("landing.heroSubtitle") || "Đưa ra quyết định du lịch thông minh với thời tiết"}
        features={features}
      />

      {/* Right Form Panel */}
      <AuthFormPanel>
        <AuthFormHeader
          title={t("auth.loginTitle") || "Chào mừng trở lại"}
          subtitle={t("auth.loginSubtitle") || "Đăng nhập để truy cập dịch vụ"}
        />

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
