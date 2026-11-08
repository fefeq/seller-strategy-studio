// SDD-20261106-metrics-honest-data · U-2 · CA-3 (texts), CA-4 (screen), CA-10: the Resumen KPI row and the win
// rate panels of Rendimiento speak about the selected quarter, never show a measured 0 % without closed deals,
// and a deal without source reads «Sin origen». Fictional data, no network.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectDataMarks } from "@/test/data-marks";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: Record<string, string>;
    children: React.ReactNode;
  }) => <a href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}`}>{children}</a>,
}));

import { ResumenKpis, WinRatePanels } from "@/components/metrics/performance-panels";

const money = (n: number) => `${n} €`;
const base = {
  quarter: "2026-Q4",
  money,
  quota: 0,
  cov: { ratio: 0, status: "low" as const, undated: { count: 0, amount: 0 } },
  openPipe: 0,
  actual: 0,
  commit: 0,
  acc: { diff: 0, accurate: true },
};

describe("CA-3 global win rate KPI", () => {
  it("with closed deals: the rate and «{n} cerrados en {T}»", () => {
    render(<ResumenKpis {...base} overall={{ won: 3, lost: 1, closed: 4, rate: 0.75 }} />);
    const kpi = screen.getByText("Win rate global").parentElement!;
    expect(within(kpi).getByText("75%")).toBeInTheDocument();
    expect(within(kpi).getByText("4 cerrados en 2026-Q4")).toBeInTheDocument();
  });
  it("without closed deals: «—» with «Sin dato · sin deals cerrados en {T}», never 0 %", () => {
    const { container } = render(
      <ResumenKpis {...base} overall={{ won: 0, lost: 0, closed: 0, rate: null }} />,
    );
    const kpi = screen.getByText("Win rate global").parentElement!;
    expect(within(kpi).getByText("—")).toBeInTheDocument();
    expect(within(kpi).queryByText("0%")).toBeNull();
    expect(within(kpi).getByText("Sin dato · sin deals cerrados en 2026-Q4")).toHaveAttribute(
      "data-mark",
      "sin_dato",
    );
    expect(expectDataMarks(container)).toEqual(["Sin dato · sin deals cerrados en 2026-Q4"]);
  });
  it("no longer talks about deals created", () => {
    render(<ResumenKpis {...base} overall={{ won: 1, lost: 0, closed: 1, rate: 1 }} />);
    expect(screen.queryByText(/creados este trimestre/)).toBeNull();
  });
});

describe("CA-3 / CA-4 win rate panels", () => {
  it("is titled «Win rate por origen», a null source reads «Sin origen» and nothing is labelled Outbound", () => {
    const { container } = render(
      <WinRatePanels
        quarter="2026-Q4"
        bySource={[
          { k: "—", won: 1, lost: 1, rate: 0.5 },
          { k: "inbound", won: 2, lost: 0, rate: 1 },
        ]}
        byRep={[{ k: "Ana Ficticia", won: 3, lost: 1, rate: 0.75 }]}
      />,
    );
    expect(screen.getByText("Win rate por origen")).toBeInTheDocument();
    expect(screen.queryByText("Win rate por fuente")).toBeNull();
    expect(screen.getByText("Sin origen")).toBeInTheDocument();
    expect(screen.getByText("50% · 1G/1P")).toBeInTheDocument();
    expect(screen.queryByText("Outbound")).toBeNull();
    expect(container.querySelectorAll("[data-mark]")).toHaveLength(0);
  });
  it("without closed deals each panel says «Sin deals cerrados en {T}»", () => {
    render(<WinRatePanels quarter="2026-Q4" bySource={[]} byRep={[]} />);
    expect(screen.getAllByText("Sin deals cerrados en 2026-Q4")).toHaveLength(2);
    expect(screen.queryByText(/todavía/)).toBeNull();
  });
});
