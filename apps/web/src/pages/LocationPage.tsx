/**
 * Phase 9 Location Detail Page
 * Weather details and forecast for a specific location
 * Per ADR-007: Hybrid i18n approach
 */

import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./LocationPage.module.css";

export function LocationPage() {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("location.title")}</h1>
        <span className={styles.locationId}>ID: {id}</span>
      </div>

      <div className={styles.content}>
        {/* Current Weather Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("location.currentWeather")}</h2>
          <div className={styles.weatherCard}>
            <div className={styles.weatherMain}>
              <div className={styles.temperature}>--°C</div>
              <div className={styles.condition}>{t("common.loading")}</div>
            </div>
            <div className={styles.weatherDetails}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t("location.humidity")}</span>
                <span className={styles.detailValue}>--%</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t("location.wind")}</span>
                <span className={styles.detailValue}>-- km/h</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t("location.visibility")}</span>
                <span className={styles.detailValue}>-- km</span>
              </div>
            </div>
          </div>
        </section>

        {/* Risk Assessment Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("location.riskAssessment")}</h2>
          <div className={styles.riskCard}>
            <p>{t("common.loading")} - Risk Assessment</p>
          </div>
        </section>
      </div>
    </div>
  );
}
