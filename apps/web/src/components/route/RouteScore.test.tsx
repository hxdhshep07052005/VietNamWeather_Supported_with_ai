import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouteScore } from "./RouteScore";

afterEach(cleanup);

describe("Route score presentation", () => {
  it("explains the report weights instead of treating the combined score as a weather percentage", () => {
    render(<RouteScore score={64.30357236} level="low" isEn />);
    const score = screen.getByRole("group", { name: "ETA score" });
    expect(score).toHaveTextContent("64/100");
    expect(score).toHaveTextContent("50% weather risk, 30% travel time, 20% distance");
    expect(score).toHaveTextContent("routes with the same weather risk can have different scores");
    expect(score).toHaveTextContent("Color shows weather risk");
  });
  it("preserves zero and localizes the risk label", () => {
    render(<RouteScore score={0} level="caution" isEn={false} />);
    const score = screen.getByRole("group", { name: "Điểm ETA" });
    expect(score).toHaveTextContent("0/100");
    expect(score).toHaveTextContent("Chú ý");
    expect(score).toHaveAttribute("data-risk-level", "caution");
  });

  it.each([null, NaN])("keeps unavailable score %s neutral", score => {
    render(<RouteScore score={score} level="low" isEn />);
    const panel = screen.getByRole("group", { name: "ETA score" });
    expect(panel).toHaveAttribute("data-risk-level", "unknown");
    expect(panel).toHaveTextContent("Insufficient data");
    expect(panel).toHaveTextContent("—");
    expect(panel).not.toHaveTextContent("/100");
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });
});
