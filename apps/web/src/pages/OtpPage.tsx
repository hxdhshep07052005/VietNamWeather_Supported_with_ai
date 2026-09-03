/**
 * OTP Verification Page
 * 6-digit OTP verification after registration
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { AuthCard, AuthVisualPanel, AuthFormPanel } from "@/components/auth/AuthCard";
import styles from "./OtpPage.module.css";

export function OtpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp, resetPasswordWithOtp, error: authError } = useAuthStore();

  const type = (searchParams.get("type") || "register") as "register" | "forgot-password";
  const isForgotPassword = type === "forgot-password";

  // Get email from URL params (passed from register or forgot-password page)
  const email = searchParams.get("email") || localStorage.getItem("pending_verification_email") || "";
  const tempToken = searchParams.get("token") || localStorage.getItem("pending_verification_token") || "";

  // OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Password reset fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Refs for OTP inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle digit input
  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // Only allow numbers
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered (only for register flow where no password is required)
    if (!isForgotPassword && newOtp.every((digit) => digit !== "") && index === 5) {
      handleVerify(newOtp.join(""));
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      digits.forEach((digit, index) => {
        if (inputRefs.current[index]) {
          inputRefs.current[index]!.value = digit;
        }
      });
      if (!isForgotPassword) {
        handleVerify(pastedData);
      }
    } else {
      const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length > 0) {
        const newOtp = [...otp];
        digits.forEach((digit, index) => {
          newOtp[index] = digit;
        });
        setOtp(newOtp);
        const lastIndex = Math.min(digits.length - 1, 5);
        setTimeout(() => inputRefs.current[lastIndex]?.focus(), 0);
      }
    }
  }, [isForgotPassword]);

  // Handle verify OTP
  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");
    if (code.length !== 6) {
      setError(t("auth.errors.otpRequired") || "Vui lòng nhập đầy đủ 6 chữ số");
      return;
    }

    if (isForgotPassword) {
      if (!newPassword) {
        setPasswordError("Vui lòng nhập mật khẩu mới");
        return;
      }
      if (newPassword.length < 8) {
        setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Mật khẩu xác nhận không khớp");
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      if (isForgotPassword) {
        await resetPasswordWithOtp({ email, code, newPassword });
        setIsSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      } else {
        await verifyOtp({ email, token: tempToken, code });
        setIsSuccess(true);
        // Clear pending verification data
        localStorage.removeItem("pending_verification_email");
        localStorage.removeItem("pending_verification_token");
        // Redirect to login page with prefilled email and success indicator
        setTimeout(() => {
          navigate(`/login?registered=true&email=${encodeURIComponent(email)}`, { replace: true });
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("auth.errors.otpInvalid") || "Mã OTP không hợp lệ hoặc đã hết hạn"));
      // Clear inputs on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await resendOtp({ email, type });
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("auth.errors.resendFailed") || "Không thể gửi lại mã"));
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
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className={styles.successTitle}>
              {isForgotPassword ? "Đặt lại mật khẩu thành công!" : (t("common.success") || "Xác minh thành công!")}
            </h1>
            <p className={styles.successMessage2}>
              {isForgotPassword
                ? "Mật khẩu của bạn đã được cập nhật thành công. Đang chuyển về trang đăng nhập..."
                : "Tài khoản của bạn đã được xác minh thành công. Đang chuyển về trang đăng nhập..."}
            </p>
            <Link to="/login" replace className={styles.backLink} style={{ marginTop: "var(--space-6)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              {t("auth.backToLogin") || "Đến trang đăng nhập"}
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
        <div className={styles.formHeader}>
          <h1 className={styles.title}>
            {isForgotPassword ? "Đặt lại mật khẩu" : (t("auth.verifyEmail") || "Xác minh Email")}
          </h1>
          <p className={styles.subtitle}>
            {isForgotPassword
              ? "Nhập mã 6 chữ số và mật khẩu mới cho tài khoản"
              : (t("auth.enter6DigitCode") || "Nhập mã 6 chữ số đã được gửi đến")}
            <br />
            <span className={styles.emailHighlight}>{email || "email@example.com"}</span>
          </p>
        </div>

        {/* Error Alert */}
        {(error || authError) && (
          <div className={styles.errorMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error || authError}
          </div>
        )}

        {/* OTP Input */}
        <div className={styles.otpContainer}>
          <label className={styles.otpLabel}>{t("auth.otpLabel") || "Nhập mã OTP 6 số"}</label>
          <div className={styles.otpInputs}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={styles.otpInput}
                disabled={isLoading || isSuccess}
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </div>

        {/* Password Reset Fields if type === forgot-password */}
        {isForgotPassword && (
          <div className={styles.passwordFields}>
            <div className={styles.passwordField}>
              <label className={styles.passwordLabel}>Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Tối thiểu 8 ký tự"
                className={styles.passwordInput}
                disabled={isLoading || isSuccess}
              />
            </div>
            <div className={styles.passwordField}>
              <label className={styles.passwordLabel}>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Nhập lại mật khẩu mới"
                className={styles.passwordInput}
                disabled={isLoading || isSuccess}
              />
            </div>
            {passwordError && (
              <div className={styles.errorMessage} style={{ marginTop: 0 }}>
                {passwordError}
              </div>
            )}
          </div>
        )}

        {/* Timer & Resend */}
        <div className={styles.timer}>
          {resendCooldown > 0 ? (
            <>
              {t("auth.resendIn") || "Gửi lại mã sau"} <span className={styles.timerValue}>{resendCooldown}s</span>
            </>
          ) : (
            <button
              type="button"
              className={styles.resendButton}
              onClick={handleResend}
              disabled={isLoading}
            >
              {t("auth.resendCode") || "Gửi lại mã"}
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          className={styles.submitButton}
          onClick={() => handleVerify()}
          disabled={isLoading || otp.join("").length < 6}
        >
          {isLoading ? (
            <>
              <span className={styles.loadingSpinner} />
              {isForgotPassword ? "Đang cập nhật..." : (t("common.verifying") || "Đang xác minh...")}
            </>
          ) : (
            isForgotPassword ? "Cập nhật mật khẩu" : (t("common.verify") || "Xác minh")
          )}
        </button>

        {/* Back Link */}
        <Link to={isForgotPassword ? "/login" : "/register"} className={styles.backLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {isForgotPassword ? "Quay lại đăng nhập" : (t("auth.backToRegister") || "Quay lại đăng ký")}
        </Link>
      </AuthFormPanel>
    </AuthCard>
  );
}
