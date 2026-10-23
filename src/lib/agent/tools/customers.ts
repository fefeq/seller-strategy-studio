// Customers: renewals, health and expansion. Read tools only; creating a renewal or expansion deal
// reuses create_deal, which the detectors propose. Nokko does not link accounts to Stripe customers,
// so none of this claims anything about payments.
import { z } from "zod";
import {
  customerHealth, customerIds, customerRenewals, expansionOpportunities, lastActivityByAccount, readCustomerSettings, wonDeals, wonKeysOf,
  type DealLine, type WonDeal,
} from "@/lib/customers";
import { accountNames, def, mustFind, orgStages, type AgentTool, type ToolCtx } from "../tool-kit";

const DEAL_COLS = "id,name,account_id,stage,amount,closed_at,close_date,updated_at,owner_id";

async function loadCustomers(c: ToolCtx) {
  const [stages, settings] = await Promise.all([orgStages(c), c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle()]);
  const wonKeys = wonKeysOf(stages);
  const { data, error } = await c.db.from("deals").select(DEAL_COLS).eq("org_id", c.orgId).in("stage", [...wonKeys]).limit(2000);
  if (error) throw new Error(error.message);
  const won = wonDeals((data ?? []) as unknown as WonDeal[], wonKeys);
  return { stages, wonKeys, won, settings: readCustomerSettings(settings.data?.sla) };
}

async function linesOf(c: ToolCtx, dealIds: string[]): Promise<(DealLine & { product_id: string | null })[]> {
  if (!dealIds.length) return [];
  const { data, error } = await c.db.from("deal_lines").select("deal_id,billing,product_id").eq("org_id", c.orgId).in("deal_id", dealIds).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as (DealLine & { product_id: string | null })[];
}

const BASE = "aniversario del cierre de un deal ganado con líneas anuales (estimada)";

