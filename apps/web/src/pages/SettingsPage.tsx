/**
 * Phase 9 Settings Page
 * User preferences, Saved Locations & Routes management, and Subscription details
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Crown, Zap, Sparkles, MapPin, Navigation, ExternalLink, Trash2 } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useLanguage, useSetLanguage } from "../hooks/useLanguageStore";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "../i18n";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentLang = useLanguage();
  const setLanguage = useSetLanguage();
  const { user, removeSavedLocation, removeSavedRoute } = useAuthStore();

  const isPro = user?.plan === "pro";
  const savedLocations = user?.savedLocations || [];
  const savedRoutes = user?.savedRoutes || [];
  const maxLocations = isPro ? 50 : 3;
  const maxRoutes = isPro ? 20 : 1;
  const dailyQuotaMax = isPro ? 30 : 3;
  const dailyUsed = user?.dailyRouteCount || 0;

  const [temperatureUnit, setTemperatureUnit] = useState<"celsius" | "fahrenheit">("celsius");
  const [windSpeedUnit, setWindSpeedUnit] = useState<"kmh" | "mph">("kmh");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("settings.title") || "Cài Đặt Tài Khoản"}</h1>
      </div>

      <div className={styles.content}>
        {/* Account & Subscription Card */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Thông tin Tài khoản & Gói Hội viên</h2>
          <div className={styles.accountInfoCard}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {user?.name || "Người dùng"} ({user?.email})
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Gói hiện tại:</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 800,
                    color: isPro ? "#FFCD00" : "#0066CC",
                  }}
                >
                  {isPro ? <Crown size={14} /> : <Zap size={14} />}
                  <span>{isPro ? "PRO CAO CẤP (Không giới hạn)" : "GÓI MIỄN PHÍ"}</span>
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                Lượt tìm lộ trình hôm nay: <strong>{dailyUsed}</strong> / {dailyQuotaMax} lượt
              </div>
            </div>

            <Link
              to="/upgrade"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "8px",
                background: isPro ? "var(--color-surface-raised)" : "linear-gradient(135deg, #FFCD00, #F59E0B)",
                color: isPro ? "var(--color-text-primary)" : "#0F172A",
                border: "1px solid var(--color-border)",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {isPro ? (
                <>
                  <span>Xem quyền lợi gói PRO</span>
                  <ExternalLink size={14} />
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Nâng cấp PRO ngay</span>
                </>
              )}
            </Link>
          </div>
        </section>

        {/* Saved Locations Management */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, border: "none", padding: 0 }}>
              Địa Điểm Đã Lưu ({savedLocations.length} / {maxLocations})
            </h2>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {isPro ? "Gói PRO: Tối đa 50 địa điểm" : "Gói Miễn phí: Tối đa 3 địa điểm"}
            </span>
          </div>

          {savedLocations.length === 0 ? (
            <div className={styles.emptyTip}>
              Bạn chưa lưu địa điểm nào. Khi bấm chọn một tỉnh thành trên Bản đồ, hãy chọn "Lưu địa điểm" để xem lại
              nhanh tại đây.
            </div>
          ) : (
            <div className={styles.itemsList}>
              {savedLocations.map((loc) => (
                <div key={loc.id} className={styles.savedItemRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {loc.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "6px" }}>
                      Lưu lúc: {new Date(loc.savedAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/location/${encodeURIComponent(loc.name)}`)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Xem chi tiết</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedLocation(loc.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "#EF4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved Routes Management */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, border: "none", padding: 0 }}>
              Lộ Trình Đã Lưu ({savedRoutes.length} / {maxRoutes})
            </h2>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {isPro ? "Gói PRO: Tối đa 20 lộ trình" : "Gói Miễn phí: Tối đa 1 lộ trình"}
            </span>
          </div>

          {savedRoutes.length === 0 ? (
            <div className={styles.emptyTip}>
              Bạn chưa lưu lộ trình nào. Khi tìm kiếm đường đi tại trang "Lộ trình thông minh", bấm "Lưu lộ trình này"
              để theo dõi nhanh.
            </div>
          ) : (
            <div className={styles.itemsList}>
              {savedRoutes.map((r) => (
                <div key={r.id} className={styles.savedItemRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Navigation size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {r.fromName} → {r.toName}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "6px" }}>
                      ({r.distanceKm} km • {Math.round(r.durationMinutes)} phút • {r.vehicle === "car" ? "Ô tô" : "Xe máy"})
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/route?to=${encodeURIComponent(r.toName)}`)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid var(--color-primary)",
                        background: "rgba(0, 102, 204, 0.1)",
                        color: "var(--color-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <Navigation size={12} />
                      <span>Mở lộ trình</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedRoute(r.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "#EF4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Language Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.language") || "Ngôn ngữ hiển thị"}</h2>
          <div className={styles.languageOptions}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                className={`${styles.languageOption} ${currentLang === lang ? styles.languageOptionActive : ""}`}
                onClick={() => setLanguage(lang)}
              >
                <span className={styles.languageFlag}>{lang.toUpperCase()}</span>
                <span className={styles.languageName}>{LANGUAGE_NAMES[lang]}</span>
                {currentLang === lang && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.checkIcon}>
                    <path
                      d="M3 8L6.5 11.5L13 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Units Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.units") || "Đơn vị đo lường"}</h2>

          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.temperatureUnit") || "Nhiệt độ"}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temperature"
                  checked={temperatureUnit === "celsius"}
                  onChange={() => setTemperatureUnit("celsius")}
                />
                <span>°C (Celsius)</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temperature"
                  checked={temperatureUnit === "fahrenheit"}
                  onChange={() => setTemperatureUnit("fahrenheit")}
                />
                <span>°F (Fahrenheit)</span>
              </label>
            </div>
          </div>

          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.windSpeedUnit") || "Tốc độ gió"}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="windSpeed"
                  checked={windSpeedUnit === "kmh"}
                  onChange={() => setWindSpeedUnit("kmh")}
                />
                <span>km/h</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="windSpeed"
                  checked={windSpeedUnit === "mph"}
                  onChange={() => setWindSpeedUnit("mph")}
                />
                <span>mph</span>
              </label>
            </div>
          </div>

          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.distanceUnit") || "Khoảng cách"}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="distance"
                  checked={distanceUnit === "km"}
                  onChange={() => setDistanceUnit("km")}
                />
                <span>km (Kilometers)</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="distance"
                  checked={distanceUnit === "mi"}
                  onChange={() => setDistanceUnit("mi")}
                />
                <span>miles (Dặm)</span>
              </label>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className={styles.actions}>
          <button className={styles.saveButton} onClick={handleSave}>
            {t("settings.saveChanges") || "Lưu thay đổi"}
          </button>
          {isSaved && (
            <span className={styles.savedMessage}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8L6.5 11.5L13 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("settings.changesSaved") || "Đã lưu cài đặt thành công!"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
