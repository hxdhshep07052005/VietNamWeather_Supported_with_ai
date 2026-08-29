/**
 * Phase 9 Landing Page - Professional Introduction Design
 * Vietnam Map Visual + GSAP Animations
 */

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { VietnamMap } from "../components/common/VietnamMap";
import { WeatherIcon, RiskIcon, RouteIcon, ArrowRightIcon } from "../components/ui/Icons";
import styles from "./LandingPage.module.css";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export function LandingPage() {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // GSAP Animations
  useEffect(() => {
    // Hero animations
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        `.${styles.heroTitle}`,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.3 }
      );

      // Subtitle animation
      gsap.fromTo(
        `.${styles.heroSubtitle}`,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.5 }
      );

      // CTA buttons animation
      gsap.fromTo(
        `.${styles.heroCta}`,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.7 }
      );

      // Vietnam map animation
      gsap.fromTo(
        `.${styles.vietnamMapWrapper}`,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 1.2, ease: "elastic.out(1, 0.5)", delay: 0.1 }
      );

      // Feature cards stagger animation
      gsap.fromTo(
        `.${styles.featureCard}`,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: `.${styles.featureGrid}`,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Stats counter animation
      gsap.fromTo(
        `.${styles.statItem}`,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: `.${styles.statsGrid}`,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Pricing cards animation
      gsap.fromTo(
        `.${styles.pricingCard}`,
        { opacity: 0, x: (i) => (i === 0 ? -50 : 50) },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.2,
          scrollTrigger: {
            trigger: `.${styles.pricingGrid}`,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Scroll indicator pulse
      gsap.to(`.${styles.scrollIndicator}`, {
        opacity: 0.5,
        y: 10,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section ref={heroRef} className={styles.hero}>
        {/* Animated background */}
        <div className={styles.heroBackground} />

        {/* Floating particles */}
        <div className={styles.particles}>
          {[...Array(10)].map((_, i) => (
            <div key={i} className={styles.particle} />
          ))}
        </div>

        {/* Hero content */}
        <div className={styles.heroContent}>
          {/* Vietnam Map Visualization */}
          <div className={styles.vietnamMapWrapper}>
            <VietnamMap />
          </div>

          {/* Hero text */}
          <h1 className={styles.heroTitle}>
            {t("landing.heroTitle").split("Du lịch").map((part, i, arr) =>
              i === arr.length - 1 ? (
                <span key={i}>{part}</span>
              ) : (
                <span key={i}>
                  {part}
                  <span className={styles.heroHighlight}>Du lịch</span>
                </span>
              )
            )}
          </h1>

          <p className={styles.heroSubtitle}>
            {t("landing.heroSubtitle")}
          </p>

          {/* CTA Buttons */}
          <div className={styles.heroCta}>
            <Link to="/register" className={styles.primaryButton}>
              <ArrowRightIcon size={20} />
              {t("landing.getStarted")}
            </Link>
            <Link to="/login" className={styles.secondaryButton}>
              {t("landing.login")}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={styles.scrollIndicator}>
          <span>{t("landing.scrollDown")}</span>
          <div className={styles.scrollArrow} />
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("landing.featuresTitle")}</h2>
            <p className={styles.sectionSubtitle}>
              {t("landing.featuresSubtitle")}
            </p>
          </div>

          <div className={styles.featureGrid}>
            {/* Feature 1: Accurate Forecast */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <WeatherIcon size={32} />
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureAccurateForecast")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureAccurateForecastDesc")}
              </p>
            </div>

            {/* Feature 2: Risk Assessment */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <RiskIcon size={32} />
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureRiskAssessment")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureRiskAssessmentDesc")}
              </p>
            </div>

            {/* Feature 3: Route Planning */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <RouteIcon size={32} />
              </div>
              <h3 className={styles.featureTitle}>
                {t("landing.featureRoutePlanning")}
              </h3>
              <p className={styles.featureDescription}>
                {t("landing.featureRoutePlanningDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} className={styles.stats}>
        <div className={styles.container}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>63</div>
              <div className={styles.statLabel}>{t("landing.statsProvinces")}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>1000+</div>
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

      {/* Pricing Section */}
      <section ref={pricingRef} className={styles.pricing}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("landing.pricingTitle")}</h2>
            <p className={styles.sectionSubtitle}>
              {t("landing.pricingSubtitle")}
            </p>
          </div>

          <div className={styles.pricingGrid}>
            {/* Free Plan */}
            <div className={styles.pricingCard}>
              <h3 className={styles.pricingTitle}>{t("landing.planFree")}</h3>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>0</span>
                <span className={styles.pricingPeriod}>{t("landing.perMonth")}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>{t("landing.featureCurrentWeather")}</li>
                <li>{t("landing.featureWeatherMap")}</li>
                <li>{t("landing.featureBasicRisk")}</li>
                <li>{t("landing.feature10Queries")}</li>
              </ul>
              <Link to="/register" className={styles.pricingButton + " " + styles.pricingButtonSecondary}>
                {t("landing.signUpFree")}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className={`${styles.pricingCard} ${styles.pricingCardHighlight}`}>
              <div className={styles.pricingBadge}>{t("landing.popular")}</div>
              <h3 className={styles.pricingTitle}>{t("landing.planPro")}</h3>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>₫</span>
                <span className={styles.pricingValue}>99,000</span>
                <span className={styles.pricingPeriod}>{t("landing.perMonth")}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>{t("landing.featureAllFree")}</li>
                <li>{t("landing.feature72hForecast")}</li>
                <li>{t("landing.featureTrends")}</li>
                <li>{t("landing.featureAdvancedRoute")}</li>
                <li>{t("landing.featureUnlimited")}</li>
              </ul>
              <Link to="/register?plan=pro" className={styles.pricingButton + " " + styles.pricingButtonPrimary}>
                {t("landing.signUpPro")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <h2 className={styles.ctaTitle}>{t("landing.ctaReady")}</h2>
          <p className={styles.ctaSubtitle}>
            {t("landing.ctaDescription")}
          </p>
          <Link to="/register" className={styles.primaryButton}>
            <ArrowRightIcon size={20} />
            {t("landing.getStarted")}
          </Link>
        </div>
      </section>

      {/* Attribution Section */}
      <section className={styles.attribution}>
        <div className={styles.container}>
          <p className={styles.attributionText}>
            {t("landing.attribution")}
          </p>
        </div>
      </section>
    </div>
  );
}
