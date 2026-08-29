/**
 * OTP Verification Page
 * 6-digit OTP verification after registration
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import styles from "./OtpPage.module.css";

export function OtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp, error: authError } = useAuthStore();

  // Get email from URL params (passed from register page)
  const email = searchParams.get("email") || localStorage.getItem("pending_verification_email") || "";
  const tempToken = searchParams.get("token") || localStorage.getItem("pending_verification_token") || "";

  // OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Refs for OTP inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when all digits entered
  useEffect(() => {
    const fullOtp = otp.join("");
    if (fullOtp.length === 6 && !otp.includes("")) {
      handleVerify(fullOtp);
    }
  }, [otp]);

  // Focus first empty input on mount
  useEffect(() => {
    const firstEmptyIndex = otp.findIndex((digit) => digit === "");
    if (firstEmptyIndex !== -1) {
      inputRefs.current[firstEmptyIndex]?.focus();
    }
  }, []);

  // Handle input change
  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    setError(null);
    setOtp((prev) => {
      const newOtp = [...prev];
      newOtp[index] = digit;

      // Auto-focus next input
      if (digit && index < 5) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
      }

      return newOtp;
    });
  }, []);

  // Handle key down (backspace, arrow keys)
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setOtp((prev) => {
        const newOtp = [...prev];
        if (newOtp[index]) {
          newOtp[index] = "";
        } else if (index > 0) {
          newOtp[index - 1] = "";
          setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
        }
        return newOtp;
      });
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Paste") {
      // @ts-expect-error clipboardData exists on window in browsers
      const pastedData = e.clipboardData?.getData("text") || (window as Window & { clipboardData?: DataTransfer | null }).clipboardData?.getData("text") || "";
      const pastedDigits = pastedData.replace(/\D/g, "").slice(0, 6);
      if (pastedDigits) {
        setOtp((prev) => {
          const newOtp = [...prev];
          pastedDigits.split("").forEach((digit: string, i: number) => {
            if (i < 6) newOtp[i] = digit;
          });
          return newOtp;
        });
        const lastIndex = Math.min(pastedDigits.length - 1, 5);
        setTimeout(() => inputRefs.current[lastIndex]?.focus(), 0);
      }
    }
  }, []);

  // Handle verify OTP
  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");
    if (code.length !== 6) {
      setError("Vui lòng nhập đầy đủ 6 chữ số / Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await verifyOtp({ email, token: tempToken, code });
      setIsSuccess(true);
      // Clear pending verification data
      localStorage.removeItem("pending_verification_email");
      localStorage.removeItem("pending_verification_token");
      // Redirect to map after 2 seconds
      setTimeout(() => navigate("/map"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mã OTP không hợp lệ / Invalid OTP code");
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
      await resendOtp({ email });
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi lại mã / Unable to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className={styles.page}>
        <VisualPanel />
        <div className={styles.formPanel}>
          <div className={styles.formContainer}>
            <div className={styles.successState}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 className={styles.successTitle}>Xác minh thành công!</h1>
              <p className={styles.successMessage2}>
                Tài khoản của bạn đã được xác minh. Đang chuyển hướng đến trang chính...
                <br />
                <span style={{ opacity: 0.7 }}>Your account has been verified. Redirecting...</span>
              </p>
              <Link to="/map" className={styles.backLink} style={{ marginTop: "var(--space-6)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Đi đến trang chủ / Go to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <VisualPanel />
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          {/* Mobile Logo */}
          <div className={styles.logoMobile}>
            <div className={styles.logoIconMobile}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="4" fill="white" />
              </svg>
            </div>
            <span className={styles.logoTextMobile}>VietnamWeather AI</span>
          </div>

          <div className={styles.formHeader}>
            <h1 className={styles.title}>Xác minh Email</h1>
            <p className={styles.subtitle}>
              Nhập mã 6 chữ số đã được gửi đến
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
            <label className={styles.otpLabel}>Nhập mã OTP / Enter OTP code</label>
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
                  className={styles.otpInput}
                  disabled={isLoading || isSuccess}
                  autoComplete="one-time-code"
                />
              ))}
            </div>
          </div>

          {/* Timer & Resend */}
          <div className={styles.timer}>
            {resendCooldown > 0 ? (
              <>
                Gửi lại mã sau <span className={styles.timerValue}>{resendCooldown}s</span>
              </>
            ) : (
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResend}
                disabled={isLoading}
              >
                Gửi lại mã / Resend code
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
                Đang xác minh...
              </>
            ) : (
              "Xác minh / Verify"
            )}
          </button>

          {/* Back Link */}
          <Link to="/register" className={styles.backLink}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Quay lại đăng ký / Back to register
          </Link>
        </div>
      </div>
    </div>
  );
}

// Visual Panel Component (same as AuthCard)
function VisualPanel() {
  return (
    <div className={styles.visualPanel}>
      <div className={styles.particles}>
        {[...Array(10)].map((_, i) => (
          <div key={i} className={styles.particle} />
        ))}
      </div>

      <div className={styles.visualContent}>
        <div className={styles.weatherVisual}>
          <div className={styles.weatherOrb}>
            <div className={styles.weatherOrbInner} />
            <div className={styles.cloudLayer} />
            <div className={styles.cloudLayer} />
            <div className={styles.cloudLayer} />
            <div className={styles.sunInOrb} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.orbitRing} />
            <div className={styles.orbitRing} />
            <div className={styles.orbitRing} />
          </div>
        </div>

        <div className={styles.brandMark}>
          <div className={styles.brandLogo}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" fill="white" />
            </svg>
          </div>
          <span className={styles.brandName}>VietnamWeather AI</span>
        </div>

        <p className={styles.tagline}>
          Xác minh tài khoản của bạn để bắt đầu sử dụng dịch vụ
        </p>
      </div>
    </div>
  );
}
