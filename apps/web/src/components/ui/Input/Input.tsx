/**
 * Input Component
 * Professional input with icons, validation, and password visibility toggle
 */

import {
  forwardRef,
  useState,
  useCallback,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import clsx from "clsx";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";
export type ValidationStatus = "idle" | "success" | "error" | "warning";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Field label */
  label?: string;
  /** Show optional badge */
  optional?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Success message */
  success?: string;
  /** Warning message */
  warning?: string;
  /** Helper text */
  helperText?: string;
  /** Icon on the left */
  leftIcon?: ReactNode;
  /** Icon on the right */
  rightIcon?: ReactNode;
  /** Enable password visibility toggle */
  togglePasswordVisibility?: boolean;
  /** Show password strength indicator */
  showPasswordStrength?: boolean;
  /** Size variant */
  size?: InputSize;
  /** Input size variant */
  inputSize?: InputSize;
  /** Custom validation status */
  validationStatus?: ValidationStatus;
  /** onChange handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      optional = false,
      placeholder,
      error,
      success,
      warning,
      helperText,
      leftIcon,
      rightIcon,
      togglePasswordVisibility = false,
      showPasswordStrength = false,
      size = "md",
      type = "text",
      className,
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    // Calculate password strength
    const getPasswordStrength = useCallback((password: string) => {
      if (!password) return { score: 0, level: "none" as const };

      let score = 0;
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
      if (/\d/.test(password)) score++;
      if (/[^a-zA-Z0-9]/.test(password)) score++;

      const level = score <= 1 ? "weak" : score <= 3 ? "medium" : "strong";
      return { score: Math.min(score, 4), level: level as "weak" | "medium" | "strong" };
    }, []);

    const passwordStrength = showPasswordStrength && isPassword
      ? getPasswordStrength(String(value || ""))
      : null;

    const getValidationStatus = (): ValidationStatus => {
      if (error) return "error";
      if (success) return "success";
      if (warning) return "warning";
      return "idle";
    };

    const validationStatus = props.validationStatus || getValidationStatus();

    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!(rightIcon || togglePasswordVisibility || isPassword);

    const renderMessage = () => {
      if (error) {
        return (
          <span className={clsx(styles.message, styles.errorMessage)}>
            <svg className={styles.messageIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </span>
        );
      }
      if (success) {
        return (
          <span className={clsx(styles.message, styles.successMessage)}>
            <svg className={styles.messageIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {success}
          </span>
        );
      }
      if (warning) {
        return (
          <span className={clsx(styles.message, styles.warningMessage)}>
            <svg className={styles.messageIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {warning}
          </span>
        );
      }
      if (helperText) {
        return <span className={clsx(styles.message, styles.helperText)}>{helperText}</span>;
      }
      return null;
    };

    const renderPasswordStrength = () => {
      if (!passwordStrength || passwordStrength.level === "none") return null;

      const labels = {
        weak: "Yếu / Weak",
        medium: "Trung bình / Medium",
        strong: "Mạnh / Strong",
      };

      return (
        <div className={styles.passwordStrength}>
          <div className={styles.strengthBar}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={clsx(
                  styles.strengthSegment,
                  i <= passwordStrength.score && styles.active,
                  i <= passwordStrength.score && styles[passwordStrength.level]
                )}
              />
            ))}
          </div>
          <div className={styles.strengthLabel}>
            <span className={styles.strengthText}>{labels[passwordStrength.level]}</span>
            <span className={styles.strengthRequirement}>
              {passwordStrength.level === "weak" && "8+ ký tự / characters"}
              {passwordStrength.level === "medium" && "Cần thêm ký tự đặc biệt / special chars"}
              {passwordStrength.level === "strong" && "✓ Đủ mạnh / Strong enough"}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div
        className={clsx(
          styles.field,
          styles[size],
          validationStatus !== "idle" && styles[validationStatus],
          className
        )}
      >
        {label && (
          <label className={styles.label}>
            {label}
            {optional && <span className={styles.optional}>(Tùy chọn / Optional)</span>}
          </label>
        )}

        <div className={styles.inputWrapper}>
          <input
            ref={ref}
            type={inputType}
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            onChange={onChange}
            className={clsx(
              styles.input,
              hasLeftIcon && styles.hasLeftIcon,
              hasRightIcon && styles.hasRightIcon
            )}
            aria-invalid={validationStatus === "error"}
            aria-describedby={
              error || success || warning || helperText
                ? `${props.id || "input"}-message`
                : undefined
            }
            {...props}
          />

          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}

          {togglePasswordVisibility && isPassword && (
            <button
              type="button"
              className={styles.rightIconButton}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu / Hide password" : "Hiện mật khẩu / Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}

          {rightIcon && !togglePasswordVisibility && (
            <span className={styles.rightIcon}>{rightIcon}</span>
          )}
        </div>

        {renderMessage()}
        {renderPasswordStrength()}
      </div>
    );
  }
);

Input.displayName = "Input";
