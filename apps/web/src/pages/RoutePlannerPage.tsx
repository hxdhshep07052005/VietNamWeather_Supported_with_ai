/**
 * Phase 9 Route Planner Page
 * Weather-aware route planning and comparison
 * Per ADR-007: Hybrid i18n approach
 */

import { useTranslation } from "react-i18next";
import styles from "./RoutePlannerPage.module.css";

export function RoutePlannerPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("route.title")}</h1>
      </div>

      <div className={styles.content}>
        {/* Route Input Section */}
        <div className={styles.inputSection}>
          <div className={styles.routeInput}>
            <label className={styles.label}>{t("route.from")}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={t("route.from")}
            />
          </div>
          
          <div className={styles.routeInput}>
            <label className={styles.label}>{t("route.to")}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={t("route.to")}
            />
          </div>

          <button className={styles.planButton}>
            {t("route.planRoute")}
          </button>
        </div>

        {/* Route Results Placeholder */}
        <div className={styles.resultsSection}>
          <div className={styles.placeholder}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="19" r="3" />
              <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
              <circle cx="18" cy="5" r="3" />
            </svg>
            <p>{t("common.loading")}</p>
            <p className={styles.placeholderHint}>
              {t("route.planRoute")} - Coming Soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
