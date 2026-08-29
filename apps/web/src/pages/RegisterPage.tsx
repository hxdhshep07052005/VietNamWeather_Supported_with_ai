/**
 * Phase 9 Register Page - Professional Design
 * Split-screen layout with password strength indicator
 */

import { useState, useCallback } from "react";
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

  const { register, isLoading: storeLoading, error: storeError } = useAuthStore();
  const navigate = useNavigate();

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
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return "Mật khẩu cần chữ hoa, chữ thường và số / Password needs uppercase, lowercase and number";
    }
    return null;
  }, [t]);

  // Validate password confirmation
  const validateConfirm = useCallback((value: string, passValue: string): string | null => {
    if (!value) {
      return t("auth.errors.required") || "Trường này là bắt buộc";
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
      weak: t("risk.dangerous") || "Yếu / Weak",
      medium: "Trung bình / Medium",
      strong: "Mạnh / Strong",
    };

    return { score: Math.min(score, 4), level, label: labels[level] };
  }, [t]);

  const passwordStrength = getPasswordStrength(password);

  // Handle input changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (nameTouched) {
      setNameError(e.target.value.trim() ? null : t("auth.errors.required") || "Trường này là bắt buộc");
    }
  };

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
    // Re-validate confirm if touched
    if (confirmTouched && value !== confirmPassword) {
      setConfirmError(t("auth.errors.passwordMismatch") || "Mật khẩu xác nhận không khớp");
    } else if (confirmTouched) {
      setConfirmError(null);
    }
  };

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmTouched) {
      setConfirmError(validateConfirm(value, password));
    }
  };

  // Handle blur
  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(name.trim() ? null : t("auth.errors.required") || "Trường này là bắt buộc");
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
    const nameErr = name.trim() ? null : t("auth.errors.required") || "Trường này là bắt buộc";
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
      setError("Bạn cần đồng ý với Điều khoản sử dụng / You must accept the Terms of Service");
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

  // Visual panel features
  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
      text: t("landing.featureAccurateForecast") || "Dự báo chính xác với độ phủ toàn quốc",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      text: t("landing.featureRiskAssessment") || "Đánh giá rủi ro 6 chiều",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      ),
      text: t("landing.featureRoutePlanning") || "Lập kế hoạnh lộ trình thông minh",
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
              Tôi đồng ý với{" "}
              <Link to="/legal/terms" target="_blank">
                Điều khoản sử dụng
              </Link>{" "}
              và{" "}
              <Link to="/legal/privacy" target="_blank">
                Chính sách bảo mật
              </Link>
              / I agree to the{" "}
              <Link to="/legal/terms" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/legal/privacy" target="_blank">
                Privacy Policy
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
