/**
 * Phase 9 Terms of Service Page
 * Per ADR-007: Hybrid i18n approach
 */

import { useTranslation } from "react-i18next";
import styles from "./LegalPages.module.css";

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("footer.terms")}</h1>
      <div className={styles.content}>
        <p>{t("common.loading")} - Terms of Service</p>
      </div>
    </div>
  );
}
