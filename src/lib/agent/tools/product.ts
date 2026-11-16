// Product usage from the company's own PostHog (synced into product_usage and trials by posthog-sync.server.ts).
import { z } from "zod";
import { usageTrend, TREND_LABEL } from "@/lib/product-usage";
import { accountNames, def, mustFind, type AgentTool } from "../tool-kit";

export const PRODUCT_TOOLS: AgentTool[] = [
  def({
    name: "get_product_usage",
    kind: "read",
    description:
      "Uso del producto de la empresa (leído de su PostHog): personas activas esta semana y la anterior, en 30 días y último uso, por cuenta. Con account_id, solo esa cuenta; sin él, las que más lo usan, las que caen y las empresas que lo usan sin estar en Nokko.",
    input: z.object({
      account_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (c, a) => {
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { data: conn } = await c.db
        .from("posthog_connections")
        .select("last_synced_at,status")
        .eq("org_id", c.orgId)
        .maybeSingle();
      if (!conn)
        return {
          mensaje:
            "Esta empresa no tiene PostHog conectado. El Owner puede conectarlo en Conexiones.",
        };
      let q = c.db
        .from("product_usage")
        .select(
          "domain,account_id,active_users_7d,active_users_prev_7d,active_users_30d,events_30d,last_seen_at",
        )
        .eq("org_id", c.orgId)
        .order("active_users_7d", { ascending: false })
        .limit(a.account_id ? 10 : 500);
      if (a.account_id) q = q.eq("account_id", a.account_id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const names = await accountNames(
        c,
        rows.map((r) => r.account_id),
      );
      const view = (r: (typeof rows)[number]) => ({
        cuenta: r.account_id ? (names.get(r.account_id) ?? null) : null,
        account_id: r.account_id,
        dominio: r.domain,
        activos_7d: r.active_users_7d,
        activos_semana_anterior: r.active_users_prev_7d,
        tendencia: TREND_LABEL[usageTrend(r.active_users_7d, r.active_users_prev_7d)],
        activos_30d: r.active_users_30d,
        eventos_30d: r.events_30d,
        ultimo_uso: r.last_seen_at,
      });
      const n = a.limit ?? 15;
      if (a.account_id) return { leido: conn.last_synced_at, uso: rows.map(view) };
      return {
        leido: conn.last_synced_at,
        mas_uso: rows
          .filter((r) => r.account_id)
          .slice(0, n)
          .map(view),
        caen: rows
          .filter(
            (r) => r.account_id && usageTrend(r.active_users_7d, r.active_users_prev_7d) === "down",
          )
          .slice(0, n)
          .map(view),
        sin_cuenta_en_nokko: rows
          .filter((r) => !r.account_id)
          .slice(0, n)
          .map(view),
      };
    },
  }),
  def({
    name: "sync_product_data",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Vuelve a leer el PostHog de la empresa ahora: uso por cuenta y altas del funnel self-service.",
    input: z.object({}),
    summarize: () => "Leer ahora los datos de producto de PostHog",
    run: async (c) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { syncPosthogOrg } = await import("@/lib/posthog-sync.server");
      const r = await syncPosthogOrg(supabaseAdmin, c.orgId);
      if (!r.ok) throw new Error(r.error ?? "PostHog no ha respondido.");
      return {
        mensaje:
          [
            r.usage ? `${r.usage.companies} empresas con uso (${r.usage.matched} son cuentas)` : "",
            r.trials ? `${r.trials.added} altas nuevas, ${r.trials.updated} actualizadas` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "PostHog leído.",
      };
    },
  }),
];
