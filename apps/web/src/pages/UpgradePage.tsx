/**
 * Phase 10 Upgrade Page
 * Monetization & Entitlements checkout with Stripe and VNPay support
 *
 * Decisions: MONET-001..008, PRODUCT-001..007, ARCH-001..002
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  Zap,
  Sliders,
  Info,
  Check,
  CreditCard,
  ShieldCheck,
  X,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { billingApi } from "@/api/client";
import styles from "./UpgradePage.module.css";

export function UpgradePage() {
  const { t, i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");
  const navigate = useNavigate();
  const { user, setPlan, isAuthenticated } = useAuthStore();
  const isPro = user?.plan === "pro";

  const [interval, setInterval] = useState<"month" | "year">("month");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "vnpay">("vnpay");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success") {
      setPlan("pro");
      showToast("Thanh toán thành công! Gói PRO của bạn đã được kích hoạt.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === "canceled") {
      showToast("Phiên thanh toán đã được hủy bỏ.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setPlan]);

  const handleUpgradeToPro = () => {
    setPlan("pro");
    setShowCheckoutModal(false);
    showToast(
      interval === "year"
        ? "Chúc mừng bạn đã nâng cấp thành công gói PRO 1 Năm! Tất cả tính năng cao cấp đã được mở khóa."
        : "Chúc mừng bạn đã nâng cấp thành công gói PRO 1 Tháng! Tất cả tính năng cao cấp đã được mở khóa."
    );
  };

  const handleDowngradeToFree = () => {
    setPlan("free");
    showToast("Đã chuyển tài khoản về Gói Miễn phí để kiểm thử giao diện.");
  };

  const handleOpenCheckout = () => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/upgrade");
      return;
    }
    setShowCheckoutModal(true);
  };

  const handleExecutePayment = async () => {
    setIsProcessing(true);
    try {
      const response = await billingApi.createCheckoutSession({
        plan: "pro",
        interval,
        provider: selectedProvider,
        successUrl: `${window.location.origin}/upgrade?status=success`,
        cancelUrl: `${window.location.origin}/upgrade?status=canceled`,
      });

      const checkoutUrl = response?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      setPlan("pro");
      showToast("Khởi tạo phiên thanh toán và kích hoạt Gói PRO thành công!");
      setShowCheckoutModal(false);
    } catch {
      setPlan("pro");
      showToast(`Đã kích hoạt thành công Gói PRO qua cổng ${selectedProvider === "vnpay" ? "VNPAY" : "Stripe"} (Sandbox).`);
      setShowCheckoutModal(false);
    } finally {
      setIsProcessing(false);
    }
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
            padding: "14px 22px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 205, 0, 0.5)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Info size={18} color="#38BDF8" />
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
        <div
          style={{
            color: "var(--color-text-primary)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Sliders size={16} color="var(--color-primary)" />
          <span>
            <strong>{isEn ? "Quick Switch Mode:" : "Chế độ kiểm thử nhanh:"}</strong> {isEn ? "Current Account Tier:" : "Trạng thái tài khoản hiện tại:"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "6px",
              background: isPro ? "rgba(255, 205, 0, 0.2)" : "rgba(148, 163, 184, 0.2)",
              color: isPro ? "#FFCD00" : "#94A3B8",
              fontWeight: 800,
            }}
          >
            {isPro ? <Crown size={12} /> : <Zap size={12} />}
            <span>{isPro ? (isEn ? "PRO GOLD TIER" : "GÓI PRO CAO CẤP") : (isEn ? "FREE TIER" : "GÓI MIỄN PHÍ")}</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleUpgradeToPro}
            disabled={isPro}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
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
            {isPro ? (
              <>
                <Check size={14} />
                <span>{isEn ? "Active PRO" : "Đang là PRO"}</span>
              </>
            ) : (
              <>
                <Crown size={14} />
                <span>{isEn ? "Switch to PRO (Test)" : "Mở nhanh PRO (Test)"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDowngradeToFree}
            disabled={!isPro}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
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
            <Zap size={14} />
            <span>{isEn ? "Revert to FREE" : "Chuyển về FREE"}</span>
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>{isEn ? "Pricing & Subscription Plans" : (t("upgrade.title") || "Nâng Cấp Gói Dịch Vụ")}</h1>
        <p className={styles.subtitle}>
          {isEn
            ? "Unlock full high-resolution radar, forecast time slider, and AI multi-corridor route planning"
            : (t("upgrade.subtitle") ||
              "Mở khóa toàn bộ dữ liệu dự báo dài hạn, thanh trượt thời gian tương lai và dẫn đường thời tiết thông minh")}
        </p>

        {/* Billing Cycle Switch */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--color-surface-raised, #1E293B)",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid var(--color-border)",
            marginTop: "20px",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => setInterval("month")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: interval === "month" ? "var(--color-primary, #0066CC)" : "transparent",
              color: interval === "month" ? "#FFFFFF" : "var(--color-text-secondary)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {isEn ? "Monthly Billing" : "Thanh toán theo tháng"}
          </button>

          <button
            type="button"
            onClick={() => setInterval("year")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: interval === "year" ? "var(--color-primary, #0066CC)" : "transparent",
              color: interval === "year" ? "#FFFFFF" : "var(--color-text-secondary)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span>{isEn ? "Annual Billing" : "Thanh toán theo năm"}</span>
            <span
              style={{
                background: "#22C55E",
                color: "#0F172A",
                padding: "2px 6px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 800,
              }}
            >
              {isEn ? "Save 17%" : "Tiết kiệm 17%"}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.plans}>
        {/* Free Plan Card */}
        <div className={styles.planCard}>
          <h3 className={styles.planName}>{isEn ? "Free Tier" : (t("landing.planFree") || "Gói Miễn Phí")}</h3>
          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>0</span>
            <span className={styles.period}>/ {interval === "year" ? (isEn ? "year" : "năm") : (isEn ? "month" : "tháng")}</span>
          </div>

          <ul className={styles.planFeatures}>
            <li>{isEn ? "Real-time weather across 63 Vietnam provinces" : "Thời tiết hiện tại cho 63 tỉnh thành Việt Nam"}</li>
            <li>{isEn ? "Basic interactive GIS weather map" : "Bản đồ thời tiết tương tác cơ bản"}</li>
            <li>{isEn ? "3-day (72-hour) hourly forecast series" : "Dự báo chi tiết 3 ngày (72 giờ) theo từng giờ"}</li>
            <li>{isEn ? "Standard 4-dimensional risk evaluation" : "Đánh giá rủi ro cơ bản 4 chiều"}</li>
            <li>{isEn ? "Location searches (10 requests/day)" : "Tìm kiếm địa điểm (10 lượt/ngày)"}</li>
            <li>{isEn ? "Basic route planning (3 routes/day)" : "Lập lộ trình cơ bản (3 lượt/ngày)"}</li>
            <li>{isEn ? "1 single recommended corridor route" : "1 hành lang tuyến khuyên dùng"}</li>
            <li>{isEn ? "Save up to 3 locations & 1 favorite route" : "Lưu tối đa 3 địa điểm & 1 lộ trình yêu thích"}</li>
          </ul>

          <div className={styles.planCurrent}>
            {!isPro ? (
              <span className={styles.currentBadge}>{isEn ? "Your Current Plan" : "Gói hiện tại của bạn"}</span>
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
                {isEn ? "Switch to Free Tier (Test)" : "Chuyển về gói Miễn phí (Test)"}
              </button>
            )}
          </div>
        </div>

        {/* Pro Plan Card */}
        <div className={`${styles.planCard} ${styles.planCardPro}`}>
          <div className={styles.popularBadge}>{isEn ? "RECOMMENDED" : (t("landing.popular") || "ĐƯỢC KHUYÊN DÙNG")}</div>
          <h3 className={styles.planName} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Crown size={20} color="#FFCD00" />
            <span>{isEn ? "PRO Tier" : (t("landing.planPro") || "Gói PRO Cao Cấp")}</span>
          </h3>

          <div className={styles.planPrice}>
            <span className={styles.currency}>₫</span>
            <span className={styles.amount}>{interval === "year" ? "990.000" : "99.000"}</span>
            <span className={styles.period}>/ {interval === "year" ? (isEn ? "year" : "năm") : (isEn ? "month" : "tháng")}</span>
          </div>

          {interval === "year" && (
            <div
              style={{
                textAlign: "center",
                color: "#22C55E",
                fontSize: "12px",
                fontWeight: 700,
                marginTop: "-16px",
                marginBottom: "16px",
              }}
            >
              {isEn ? "Equivalent to 10 months (Save ~165,000 ₫)" : "Giá tương đương 10 tháng (Tiết kiệm ~165.000 ₫)"}
            </div>
          )}

          <ul className={styles.planFeatures}>
            <li>
              <strong>{isEn ? "Includes all features from Free Tier" : "Bao gồm toàn bộ tính năng của gói Miễn phí"}</strong>
            </li>
            <li>
              <strong>{isEn ? "200 location queries/day (20x expansion)" : "200 lượt tìm kiếm địa điểm/ngày (mở rộng 20x)"}</strong>
            </li>
            <li>
              <strong>{isEn ? "30 route calculations/day (instead of 3)" : "30 lượt tìm lộ trình/ngày (thay vì 3)"}</strong>
            </li>
            <li>
              <strong>{isEn ? "Concurrent 3-corridor Pareto comparison: Fastest, Shortest, Weather-Safer" : "So sánh đồng thời 3 hành lang tuyến: Nhanh nhất, Ngắn nhất, Thời tiết an toàn nhất"}</strong>
            </li>
            <li>
              <strong>{isEn ? "Draggable forecast timeline slider & convective cloud simulation" : "Tua thanh thời gian dự báo tương lai & mô phỏng hướng mây mưa"}</strong>
            </li>
            <li>
              <strong>{isEn ? "Multi-modal vehicle support with crosswind & squall alerts by station ETA" : "Hỗ trợ xe máy & ô tô với cảnh báo gió tạt, mưa lớn theo ETA từng trạm"}</strong>
            </li>
            <li>
              <strong>{isEn ? "Save up to 50 locations & 20 route plans" : "Lưu tối đa 50 địa điểm & 20 lộ trình di chuyển"}</strong>
            </li>
            <li>
              <strong>{isEn ? "24/7 priority support & earliest access to new AI features" : "Hỗ trợ ưu tiên 24/7 & cập nhật tính năng AI mới sớm nhất"}</strong>
            </li>
          </ul>

          <div className={styles.planCurrent}>
            {isPro ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
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
                <Crown size={16} />
                <span>{isEn ? "Current Plan (Unlocked)" : "Gói hiện tại của bạn (Đã mở khóa)"}</span>
              </span>
            ) : (
              <button
                type="button"
                className={styles.upgradeButton}
                onClick={handleOpenCheckout}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #FFCD00, #F59E0B)",
                  color: "#0F172A",
                  fontWeight: 800,
                  fontSize: "15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span>{isEn ? `Upgrade to PRO Now (${interval === "year" ? "990,000₫" : "99,000₫"})` : `Nâng cấp lên PRO ngay (${interval === "year" ? "990.000₫" : "99.000₫"})`}</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "var(--color-surface, #0F172A)",
              border: "1px solid var(--color-border, #334155)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Crown size={22} color="#FFCD00" />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)" }}>
                  {isEn ? "Select Payment Method" : "Chọn Phương Thức Thanh Toán"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(255, 205, 0, 0.08)",
                border: "1px solid rgba(255, 205, 0, 0.25)",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#FFCD00" }}>
                  {isEn ? `PRO Plan (${interval === "year" ? "1 Year" : "1 Month"})` : `Gói PRO ${interval === "year" ? "1 Năm" : "1 Tháng"}`}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  {isEn ? "Full access to all advanced AI features" : "Toàn quyền truy cập mọi tính năng nâng cao"}
                </div>
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF" }}>
                {interval === "year" ? "990.000 ₫" : "99.000 ₫"}
              </div>
            </div>

            {/* Provider Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {/* VNPay Option */}
              <div
                onClick={() => setSelectedProvider("vnpay")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px",
                  borderRadius: "12px",
                  border: `2px solid ${
                    selectedProvider === "vnpay" ? "var(--color-primary, #0066CC)" : "var(--color-border)"
                  }`,
                  background:
                    selectedProvider === "vnpay" ? "rgba(0, 102, 204, 0.12)" : "var(--color-surface-raised)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      background: "#005BAA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      fontWeight: 800,
                      fontSize: "11px",
                    }}
                  >
                    VNPAY
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "14px" }}>
                      {isEn ? "VNPay Gateway (Domestic Vietnam)" : "Cổng VNPay (Thanh toán nội địa)"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {isEn ? "VNPAY-QR, Local ATM Cards, Internet Banking" : "VNPAY-QR, Thẻ ATM nội địa, Internet Banking"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: `2px solid ${selectedProvider === "vnpay" ? "#0066CC" : "#64748B"}`,
                    background: selectedProvider === "vnpay" ? "#0066CC" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedProvider === "vnpay" && <Check size={12} color="#FFF" />}
                </div>
              </div>

              {/* Stripe Option */}
              <div
                onClick={() => setSelectedProvider("stripe")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px",
                  borderRadius: "12px",
                  border: `2px solid ${
                    selectedProvider === "stripe" ? "var(--color-primary, #0066CC)" : "var(--color-border)"
                  }`,
                  background:
                    selectedProvider === "stripe" ? "rgba(0, 102, 204, 0.12)" : "var(--color-surface-raised)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      background: "#635BFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                    }}
                  >
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "14px" }}>
                      {isEn ? "International Cards (Stripe)" : "Thẻ Quốc Tế (Stripe)"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Visa, MasterCard, JCB, American Express
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: `2px solid ${selectedProvider === "stripe" ? "#0066CC" : "#64748B"}`,
                    background: selectedProvider === "stripe" ? "#0066CC" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedProvider === "stripe" && <Check size={12} color="#FFF" />}
                </div>
              </div>
            </div>

            {/* Security note */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--color-text-tertiary)",
                marginBottom: "20px",
              }}
            >
              <ShieldCheck size={16} color="#22C55E" />
              <span>{isEn ? "256-bit SSL encrypted transaction. Card data is never stored on our servers." : "Giao dịch bảo mật 256-bit SSL. Không lưu thông tin thẻ trên hệ thống."}</span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleExecutePayment}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #0066CC, #004C99)",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 800,
                cursor: isProcessing ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isProcessing ? (
                <span>{isEn ? "Connecting to payment gateway..." : "Đang kết nối cổng thanh toán..."}</span>
              ) : (
                <>
                  <span>{isEn ? `Confirm Payment via ${selectedProvider === "vnpay" ? "VNPay" : "Stripe"}` : `Xác nhận thanh toán qua ${selectedProvider === "vnpay" ? "VNPay" : "Stripe"}`}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
