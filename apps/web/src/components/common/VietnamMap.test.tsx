import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VietnamMap } from "./VietnamMap";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "vi" },
  }),
}));

describe("VietnamMap Component", () => {
  it("renders correctly with SVG canvas", () => {
    const { container } = render(<VietnamMap />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders province paths with valid paths", () => {
    const { container } = render(<VietnamMap />);
    const paths = container.querySelectorAll("path");
    // Vietnam has 63 provinces
    expect(paths.length).toBeGreaterThanOrEqual(60);
  });

  it("handles province click and emits accurate WGS84 coordinates", () => {
    const onProvinceClick = vi.fn();
    const { container } = render(
      <VietnamMap interactive={true} onProvinceClick={onProvinceClick} />
    );

    const firstProvince = container.querySelector("path");
    expect(firstProvince).toBeInTheDocument();

    if (firstProvince) {
      fireEvent.click(firstProvince);
      expect(onProvinceClick).toHaveBeenCalledTimes(1);
      const firstCall = onProvinceClick.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall) {
        const [name, code, lat, lng] = firstCall;
        expect(typeof name).toBe("string");
        expect(typeof code).toBe("string");
        expect(typeof lat).toBe("number");
        expect(typeof lng).toBe("number");

        // Verify coordinate is within Vietnam's real geographical bounding box
        expect(lat).toBeGreaterThan(8.0);
        expect(lat).toBeLessThan(24.0);
        expect(lng).toBeGreaterThan(102.0);
        expect(lng).toBeLessThan(110.5);
      }
    }
  });

  it("renders clean vector map without floating dots or circles", () => {
    const { container } = render(
      <VietnamMap showcaseMode={true} />
    );
    // Ensure no circle or floating pulse dots are rendered on the map canvas
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(0);
  });

  it("displays on-demand info card when hovering over a province", () => {
    const { container } = render(<VietnamMap showcaseMode={true} />);
    // Before hover: no on-demand card
    expect(screen.queryByText(/common\.updatedAt/)).not.toBeInTheDocument();

    const firstProvince = container.querySelector("path");
    if (firstProvince) {
      fireEvent.mouseEnter(firstProvince);
      // After hover: on-demand card appears with live standard time
      expect(screen.getByText(/common\.updatedAt/)).toBeInTheDocument();
    }
  });
});
