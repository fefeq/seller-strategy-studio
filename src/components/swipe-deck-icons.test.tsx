import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Check } from "lucide-react";
import { IconText, ICON_SIZE, ICON_STROKE } from "@/components/icon-text";

describe("IconText (NK-0168)", () => {
  it("shows the text and hides the icon from assistive tech, 16 px stroke 1.75", () => {
    const { container } = render(<IconText icon={Check}>Hacer</IconText>);
    expect(screen.getByText("Hacer")).toBeVisible();
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe(String(ICON_SIZE.button));
    expect(ICON_SIZE).toEqual({ button: 16, nav: 20 });
    expect(svg.getAttribute("stroke-width")).toBe(String(ICON_STROKE));
  });
});
