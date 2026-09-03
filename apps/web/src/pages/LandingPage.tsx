/**
 * Phase 9 Landing Page - Modern Split-Hero & Interactive Weather Experience
 * Features 2-column Hero layout, Quick Province Search, and Real-time Map Showcase
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { VietnamMap } from "../components/common/VietnamMap";
import {
  WeatherIcon,
  RiskIcon,
  RouteIcon,
  ArrowRightIcon,
  CheckIcon,
  CarIcon,
  MotorcycleIcon,
  SunIcon,
  RainIcon,
  WindIcon,
} from "../components/ui/Icons";
import styles from "./LandingPage.module.css";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

interface SelectedProvince {
  name: string;
  code: string;
  lat?: number;
  lng?: number;
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // If already logged in, redirect to /map
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/map", { replace: true });
    }
  }, [isAuthenticated, navigate]);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // View state
  const [viewMode, setViewMode] = useState<"region" | "risk">("region");
  const [selectedProvince, setSelectedProvince] = useState<SelectedProvince | null>(null);


  // GSAP Entrance and Scroll Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero Left Column Stagger
      gsap.fromTo(
        `.${styles.animHeroText}`,
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          delay: 0.15,
        }
      );

      // Hero Map Showcase Entrance
      gsap.fromTo(
        `.${styles.mapShowcaseWrapper}`,
        { opacity: 0, scale: 0.9, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.35,
        }
      );

      // Feature cards stagger on scroll
      gsap.fromTo(
        `.${styles.featureCard}`,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: `.${styles.featureGrid}`,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Stats counters stagger
      gsap.fromTo(
        `.${styles.statItem}`,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: `.${styles.statsGrid}`,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Pricing cards entrance
      gsap.fromTo(
        `.${styles.pricingCard}`,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: `.${styles.pricingGrid}`,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page}>
      {/* =========================================================================
          HERO SECTION - Modern 2-Column Split
          ========================================================================= */}
      <section ref={heroRef} className={styles.hero}>
        {/* Ambient background glows */}
        <div className={styles.heroBackground} />
        <div className={styles.heroGlowSphere1} />
        <div className={styles.heroGlowSphere2} />

        <div className={styles.container}>
          <div className={styles.heroGrid}>
            {/* Left Column: Brand, Headline, Search & CTAs */}
            <div className={styles.heroLeft}>
              {/* Eyebrow Badge */}
              <div className={`${styles.eyebrowBadge} ${styles.animHeroText}`}>
                <span className={styles.eyebrowPulse} />
                <span className={styles.eyebrowText}>{t("landing.heroEyebrow")}</span>
              </div>

              {/* Main Headline */}
              <h1 className={`${styles.heroTitle} ${styles.animHeroText}`}>
                {i18n.language === "vi" ? (
                  <>
                    Hành trình trọn vẹn với{" "}
                    <span className={styles.heroHighlight}>Dự báo Thời tiết</span> thông minh
                  </>
                ) : (
                  <>
                    Travel Confidently with{" "}
                    <span className={styles.heroHighlight}>Intelligent Weather</span> Foresight
                  </>
                )}
              </h1>

              {/* Subtitle */}
              <p className={`${styles.heroSubtitle} ${styles.animHeroText}`}>
                {t("landing.heroSubtitle")}
              </p>

              {/* Hero CTA Buttons - Side by Side, Minimalist & Clean */}
              <div className={`${styles.heroCtaGroup} ${styles.animHeroText}`}>
                <Link to="/register" className={styles.heroPrimaryBtn}>
                  <span>{t("landing.getStarted") || "Bắt đầu ngay"}</span>
                  <ArrowRightIcon size={18} />
                </Link>
                <Link to="/login" className={styles.heroSecondaryBtn}>
                  <span>{t("auth.login") || "Đăng nhập"}</span>
                </Link>
              </div>

              {/* Trust Indicators / Badges */}
              <div className={`${styles.trustMetrics} ${styles.animHeroText}`}>
                <div className={styles.trustItem}>
                  <div className={styles.trustIconOk}>
                    <CheckIcon size={14} />
                  </div>
                  <span>{t("landing.trustMetric1")}</span>
                </div>
                <div className={styles.trustItem}>
                  <div className={styles.trustIconOk}>
                    <CheckIcon size={14} />
                  </div>
                  <span>{t("landing.trustMetric2")}</span>
                </div>
                <div className={styles.trustItem}>
                  <div className={styles.trustIconOk}>
                    <CheckIcon size={14} />
                  </div>
                  <span>{t("landing.trustMetric3")}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Vietnam Map Showcase */}
            <div className={styles.heroRight}>
              <div className={styles.mapShowcaseWrapper}>
                {/* View Mode Toggle Bar */}
                <div className={styles.mapControlHeader}>
                  <div className={styles.mapBadgeTag}>
                    <span className={styles.liveIndicator} />
                    <span>{t("landing.liveMapBadge")}</span>
                  </div>
                  <div className={styles.viewModeToggle}>
                    <button
                      type="button"
                      className={`${styles.viewModeBtn} ${viewMode === "region" ? styles.viewModeBtnActive : ""}`}
                      onClick={() => setViewMode("region")}
                    >
                      {t("landing.viewModeRegions")}
                    </button>
                    <button
                      type="button"
                      className={`${styles.viewModeBtn} ${viewMode === "risk" ? styles.viewModeBtnActive : ""}`}
                      onClick={() => setViewMode("risk")}
                    >
                      {t("landing.viewModeRisk")}
                    </button>
                  </div>
                </div>

                {/* VietnamMap Component with Showcase Mode */}
                <VietnamMap
                  interactive={true}
                  showcaseMode={true}
                  viewMode={viewMode}
                  selectedProvinceId={selectedProvince?.code || null}
                  onProvinceClick={(name, code, lat, lng) => {
                    setSelectedProvince({ name, code, lat, lng });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURES SECTION - 3 Core Pillars with Visual Highlights
          ========================================================================= */}
      <section id="features" ref={featuresRef} className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>{t("landing.featureTechEyebrow")}</span>
            <h2 className={styles.sectionTitle}>{t("landing.featuresTitle")}</h2>
            <p className={styles.sectionSubtitle}>
              {t("landing.featuresSubtitle")}
            </p>
          </div>

          <div className={styles.featureGrid}>
            {/* Feature 1: Accurate 72h Forecast */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={`${styles.featureIconBox} ${styles.iconBoxWeather}`}>
                  <WeatherIcon size={26} />
                </div>
                <span className={styles.featurePill}>{t("landing.pill72h")}</span>
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureAccurateForecast")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureAccurateForecastDesc")}
              </p>
              {/* Mini visual mockup */}
              <div className={styles.featureMiniVisual}>
                <div className={styles.miniForecastRow}>
                  <div className={styles.miniForecastItem}>
                    <SunIcon size={18} />
                    <span>+1h</span>
                    <strong>28°C</strong>
                  </div>
                  <div className={styles.miniForecastItem}>
                    <SunIcon size={18} />
                    <span>+6h</span>
                    <strong>31°C</strong>
                  </div>
                  <div className={styles.miniForecastItem}>
                    <WindIcon size={18} />
                    <span>+12h</span>
                    <strong>29°C</strong>
                  </div>
                  <div className={styles.miniForecastItem}>
                    <RainIcon size={18} />
                    <span>+24h</span>
                    <strong>26°C</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: 6-Dimension Risk Evaluation */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={`${styles.featureIconBox} ${styles.iconBoxRisk}`}>
                  <RiskIcon size={26} />
                </div>
                <span className={styles.featurePill}>{t("landing.pillRiskEngine")}</span>
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureRiskAssessment")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureRiskAssessmentDesc")}
              </p>
              {/* Mini visual mockup: 6 Risk Dimensions */}
              <div className={styles.featureMiniVisual}>
                <div className={styles.miniRiskPills}>
                  <span className={`${styles.riskChip} ${styles.riskChipLow}`}>{t("landing.riskRainLow")}</span>
                  <span className={`${styles.riskChip} ${styles.riskChipLow}`}>{t("landing.riskWindLow")}</span>
                  <span className={`${styles.riskChip} ${styles.riskChipCaution}`}>{t("landing.riskTempCaution")}</span>
                  <span className={`${styles.riskChip} ${styles.riskChipLow}`}>{t("landing.riskVisGood")}</span>
                  <span className={`${styles.riskChip} ${styles.riskChipLow}`}>{t("landing.riskStormNone")}</span>
                  <span className={`${styles.riskChip} ${styles.riskChipLow}`}>{t("landing.riskAlertSafe")}</span>
                </div>
              </div>
            </div>

            {/* Feature 3: ETA-Aware Route Planning */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={`${styles.featureIconBox} ${styles.iconBoxRoute}`}>
                  <RouteIcon size={26} />
                </div>
                <span className={styles.featurePill}>{t("landing.pillEta")}</span>
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureRoutePlanning")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureRoutePlanningDesc")}
              </p>
              {/* Mini visual mockup: Route Comparison */}
              <div className={styles.featureMiniVisual}>
                <div className={styles.miniRouteTags}>
                  <div className={styles.vehiclePill}>
                    <CarIcon size={14} />
                    <MotorcycleIcon size={14} />
                    <span>{t("landing.vehicleCarMotor")}</span>
                  </div>
                  <div className={styles.routeOptionItem}>
                    <span>{t("landing.routeFastest")}</span>
                    <strong className={styles.tagSpeed}>{t("landing.routeFastestTime")}</strong>
                  </div>
                  <div className={`${styles.routeOptionItem} ${styles.routeOptionSafer}`}>
                    <span>{t("landing.routeSafer")}</span>
                    <strong className={styles.tagSafe}>{t("landing.routeSaferTime")}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STATS SECTION - Real-time metrics
          ========================================================================= */}
      <section ref={statsRef} className={styles.stats}>
        <div className={styles.container}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>63</div>
              <div className={styles.statLabel}>{t("landing.statsProvinces")}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>1,000+</div>
              <div className={styles.statLabel}>{t("landing.statsLocations")}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>6</div>
              <div className={styles.statLabel}>{t("landing.statsRiskDimensions")}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>24/7</div>
              <div className={styles.statLabel}>{t("landing.statsUpdates")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING SECTION - Free vs Pro
          ========================================================================= */}
      <section ref={pricingRef} className={styles.pricing}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>{t("landing.pricingEyebrow")}</span>
            <h2 className={styles.sectionTitle}>{t("landing.pricingTitle")}</h2>
            <p className={styles.sectionSubtitle}>
              {t("landing.pricingSubtitle")}
            </p>
          </div>

          <div className={styles.pricingGrid}>
            {/* Free Plan */}
            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <h3 className={styles.pricingTitle}>{t("landing.planFree")}</h3>
                <p className={styles.planTarget}>{t("landing.planFreeTarget")}</p>
              </div>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>0</span>
                <span className={styles.pricingPeriod}>{t("landing.perMonth")}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureCurrentWeather")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureWeatherMap")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureBasicRisk")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.feature10Queries")}</span>
                </li>
              </ul>
              <Link to="/register" className={`${styles.pricingBtn} ${styles.pricingBtnSecondary}`}>
                {t("landing.signUpFree")}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className={`${styles.pricingCard} ${styles.pricingCardHighlight}`}>
              <div className={styles.pricingBadge}>{t("landing.popular")}</div>
              <div className={styles.planHeader}>
                <h3 className={styles.pricingTitle}>{t("landing.planPro")}</h3>
                <p className={styles.planTarget}>{t("landing.planProTarget")}</p>
              </div>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>99,000</span>
                <span className={styles.pricingPeriod}>{t("landing.perMonth")}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureAllFree")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.feature72hForecast")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureTrends")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureAdvancedRoute")}</span>
                </li>
                <li>
                  <CheckIcon size={16} />
                  <span>{t("landing.featureUnlimited")}</span>
                </li>
              </ul>
              <Link to="/register?plan=pro" className={`${styles.pricingBtn} ${styles.pricingBtnPrimary}`}>
                {t("landing.signUpPro")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CTA BANNER SECTION
          ========================================================================= */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>{t("landing.ctaReady")}</h2>
            <p className={styles.ctaSubtitle}>
              {t("landing.ctaDescription")}
            </p>
            <div className={styles.ctaActions}>
              <Link to="/register" className={styles.ctaPrimaryBtn}>
                <span>{t("landing.getStarted")}</span>
                <ArrowRightIcon size={18} />
              </Link>
              <Link to="/map" className={styles.ctaSecondaryBtn}>
                <span>{t("landing.exploreMap")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

