/**
 * AuthCard Component
 * Split-screen authentication with 3D weather visualization
 */

import type { ReactNode } from "react";
import { WeatherIcon } from "../ui/Icons";
import styles from "./AuthCard.module.css";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div className={`${styles.page} ${className || ""}`}>
      {children}
    </div>
  );
}

// Visual Panel with 3D Weather Effect
interface VisualPanelProps {
  tagline: string;
  features: Array<{
    icon: ReactNode;
    text: string;
  }>;
}

export function AuthVisualPanel({ tagline, features }: VisualPanelProps) {
  return (
    <div className={styles.visualPanel}>
      {/* Floating particles */}
      <div className={styles.particles}>
        {[...Array(10)].map((_, i) => (
          <div key={i} className={styles.particle} />
        ))}
      </div>

      <div className={styles.visualContent}>
        {/* 3D Weather Visualization */}
        <div className={styles.weatherVisual}>
          <div className={styles.weatherOrb}>
            <div className={styles.weatherOrbInner} />

            {/* Clouds */}
            <div className={styles.cloudLayer} />
            <div className={styles.cloudLayer} />
            <div className={styles.cloudLayer} />

            {/* Sun */}
            <div className={styles.sunInOrb} />

            {/* Rain drops */}
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />
            <div className={styles.rainDrop} />

            {/* Orbit rings */}
            <div className={styles.orbitRing} />
            <div className={styles.orbitRing} />
            <div className={styles.orbitRing} />
          </div>
        </div>

        {/* Brand - Same as header */}
        <div className={styles.brandMark}>
          <div className={styles.brandLogo}>
            <WeatherIcon size={32} />
          </div>
          <span className={styles.brandName}>VietnamWeather AI</span>
        </div>

        {/* Tagline */}
        <p className={styles.tagline}>{tagline}</p>

        {/* Features */}
        <div className={styles.features}>
          {features.map((feature, index) => (
            <div key={index} className={styles.feature}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <span className={styles.featureText}>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
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
  showMobileLogo?: boolean;
}

export function AuthFormHeader({ title, subtitle, showMobileLogo = true }: FormHeaderProps) {
  return (
    <div className={styles.formHeader}>
      {showMobileLogo && (
        <div className={styles.logoMobile}>
          <div className={styles.logoIconMobile}>
            <WeatherIcon size={24} />
          </div>
          <span className={styles.logoTextMobile}>VietnamWeather AI</span>
        </div>
      )}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
