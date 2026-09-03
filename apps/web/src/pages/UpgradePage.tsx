/**
 * Phase 9 Upgrade Page
 * Subscription plans and billing with instant live testing toggle
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import styles from "./UpgradePage.module.css";

export function UpgradePage() {
  const { t } = useTranslation();
  const { user, setPlan } = useAuthStore();
  const isPro = user?.plan === "pro";
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUpgradeToPro = () => {
    setPlan("pro");
    showToast("🎉 Chúc mừng bạn đã nâng cấp thành công gói PRO! Tất cả tính năng cao cấp đã được mở khóa.");
  };

  const handleDowngradeToFree = () => {
    setPlan("free");
    showToast("Đã chuyển tài khoản về gói Miễn phí để kiểm thử.");
  };

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 205, 0, 0.4)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Quick Test Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "12px 20px",
          background: "rgba(0, 102, 204, 0.08)",
          border: "1px solid rgba(0, 102, 204, 0.25)",
          borderRadius: "12px",
          marginBottom: "24px",
          fontSize: "13px",
        }}
      >
        <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
          🛠️ <strong>Chế độ kiểm thử nhanh:</strong> Trạng thái tài khoản hiện tại:{" "}
          <strong style={{ color: isPro ? "#FFCD00" : "#94A3B8" }}>
            {isPro ? "👑 GÓI PRO CAO CẤP" : "⚡ GÓI MIỄN PHÍ"}
          </strong>
        </span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleUpgradeToPro}
            disabled={isPro}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid #FFCD00",
              background: isPro ? "rgba(255, 205, 0, 0.2)" : "linear-gradient(135deg, #FFCD00, #F59E0B)",
              color: isPro ? "#FFCD00" : "#0F172A",
              fontSize: "12px",
              fontWeight: 700,
              cursor: isPro ? "default" : "pointer",
            }}
          >
            {isPro ? "✓ Đang là PRO" : "Chuyển sang PRO 👑"}
          </button>

          <button
            type="button"
            onClick={handleDowngradeToFree}
            disabled={!isPro}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: !isPro ? "default" : "pointer",
              opacity: !isPro ? 0.6 : 1,
            }}
          >
            Chuyển về FREE ⚡
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>{t("upgrade.title") || "Nâng Cấp Gói Dịch Vụ"}</h1>
        <p className={styles.subtitle}>
          {t("upgrade.subtitle") || "Mở khóa toàn bộ dữ liệu dự báo dài hạn và công cụ dẫn đường thời tiết thông minh"}
        </p>
      </div>

      <div className={styles.plans}>
        {/* Free Plan Card */}
        <div className={styles.planCard}>
          <h3 className={styles.planName}>{t("landing.planFree") || "Gói Miễn Phí"}</h3>
          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>0</span>
            <span className={styles.period}>/ tháng</span>
          </div>

          <ul className={styles.planFeatures}>
            <li>Thời tiết hiện tại cho 63 tỉnh thành Việt Nam</li>
            <li>Bản đồ thời tiết tương tác cơ bản</li>
            <li>Dự báo chi tiết 3 ngày (72 giờ) theo từng giờ</li>
            <li>Đánh giá rủi ro cơ bản 4 chiều</li>
            <li>Tìm kiếm lộ trình cơ bản (3 lượt/ngày)</li>
            <li>Lưu tối đa 3 địa điểm yêu thích</li>
            <li>Lưu 1 lộ trình di chuyển</li>
          </ul>

          <div className={styles.planCurrent}>
            {!isPro ? (
              <span className={styles.currentBadge}>Gói hiện tại của bạn</span>
            ) : (
              <button
                type="button"
                onClick={handleDowngradeToFree}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-raised)",
                  color: "var(--color-text-secondary)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Chuyển về gói Miễn phí (Test)
              </button>
            )}
          </div>
        </div>

        {/* Pro Plan Card */}
        <div className={`${styles.planCard} ${styles.planCardPro}`}>
          <div className={styles.popularBadge}>{t("landing.popular") || "ĐƯỢC KHUYÊN DÙNG"}</div>
          <h3 className={styles.planName}>
            <span>👑 </span>
            {t("landing.planPro") || "Gói PRO Cao Cấp"}
          </h3>
          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>99,000</span>
            <span className={styles.period}>/ tháng</span>
          </div>

          <ul className={styles.planFeatures}>
            <li><strong>Bao gồm toàn bộ tính năng của gói Free</strong></li>
            <li><strong>Dự báo dài hạn 7 - 14 ngày</strong> & phân tích xu hướng</li>
            <li><strong>Đánh giá rủi ro 6 chiều toàn diện</strong> (kèm Sấm sét & UV)</li>
            <li><strong>So sánh đồng thời 3 lộ trình:</strong> Nhanh nhất, Ngắn nhất, An toàn thời tiết nhất</li>
            <li><strong>Hỗ trợ xe máy & ô tô</strong> với cảnh báo gió tạt, đường trơn</li>
            <li><strong>30 lượt tìm lộ trình/ngày</strong> (thay vì 3)</li>
            <li><strong>Lưu tối đa 50 địa điểm</strong> & 20 lộ trình di chuyển</li>
            <li><strong>Radar vệ tinh thời gian thực</strong> & bản đồ nhiệt rủi ro</li>
            <li>Hỗ trợ ưu tiên 24/7</li>
          </ul>

          <div className={styles.planCurrent}>
            {isPro ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "12px",
                  background: "rgba(255, 205, 0, 0.2)",
                  border: "1px solid #FFCD00",
                  borderRadius: "10px",
                  color: "#FFCD00",
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                👑 Gói hiện tại của bạn (Đã mở khóa)
              </span>
            ) : (
              <button
                type="button"
                className={styles.upgradeButton}
                onClick={handleUpgradeToPro}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #FFCD00, #F59E0B)",
                  color: "#0F172A",
                  fontWeight: 800,
                }}
              >
                Nâng cấp lên PRO ngay (99.000₫)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
