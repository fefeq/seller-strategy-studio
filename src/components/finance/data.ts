// Everything the Finanzas screen reads, in one query (RLS limits finance tables to Owner and Sales Leader).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { fetchAll } from "@/lib/fetch-all";
import { jsonObject } from "@/lib/json";
import type { PlanAssumption } from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";

export type FinanceSettings = Tables<"finance_settings">;

export function useIsFinance() {
  const { data: me } = useMe();
  return !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
}

export function useFinance() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const allowed = useIsFinance();
  return useQuery({
    queryKey: ["finance", orgId],
    enabled: !!orgId && allowed,
    queryFn: async () => {
      const [settings, lines, invoices, months, snaps, products, deals, budgets, segments, accounts, stripe] = await Promise.all([
        supabase.from("finance_settings").select("*").maybeSingle(),
        supabase.from("finance_cost_lines").select("*").order("starts_on"),
        fetchAll((a, b) => supabase.from("finance_invoices").select("*").order("issued_on", { ascending: false }).range(a, b)),
        supabase.from("finance_months").select("*").order("month"),
        supabase.from("forecast_snapshots").select("*").order("created_at", { ascending: false }).limit(12),
        supabase.from("products").select("id,name,price,billing,active").eq("active", true).order("price"),
        fetchAll((a, b) => supabase.from("deals").select("id,name,account_id,amount,probability,close_date,stage,closed_at,one_off_amount,segment_id").order("id").range(a, b)),
        supabase.from("segment_budget_quarters").select("period,segment_id,plan_revenue,plan_cost_to_serve,plan_acquisition"),
        supabase.from("segments").select("id,name").order("name"),
        fetchAll((a, b) => supabase.from("accounts").select("id,name,domain").order("id").range(a, b)),
        supabase.from("stripe_snapshots").select("mrr,active_customers,taken_at").order("taken_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const s = settings.data;
      const raw = jsonObject(s?.plan_assumptions);
      const assumptions: Record<string, PlanAssumption> = {};
      for (const [k, v] of Object.entries(raw)) {
        const o = jsonObject(v);
        assumptions[k] = { customers: Number(o.customers) || 0, adds: Number(o.adds) || 0, churn_pct: Number(o.churn_pct) || 0, annual_share_pct: Number(o.annual_share_pct) || 0 };
      }
      return {
        settings: s,
        assumptions,
        lines: lines.data ?? [],
        invoices: invoices.rows,
        months: months.data ?? [],
        snapshots: snaps.data ?? [],
        products: (products.data ?? []).map((p) => ({ ...p, price: Number(p.price) })),
        deals: deals.rows,
        budgets: budgets.data ?? [],
        segments: segments.data ?? [],
        accounts: accounts.rows,
        stripe: stripe.data,
      };
    },
  });
}
export type FinanceData = NonNullable<ReturnType<typeof useFinance>["data"]>;

export function useFinanceRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["setup"] }); };
}

/** Inputs of the forecast engine from the loaded data (today = first month unless the cash date is earlier). */
export function forecastInput(d: FinanceData, today: string) {
  const s = d.settings;
  const start = s?.cash_as_of && s.cash_as_of.slice(0, 7) < today ? s.cash_as_of.slice(0, 7) : today;
  return {
    plans: d.products, assumptions: d.assumptions, discountPct: Number(s?.annual_discount_pct ?? 0),
    deals: d.deals, includePipeline: s?.include_pipeline ?? true, lines: d.lines.map((l) => ({ ...l, amount: Number(l.amount) })),
    openingCash: Number(s?.opening_cash ?? 0), start, horizon: s?.horizon_months ?? 12, spreadPct: Number(s?.scenario_spread_pct ?? 25),
  };
}
