/**
 * Phase 9 Privacy Policy Page
 * Per ADR-007: Hybrid i18n approach
 */

import { useTranslation } from "react-i18next";
import styles from "./LegalPages.module.css";

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("footer.privacy")}</h1>
      <div className={styles.content}>
        <p>{t("common.loading")} - Privacy Policy</p>
      </div>
    </div>
  );
}
