import type { ReactNode } from "react";
import { VietnamMap } from "../common/VietnamMap";
import styles from "./AuthCard.module.css";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <section className={`${styles.authPage} ${className || ""}`}>
      {/* Ambient background glow spheres matching homepage hero */}
      <div className={styles.ambientGlow1} />
      <div className={styles.ambientGlow2} />

      <div className={styles.container}>
        <div className={styles.authGrid}>
          {children}
        </div>
      </div>
    </section>
  );
}

// Visual Panel with Interactive Vietnam Map - Pure Minimalist
export interface VisualPanelProps {
  tagline?: string;
  features?: Array<{
    icon: ReactNode;
    text: string;
  }>;
}

export function AuthVisualPanel({ tagline, features }: VisualPanelProps = {}) {
  return (
    <div className={styles.visualPanel}>
      {/* Pure Vietnam Map - No duplicate logo since header already has it */}
      <div className={styles.authMapWrapper}>
        <div className={styles.ambientBackdrop} />
        <VietnamMap
          className={styles.authVietnamMap}
          interactive={true}
          showcaseMode={false}
          hideLegend={true}
          viewMode="region"
        />
      </div>

      {/* Optional Tagline/Features if explicitly passed */}
      {tagline && features && features.length > 0 && (
        <div className={styles.visualFooter}>
          <p className={styles.tagline}>{tagline}</p>
          <div className={styles.features}>
            {features.map((feature, index) => (
              <div key={index} className={styles.feature}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <span className={styles.featureText}>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Form Panel wrapper
interface FormPanelProps {
  children: ReactNode;
  className?: string;
}

export function AuthFormPanel({ children, className }: FormPanelProps) {
  return (
    <div className={styles.formPanel}>
      <div className={`${styles.formContainer} ${className || ""}`}>
        {children}
      </div>
    </div>
  );
}

// Error Alert component
interface ErrorAlertProps {
  title?: string;
  message: string;
}

export function AuthErrorAlert({ title, message }: ErrorAlertProps) {
  return (
    <div className={styles.errorAlert} role="alert">
      <div className={styles.errorAlertIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className={styles.errorAlertContent}>
        {title && <div className={styles.errorAlertTitle}>{title}</div>}
        <div className={styles.errorAlertMessage}>{message}</div>
      </div>
    </div>
  );
}

// Success Alert component
interface SuccessAlertProps {
  title?: string;
  message: string;
}

export function AuthSuccessAlert({ title, message }: SuccessAlertProps) {
  return (
    <div className={styles.successAlert} role="status">
      <div className={styles.successAlertIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div className={styles.successAlertContent}>
        {title && <div className={styles.successAlertTitle}>{title}</div>}
        <div>{message}</div>
      </div>
    </div>
  );
}

// Form Header component
interface FormHeaderProps {
  title: string;
  subtitle?: string;
}

export function AuthFormHeader({ title, subtitle }: FormHeaderProps) {
  return (
    <div className={styles.formHeader}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