export const CUSTOMER_TOOLS: AgentTool[] = [
  def({
    name: "list_renewals", kind: "read",
    description: "Renovaciones próximas de clientes (cuentas con un deal ganado con líneas anuales). La fecha es una estimación: el aniversario del cierre del deal. Los deals mensuales o de pago único no tienen renovación. La ventana por defecto es la de la empresa; con within_days se cambia.",
    input: z.object({ within_days: z.number().int().min(1).max(730).optional(), mine: z.boolean().optional() }),
    run: async (c, a) => {
      const { wonKeys, won, settings } = await loadCustomers(c);
      const windowDays = a.within_days ?? settings.renewalWindowDays;
      const lines = await linesOf(c, won.map((d) => d.id));
      let rows = customerRenewals(won, lines, wonKeys, new Date(), windowDays).filter((r) => r.days_left <= windowDays);
      if (a.mine) rows = rows.filter((r) => r.owner_id === c.userId);
      const names = await accountNames(c, rows.map((r) => r.account_id));
      return {
        ventana_dias: windowDays, fuente_ventana: a.within_days ? "petición" : settings.renewalSource, base_fecha: BASE,
        renovaciones: rows.map((r) => ({ cuenta_id: r.account_id, cuenta: names.get(r.account_id) ?? null, deal_id: r.deal_id, deal: r.deal, renueva_el: r.renews_on, dias: r.days_left, importe: r.amount, propietario_id: r.owner_id })),
        ...(rows.length ? {} : { mensaje: "No hay renovaciones en la ventana. Si hay clientes sin líneas anuales en su deal ganado, no tienen fecha de renovación." }),
      };
    },
  }),
  def({
    name: "get_customer_health", kind: "read",
    description: "Salud de una cuenta cliente: nivel (sano, vigilar, riesgo o sin datos) y la evidencia de cada señal (salud de la ficha, actividad reciente, pagos). No hay puntuación numérica y lo que falta se dice como «sin datos». Incluye su próxima renovación estimada si tiene.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const acc = await mustFind<{ id: string; name: string; health: string | null }>(c, "accounts", a.account_id, "esa cuenta", "id,name,health");
      const { wonKeys, won, settings } = await loadCustomers(c);
      const mine = won.filter((d) => d.account_id === acc.id);
      if (!mine.length) return { cliente: false, cuenta: acc.name, mensaje: "Esta cuenta aún no es cliente: no tiene ningún deal ganado." };
      const now = new Date();
      const nowIso = now.toISOString();
      const [touches, calls, meetings, deals, lines] = await Promise.all([
        c.db.from("account_touches").select("account_id,occurred_at").eq("org_id", c.orgId).eq("account_id", acc.id).order("occurred_at", { ascending: false }).limit(1),
        c.db.from("calls").select("account_id,occurred_at").eq("org_id", c.orgId).eq("account_id", acc.id).order("occurred_at", { ascending: false }).limit(1),
        c.db.from("meetings").select("account_id,scheduled_at").eq("org_id", c.orgId).eq("account_id", acc.id).lte("scheduled_at", nowIso).order("scheduled_at", { ascending: false }).limit(1),
        c.db.from("deals").select("account_id,updated_at").eq("org_id", c.orgId).eq("account_id", acc.id).order("updated_at", { ascending: false }).limit(1),
        linesOf(c, mine.map((d) => d.id)),
      ]);
      const activity = lastActivityByAccount([
        ...(touches.data ?? []).map((r) => ({ account_id: r.account_id, at: r.occurred_at })),
        ...(calls.data ?? []).map((r) => ({ account_id: r.account_id, at: r.occurred_at })),
        ...(meetings.data ?? []).map((r) => ({ account_id: r.account_id, at: r.scheduled_at })),
        ...(deals.data ?? []).map((r) => ({ account_id: r.account_id, at: r.updated_at })),
      ], now).get(acc.id) ?? null;
      const health = customerHealth({ accountHealth: acc.health, lastActivityAt: activity, quietDays: settings.quietDays, now });
      const renewal = customerRenewals(mine, lines, wonKeys, now, settings.renewalWindowDays)[0] ?? null;
      return {
        cliente: true, cuenta: acc.name, nivel: health.nivel, senales: health.senales, limite_inactividad_dias: settings.quietDays, fuente_limite: settings.quietSource,
        renovacion: renewal ? { renueva_el: renewal.renews_on, dias: renewal.days_left, deal: renewal.deal, importe: renewal.amount, base: BASE } : null,
      };
    },
  }),
  def({
    name: "list_expansion_opportunities", kind: "read",
    description: "Clientes con margen para crecer: whitespace escrito en su plan de cuenta y productos activos del catálogo que aún no tienen contratados en ningún deal ganado. Indica cuántos deals abiertos tiene cada uno (si ya hay uno, alguien lo está trabajando).",
    input: z.object({ limit: z.number().int().min(1).max(50).optional() }),
    run: async (c, a) => {
      const { wonKeys, won, stages } = await loadCustomers(c);
      const customers = customerIds(won, wonKeys);
      if (!customers.size) return { oportunidades: [], mensaje: "Todavía no hay clientes: ninguna cuenta tiene un deal ganado." };
      const ids = [...customers];
      const openKeys = stages.filter((s) => s.kind === "open").map((s) => s.key);
      const [plans, open, products, lines] = await Promise.all([
        c.db.from("account_plans").select("account_id,whitespace").eq("org_id", c.orgId).in("account_id", ids).limit(2000),
        c.db.from("deals").select("account_id").eq("org_id", c.orgId).in("account_id", ids).in("stage", openKeys).limit(5000),
        c.db.from("products").select("id,name").eq("org_id", c.orgId).eq("active", true).limit(500),
        linesOf(c, won.map((d) => d.id)),
      ]);
      const openBy = new Map<string, number>();
      for (const d of open.data ?? []) if (d.account_id) openBy.set(d.account_id, (openBy.get(d.account_id) ?? 0) + 1);
      const dealAccount = new Map(won.map((d) => [d.id, d.account_id as string]));
      const contracted = new Map<string, Set<string>>();
      for (const l of lines) {
        const acc = dealAccount.get(l.deal_id);
        if (!acc || !l.product_id) continue;
        if (!contracted.has(acc)) contracted.set(acc, new Set());
        contracted.get(acc)!.add(l.product_id);
      }
      const rows = expansionOpportunities(customers, plans.data ?? [], openBy, contracted, (products.data ?? []) as { id: string; name: string }[]).slice(0, a.limit ?? 20);
      const names = await accountNames(c, rows.map((r) => r.account_id));
      return {
        oportunidades: rows.map((r) => ({ cuenta_id: r.account_id, cuenta: names.get(r.account_id) ?? null, whitespace: r.whitespace, deals_abiertos: r.open_deals, productos_sin_contratar: r.not_contracted })),
        ...(rows.length ? {} : { mensaje: "Ningún cliente tiene whitespace escrito ni productos del catálogo sin contratar." }),
      };
    },
  }),
];
