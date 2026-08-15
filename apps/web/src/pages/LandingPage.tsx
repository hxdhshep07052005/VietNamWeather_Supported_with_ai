/**
 * Phase 9 Landing Page
 * Per FRONT-003: Value proposition + Pricing focus
 */

import { Link } from "react-router-dom";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>
            Trợ lý Du lịch Thông minh với Thời tiết
          </h1>
          <p className={styles.heroSubtitle}>
            Đưa ra quyết định du lịch tại Việt Nam dựa trên dữ liệu thời tiết có nguồn,
            phân tích rủi ro và đánh giá lộ trình theo ETA.
          </p>
          <div className={styles.heroCta}>
            <Link to="/register" className={styles.primaryButton}>
              Bắt đầu miễn phí
            </Link>
            <Link to="/login" className={styles.secondaryButton}>
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Tính năng chính</h2>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <WeatherIcon />
              </div>
              <h3 className={styles.featureTitle}>Dự báo chính xác</h3>
              <p className={styles.featureDescription}>
                Dữ liệu thời tiết từ WeatherAPI.com với độ phủ toàn quốc,
                cập nhật theo thời gian thực.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <RiskIcon />
              </div>
              <h3 className={styles.featureTitle}>Đánh giá rủi ro</h3>
              <p className={styles.featureDescription}>
                Phân tích rủi ro thời tiết với 6 chiều: Mưa, Gió, Nhiệt độ,
                Tầm nhìn, Bão và Cảnh báo.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <RouteIcon />
              </div>
              <h3 className={styles.featureTitle}>Lập kế hoạch lộ trình</h3>
              <p className={styles.featureDescription}>
                Tính toán lộ trình thông minh với đánh giá rủi ro theo ETA,
                đề xuất tuyến đường an toàn hơn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={styles.pricing}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Gói dịch vụ</h2>
          
          <div className={styles.pricingGrid}>
            {/* Free Plan */}
            <div className={styles.pricingCard}>
              <h3 className={styles.pricingTitle}>Miễn phí</h3>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>0</span>
                <span className={styles.pricingPeriod}>/tháng</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>Dự báo thời tiết hiện tại</li>
                <li>Xem bản đồ thời tiết</li>
                <li>Đánh giá rủi ro cơ bản</li>
                <li>Tối đa 10 lượt tra cứu/ngày</li>
              </ul>
              <Link to="/register" className={styles.pricingButton}>
                Đăng ký miễn phí
              </Link>
            </div>

            {/* Pro Plan */}
            <div className={`${styles.pricingCard} ${styles.pricingCardHighlight}`}>
              <div className={styles.pricingBadge}>Phổ biến</div>
              <h3 className={styles.pricingTitle}>Pro</h3>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>99,000</span>
                <span className={styles.pricingPeriod}>/tháng</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>Tất cả tính năng Miễn phí</li>
                <li>Dự báo 72 giờ tới</li>
                <li>Xu hướng thời tiết</li>
                <li>Lập kế hoạch lộ trình nâng cao</li>
                <li>Không giới hạn tra cứu</li>
              </ul>
              <Link to="/register?plan=pro" className={styles.pricingButtonPrimary}>
                Đăng ký Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Attribution Section */}
      <section className={styles.attribution}>
        <div className={styles.container}>
          <p className={styles.attributionText}>
            Dữ liệu thời tiết được cung cấp bởi{" "}
            <a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer">
              WeatherAPI.com
            </a>
            . Bản đồ sử dụng{" "}
            <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
              Geoapify
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

// Icon Components
function WeatherIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}
