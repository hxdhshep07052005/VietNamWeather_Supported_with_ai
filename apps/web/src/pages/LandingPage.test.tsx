import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { LandingPage } from "./LandingPage";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "landing.heroEyebrow": "Trợ lý Du lịch Thời tiết Thông minh Việt Nam",
        "landing.heroSubtitle": "Đưa ra quyết định du lịch tại Việt Nam dựa trên dữ liệu thời tiết có nguồn",
        "landing.getStarted": "Bắt đầu ngay",
        "auth.login": "Đăng nhập",
        "landing.exploreMap": "Khám phá bản đồ thời tiết",
        "landing.learnMore": "Tìm hiểu tính năng",
        "landing.viewModeRegions": "Theo vùng miền",
        "landing.viewModeRisk": "Mức độ rủi ro",
        "landing.featuresTitle": "Tính năng vượt trội",
        "landing.statsProvinces": "Tỉnh thành phủ sóng",
        "landing.pricingTitle": "Bảng giá dịch vụ",
        "landing.ctaReady": "Sẵn sàng cho chuyến đi an toàn?",
      };
      return translations[key] || key;
    },
    i18n: { language: "vi" },
  }),
}));

// Mock GSAP to avoid DOM animation issues in test environment
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    context: (cb: () => void) => {
      cb();
      return { revert: vi.fn() };
    },
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}));

describe("LandingPage Component", () => {
  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
  };

  it("renders Hero headline and eyebrow badge", () => {
    renderWithRouter();
    expect(
      screen.getByText("Trợ lý Du lịch Thời tiết Thông minh Việt Nam")
    ).toBeInTheDocument();
    expect(screen.getByText("Dự báo Thời tiết")).toBeInTheDocument();
  });

  it("renders Get Started and Login CTA buttons linking to /register and /login", () => {
    renderWithRouter();
    const registerLinks = screen.getAllByRole("link", { name: /Bắt đầu ngay/i });
    expect(registerLinks[0]).toBeInTheDocument();
    expect(registerLinks[0]).toHaveAttribute("href", "/register");

    const loginLink = screen.getByRole("link", { name: /Đăng nhập/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders features, stats, and pricing sections", () => {
    renderWithRouter();
    expect(screen.getByText("Tính năng vượt trội")).toBeInTheDocument();
    expect(screen.getByText("Bảng giá dịch vụ")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
  });
});
