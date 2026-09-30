import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RiskEvidenceWarnings } from "./RiskEvidenceWarnings";

afterEach(cleanup);

describe("risk evidence warnings", () => {
  it("separates each measurement from its severity and preserves zero visibility", () => {
    render(<RiskEvidenceWarnings isEn evidence={[
      { dimension: "visibility", severity: 3, value: 0 },
      { dimension: "wind", severity: 2, value: 27.412 },
      { dimension: "temperature", severity: 1, value: 25 },
      { dimension: "alert", severity: 0, value: null },
    ]} />);
    const rows = within(screen.getByRole("list", { name: "Weather warnings" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Visibility\s*0\s*m\s*High risk/);
    expect(rows[0]).toHaveAttribute("data-severity", "high");
    expect(rows[1]).toHaveTextContent(/Wind gust\s*27\.4\s*km\/h\s*Caution/);
    expect(rows[1]).toHaveAttribute("data-severity", "caution");
    expect(screen.queryByText("27.412")).not.toBeInTheDocument();
  });

  it("retains forecast provenance and Vietnamese warning labels", () => {
    render(<RiskEvidenceWarnings evidence={[
      { dimension: "rain", severity: 3, value: 35.126, source_kind: "hourly_forecast" },
      { dimension: "storm", severity: 2, value: "distant" },
    ]} />);
    const rows = within(screen.getByRole("list", { name: "Cảnh báo thời tiết" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/Mưa dự báo\s*35\.13\s*mm\/h\s*Nguy cơ cao/);
    expect(rows[1]).toHaveTextContent(/Dông\s*Dông xa\s*Chú ý/);
  });

  it.each([null, NaN])("does not attach a measurement unit to missing value %s", value => {
    render(<RiskEvidenceWarnings isEn evidence={[{ dimension: "wind", severity: 2, value }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("km/h")).not.toBeInTheDocument();
  });

  it("renders no warnings when evidence is missing, unknown, or low risk", () => {
    const { rerender } = render(<RiskEvidenceWarnings evidence={undefined} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    rerender(<RiskEvidenceWarnings evidence={[
      { dimension: "rain", severity: 1, value: 0 },
      { dimension: "alert", severity: 0, value: null },
    ]} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
