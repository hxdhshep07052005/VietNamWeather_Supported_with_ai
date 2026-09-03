/**
 * Phase 9 Register Page - Professional Design
 * Split-screen layout with password strength indicator
 */

import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
} from "@/components/auth/AuthCard";
import styles from "@/components/auth/AuthCard.module.css";

export function RegisterPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");

  const { isAuthenticated, register, isLoading: storeLoading, error: storeError } = useAuthStore();
  const navigate = useNavigate();

  // If already authenticated, redirect to /map
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/map", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Validate name
  const validateName = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return t("auth.errors.nameRequired") || t("auth.errors.required") || "Vui lòng nhập họ và tên";
    }
    if (trimmed.length < 2) {
      return t("auth.errors.nameMinLength") || "Họ và tên phải có ít nhất 2 ký tự";
    }
    return null;
  }, [t]);

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
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return t("auth.errors.passwordComplexity") || "Mật khẩu cần ít nhất 1 chữ hoa, 1 chữ thường và 1 số";
    }
    return null;
  }, [t]);

  // Validate password confirmation
  const validateConfirm = useCallback((value: string, passValue: string): string | null => {
    if (!value) {
      return t("auth.errors.confirmRequired") || t("auth.errors.required") || "Vui lòng xác nhận lại mật khẩu";
    }
    if (value !== passValue) {
      return t("auth.errors.passwordMismatch") || "Mật khẩu xác nhận không khớp";
    }
    return null;
  }, [t]);

  // Get password strength
  const getPasswordStrength = useCallback((pass: string) => {
    if (!pass) return { score: 0, level: "none" as const, label: "" };

    let score = 0;
    const checks = {
      length: pass.length >= 8,
      length12: pass.length >= 12,
      lowercase: /[a-z]/.test(pass),
      uppercase: /[A-Z]/.test(pass),
      number: /\d/.test(pass),
      special: /[^a-zA-Z0-9]/.test(pass),
    };

    if (checks.length) score++;
    if (checks.length12) score++;
    if (checks.lowercase && checks.uppercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;

    const level = score <= 2 ? "weak" : score <= 3 ? "medium" : "strong";
    const labels: Record<string, string> = {
      weak: t("common.weak") || "Yếu",
      medium: t("common.medium") || "Trung bình",
      strong: t("common.strong") || "Mạnh",
    };

    return { score: Math.min(score, 4), level, label: labels[level] };
  }, [t]);

  const passwordStrength = getPasswordStrength(password);

  // Handle input changes with real-time error clearing
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (nameTouched || nameError) {
      setNameError(validateName(value));
    }
  };

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
    // Re-validate confirm if touched or errored
    if (confirmTouched || confirmError) {
      setConfirmError(validateConfirm(confirmPassword, value));
    }
  };

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmTouched || confirmError) {
      setConfirmError(validateConfirm(value, password));
    }
  };

  // Handle blur
  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(validateName(name));
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  };

  const handleConfirmBlur = () => {
    setConfirmTouched(true);
    setConfirmError(validateConfirm(confirmPassword, password));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    const confirmErr = validateConfirm(confirmPassword, password);

    setNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setConfirmError(confirmErr);
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (nameErr || emailErr || passwordErr || confirmErr) {
      return;
    }

    if (!acceptTerms) {
      setError(t("auth.errors.termsRequired") || "Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({ email, password, name: name || undefined });

      if (result.requiresVerification) {
        // Navigate to OTP verification page
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&token=${result.tempToken}`);
      } else {
        navigate("/map");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("auth.errors.emailExists") || "Email đã được sử dụng"));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if form is valid
  const isFormValid =
    !emailError &&
    !passwordError &&
    !confirmError &&
    email.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    acceptTerms &&
    passwordStrength.level !== "weak";

  return (
    <AuthCard>
      {/* Left Visual Panel - Pure Vietnam Map */}
      <AuthVisualPanel />

      {/* Right Form Panel */}
      <AuthFormPanel>
        {/* Auth Switcher Tabs */}
        <div className={styles.authTabs}>
          <Link to="/login" className={styles.authTab}>
            {t("auth.login") || "Đăng nhập"}
          </Link>
          <span className={`${styles.authTab} ${styles.authTabActive}`}>
            {t("auth.register") || "Đăng ký"}
          </span>
        </div>

        <AuthFormHeader
          title={t("auth.registerTitle") || "Tạo tài khoản"}
          subtitle={
            planParam === "pro"
              ? (t("upgrade.subscribe") || "Đăng ký Pro để mở khóa mọi tính năng")
              : (t("auth.registerSubtitle") || "Đăng ký miễn phí để bắt đầu")
          }
        />

        {/* Error Alert */}
        {(error || storeError) && (
          <AuthErrorAlert
            title={t("common.error") || "Lỗi"}
            message={error || storeError || ""}
          />
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <Input
              id="name"
              type="text"
              label={t("auth.fullName") || "Họ và tên"}
              placeholder="Nguyễn Văn A / John Doe"
              value={name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              error={nameError || undefined}
              optional
              leftIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              autoComplete="name"
            />

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
              showPasswordStrength
              helperText={t("auth.errors.passwordMinLength") || "Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số"}
              leftIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              }
              autoComplete="new-password"
              required
            />

            <Input
              id="confirmPassword"
              type="password"
              label={t("auth.confirmPassword") || "Xác nhận mật khẩu"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={handleConfirmChange}
              onBlur={handleConfirmBlur}
              error={confirmError || undefined}
              togglePasswordVisibility
              leftIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                  <polyline points="9 15 11 17 15 13" />
                </svg>
              }
              autoComplete="new-password"
              required
            />
          </div>

          {/* Terms Checkbox */}
          <div className={styles.termsRow}>
            <input
              type="checkbox"
              id="acceptTerms"
              className={styles.termsCheckbox}
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <label htmlFor="acceptTerms" className={styles.termsText}>
              {t("auth.agreeToTerms") || "Tôi đồng ý với"}{" "}
              <Link to="/legal/terms" target="_blank">
                {t("auth.termsOfService") || "Điều khoản sử dụng"}
              </Link>{" "}
              {t("auth.and") || "và"}{" "}
              <Link to="/legal/privacy" target="_blank">
                {t("auth.privacyPolicy") || "Chính sách bảo mật"}
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading || storeLoading}
            disabled={!isFormValid && (emailTouched || passwordTouched || confirmTouched)}
          >
            {planParam === "pro"
              ? (t("upgrade.subscribe") || "Đăng ký Pro")
              : (t("auth.register") || "Tạo tài khoản")}
          </Button>
        </form>

        {/* Login Link */}
        <div className={styles.links}>
          <span>{t("auth.hasAccount") || "Đã có tài khoản?"}</span>
          <Link to="/login" className={styles.linkHighlight}>
            {t("auth.login") || "Đăng nhập ngay"}
          </Link>
        </div>
      </AuthFormPanel>
    </AuthCard>
  );
}
