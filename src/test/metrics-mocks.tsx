// Test doubles for the /metrics panels (SDD-20261106-metrics-honest-data U-4): a fake Supabase client that
// answers every query of a table with the fixture rows (filters are ignored), a Link that renders its real
// destination as href, and a signed-in owner. Fictional data only.
import type { ReactNode } from "react";

export type FakeDb = { tables: Record<string, unknown[]> };

export function fakeSupabaseModule(db: FakeDb) {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(f)
            : () => chain(table),
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
}

export function fakeRouterModule() {
  return {
    Link: ({
      to,
      search,
      children,
      className,
    }: {
      to: string;
      search?: Record<string, string>;
      children: ReactNode;
      className?: string;
    }) => (
      <a href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}`} className={className}>
        {children}
      </a>
    ),
  };
}

export function fakeUseMeModule() {
  return {
    useMe: () => ({
      data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1", currency: "EUR" } },
    }),
    useCurrency: () => ({ currency: "EUR", symbol: "€", money: (n: number) => `${n} €` }),
  };
}

/** Segment row with every column the panels select. */
export const segRow = (o: { id: string; name: string } & Record<string, unknown>) => ({
  acv_min: null,
  acv_max: null,
  win_rate_target: null,
  cac_target: null,
  gross_margin_pct: null,
  payback_months: null,
  ...o,
});

let n = 0;
/** Deal row with every column the panels select. */
export const dealRow = (o: Record<string, unknown>) => ({
  id: `d${++n}`,
  name: `Deal ficticio ${n}`,
  owner_id: null,
  segment_id: null,
  amount: null,
  stage: "discovery",
  close_date: null,
  closed_at: null,
  updated_at: "2026-10-02T10:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
  gross_margin: null,
  ...o,
});
