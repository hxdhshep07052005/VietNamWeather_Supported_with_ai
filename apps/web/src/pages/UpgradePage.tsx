/**
 * Phase 9 Upgrade Page
 * Subscription plans and billing
 * Per ADR-007: Hybrid i18n approach
 */

import { useTranslation } from "react-i18next";
import styles from "./UpgradePage.module.css";

export function UpgradePage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("upgrade.title")}</h1>
        <p className={styles.subtitle}>{t("upgrade.subtitle")}</p>
      </div>

      <div className={styles.plans}>
        {/* Free Plan */}
        <div className={styles.planCard}>
          <h3 className={styles.planName}>{t("landing.planFree")}</h3>
          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>0</span>
            <span className={styles.period}>{t("landing.perMonth")}</span>
          </div>
          <ul className={styles.planFeatures}>
            <li>{t("landing.featureCurrentWeather")}</li>
            <li>{t("landing.featureWeatherMap")}</li>
            <li>{t("landing.featureBasicRisk")}</li>
            <li>{t("landing.feature10Queries")}</li>
          </ul>
          <div className={styles.planCurrent}>
            <span className={styles.currentBadge}>{t("upgrade.current")}</span>
          </div>
        </div>

        {/* Pro Plan */}
        <div className={`${styles.planCard} ${styles.planCardPro}`}>
          <div className={styles.popularBadge}>{t("landing.popular")}</div>
          <h3 className={styles.planName}>{t("landing.planPro")}</h3>
          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>99,000</span>
            <span className={styles.period}>{t("landing.perMonth")}</span>
          </div>
          <ul className={styles.planFeatures}>
            <li>{t("landing.featureAllFree")}</li>
            <li>{t("landing.feature72hForecast")}</li>
            <li>{t("landing.featureTrends")}</li>
            <li>{t("landing.featureAdvancedRoute")}</li>
            <li>{t("landing.featureUnlimited")}</li>
            <li>{t("upgrade.features.prioritySupport")}</li>
          </ul>
          <button className={styles.upgradeButton}>
            {t("upgrade.upgrade")}
          </button>
        </div>
      </div>
    </div>
  );
}
