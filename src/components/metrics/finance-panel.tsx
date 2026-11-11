import { Kpi } from "@/components/page";
import { DataMark } from "@/components/metrics/data-mark";
import { NativeSelect } from "@/components/native-select";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-dialog";
import { fetchAll } from "@/lib/fetch-all";
import { errorText } from "@/lib/errors";
import { formatRatio } from "@/lib/coverage";
import { quartersUpTo } from "@/lib/cac";
import { pct } from "@/lib/money";
import {
  COST_CATEGORIES,
  categoryLabel,
  monthsActive,
  quarterFinance,
  type RevenueSource,
} from "@/lib/finance-dashboard";

const SOURCE_TEXT: Record<RevenueSource, string> = {
  facturas: "según facturas emitidas",
  presupuesto: "según ingresos reales del presupuesto",
  deals: "según deals ganados (sin facturas aún)",
};

const STICKY_FIRST =
  "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-10 [&_tr>*:first-child]:bg-card";

function useFinanceData(quarter: string) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const quarters = quartersUpTo(quarter, 4);
  return useQuery({
    queryKey: ["finance-dashboard", orgId, quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [lines, invoices, cac, budgets, deals] = await Promise.all([
        supabase.from("finance_cost_lines").select("*").order("starts_on", { ascending: false }),
        fetchAll((a, b) =>
          supabase
            .from("finance_invoices")
            .select("*")
            .order("issued_on", { ascending: false })
            .range(a, b),
        ),
        supabase.from("cac_costs").select("period,amount").in("period", quarters),
        supabase.from("segment_budget_quarters").select("*").in("period", quarters),
        fetchAll((a, b) =>
          supabase
            .from("deals")
            .select("id,stage,amount,closed_at,updated_at")
            .eq("stage", "won")
            .order("id")
            .range(a, b),
        ),
      ]);
      const err = lines.error ?? cac.error ?? budgets.error;
      if (err) throw err;
      return {
        lines: lines.data ?? [],
        invoices: invoices.rows,
        cac: cac.data ?? [],
        budgets: budgets.data ?? [],
        deals: deals.rows,
        quarters,
      };
    },
  });
}

/** Budget, real spend, margin and ROI of the quarter, plus the operating costs and invoices that feed it. */
export function FinancePanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data, error } = useFinanceData(quarter);
  const view = useMemo(
    () => (data ? data.quarters.map((q) => quarterFinance({ quarter: q, ...data })) : []),
    [data],
  );
  const cur = view[view.length - 1];

  if (error) return <p className="text-sm text-signal">{errorText(error)}</p>;
  if (!data || !cur) return <p className="text-sm text-muted-foreground">Cargando finanzas…</p>;

  const dev = (d: { value: number; good: boolean | null } | null) =>
    d ? (
      <span className={d.good == null ? "" : d.good ? "text-success" : "text-signal"}>
        {d.value > 0 ? "+" : ""}
        {Math.round(d.value)}% vs presupuesto
      </span>
    ) : null;
  // SDD-20261109-metrics-sin-dato-rest: a missing figure says what is missing («Sin dato · motivo»); a budget nobody typed
  // says «sin plan».
  const miss = (reason: string) => <DataMark state="sin_dato" reason={reason} />;
  const plan = (v: number | null) => (v == null ? "sin plan" : money(v));
  const planRatio = (v: number | null) => (v == null ? "sin plan" : formatRatio(v));
  const revenue = (v: number | null) => (v == null ? miss("sin ingresos del trimestre") : money(v));
  const margin = (v: number | null) => (v == null ? miss("falta el ingreso real") : money(v));
  const ratio = (v: number | null) => (v == null ? miss("falta ingreso o gasto") : formatRatio(v));
  const cost = (v: number) => (v ? money(v) : miss("sin costes apuntados"));
  const collected = (v: { actual: { collected: number; revenueSource: RevenueSource | null } }) =>
    v.actual.collected
      ? money(v.actual.collected)
      : v.actual.revenueSource === "facturas"
        ? money(0)
        : miss("sin cobros registrados");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          size="normal"
          label="Presupuesto de gasto"
          value={plan(cur.budget.spend)}
          hint={
            cur.budget.spend == null ? (
              <Link to="/metrics" search={{ seccion: "economia" }} className="underline">
                Defínelo en CAC y presupuesto
              </Link>
            ) : (
              "captación + coste de servir"
            )
          }
        />
        <Kpi
          size="normal"
          label="Gasto real"
          value={cost(cur.actual.spend)}
          hint={
            dev(cur.spendDeviation) ??
            (cur.actual.acquisition ? (
              `${money(cur.actual.acquisition)} captación · ${money(cur.actual.operating)} operativos`
            ) : cur.actual.spend ? (
              <>
                captación {miss("sin costes apuntados")} · {money(cur.actual.operating)} operativos
              </>
            ) : undefined)
          }
        />
        <Kpi
          size="normal"
          label="Ingresos"
          value={revenue(cur.actual.revenue)}
          hint={
            cur.actual.revenueSource ? (
              <>
                {SOURCE_TEXT[cur.actual.revenueSource]}
                {cur.revenueDeviation && <> · {dev(cur.revenueDeviation)}</>}
              </>
            ) : (
              "Añade facturas abajo"
            )
          }
        />
        <Kpi
          size="normal"
          label="Margen"
          value={margin(cur.actual.margin)}
          hint={
            cur.actual.marginPct != null
              ? `${pct(cur.actual.marginPct)} de los ingresos`
              : "Ingresos − gasto real"
          }
          tone={cur.actual.margin != null && cur.actual.margin < 0 ? "signal" : undefined}
        />
        <Kpi
          size="normal"
          label="ROI"
          value={ratio(cur.actual.roi)}
          hint={
            cur.budget.roi != null
              ? `Presupuestado ${formatRatio(cur.budget.roi)} · ingresos ÷ gasto`
              : "Ingresos ÷ gasto total"
          }
          tone={cur.actual.roi != null && cur.actual.roi < 1 ? "signal" : undefined}
        />
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h3 className="text-2xl">Últimos 4 trimestres</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Gasto real = captación (de CAC y presupuesto) + costes operativos mensuales. Desvíos en
          verde si van a favor, en rojo si van en contra.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className={`w-full min-w-[560px] text-sm ${STICKY_FIRST}`}>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-normal" />
                {view.map((v) => (
                  <th
                    key={v.quarter}
                    className={`px-2 py-2 text-right font-normal ${v.quarter === quarter ? "text-foreground" : ""}`}
                  >
                    {v.quarter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label="Ingresos presupuestados"
                cells={view.map((v) => plan(v.budget.revenue))}
                muted
              />
              <Row
                label="Ingresos reales"
                cells={view.map((v) => revenue(v.actual.revenue))}
                tones={view.map((v) => tone(v.revenueDeviation))}
                strong
              />
              <Row
                label="Gasto presupuestado"
                cells={view.map((v) => plan(v.budget.spend))}
                muted
              />
              <Row
                label="Gasto real"
                cells={view.map((v) => cost(v.actual.spend))}
                tones={view.map((v) => tone(v.spendDeviation))}
                strong
              />
              <Row label="· captación" cells={view.map((v) => cost(v.actual.acquisition))} muted />
              <Row label="· operativos" cells={view.map((v) => cost(v.actual.operating))} muted />
              <Row
                label="Margen"
                cells={view.map((v) => margin(v.actual.margin))}
                tones={view.map((v) =>
                  v.actual.margin == null
                    ? ""
                    : v.actual.margin < 0
                      ? "text-signal"
                      : "text-success",
                )}
                strong
              />
              <Row
                label="Margen %"
                cells={view.map((v) =>
                  v.actual.marginPct == null
                    ? miss("falta el ingreso real")
                    : pct(v.actual.marginPct),
                )}
              />
              <Row
                label="ROI"
                cells={view.map((v) => ratio(v.actual.roi))}
                tones={view.map((v) =>
                  v.actual.roi == null || v.budget.roi == null
                    ? ""
                    : v.actual.roi >= v.budget.roi
                      ? "text-success"
                      : "text-signal",
                )}
                strong
              />
              <Row
                label="ROI presupuestado"
                cells={view.map((v) => planRatio(v.budget.roi))}
                muted
              />
              <Row label="Cobrado" cells={view.map((v) => collected(v))} muted />
            </tbody>
          </table>
        </div>
        {cur.actual.byCategory.length > 0 && (
          <div className="mt-5 max-w-md space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Costes operativos de {quarter} por categoría
            </p>
            {cur.actual.byCategory.map((c) => (
              <div key={c.category} className="text-xs">
                <div className="flex justify-between gap-3">
                  <span>{categoryLabel(c.category)}</span>
                  <span className="font-mono">{money(c.amount)}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${Math.round((c.amount / cur.actual.operating) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CostLines quarter={quarter} lines={data.lines} />
        <Invoices invoices={data.invoices} />
      </div>
    </div>
  );
}

const tone = (d: { good: boolean | null } | null) =>
  !d || d.good == null ? "" : d.good ? "text-success" : "text-signal";

function useIsOwner() {
  const { data: me } = useMe();
  return !!me?.roles.includes("owner");
}

function CostLines({
  quarter,
  lines,
}: {
  quarter: string;
  lines: {
    id: string;
    name: string;
    category: string;
    amount: number;
    starts_on: string;
    ends_on: string | null;
  }[];
}) {
  const { money } = useCurrency();
  const qc = useQueryClient();
  const isOwner = useIsOwner();
  const [f, setF] = useState({
    name: "",
    category: "people",
    amount: "",
    starts_on: new Date().toISOString().slice(0, 8) + "01",
    ends_on: "",
  });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance-dashboard"] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!f.name.trim() || !Number.isFinite(amount) || amount <= 0)
      return toast.error("Pon un nombre y un importe mensual mayor que 0.");
    if (f.ends_on && f.ends_on < f.starts_on)
      return toast.error("La fecha de fin no puede ser anterior al inicio.");
    setBusy(true);
    const { error } = await supabase.from("finance_cost_lines").insert({
      name: f.name.trim().slice(0, 120),
      category: f.category,
      amount,
      starts_on: f.starts_on,
      ends_on: f.ends_on || null,
    });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    setF((x) => ({ ...x, name: "", amount: "" }));
    refresh();
  }
  async function endNow(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("finance_cost_lines")
      .update({ ends_on: today })
      .eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }
  async function remove(id: string, name: string) {
    if (
      !(await askConfirm(`¿Borrar «${name}»?`, {
        body: "Desaparecerá también de los trimestres pasados. Si solo ha terminado, usa «Finalizar».",
        confirmLabel: "Borrar",
      }))
    )
      return;
    const { error } = await supabase.from("finance_cost_lines").delete().eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }

  return (
    <section className="min-w-0 rounded-lg border bg-card p-5">
      <h3 className="text-2xl">Costes operativos</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Gastos que se repiten cada mes (equipo, software, oficina…). La captación de clientes va en
        «CAC y presupuesto» para no contarla dos veces.
      </p>
      <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Concepto"
          placeholder="Concepto (p. ej. Salarios)"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className="sm:col-span-2"
        />
        <NativeSelect
          aria-label="Categoría"
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {Object.entries(COST_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label="Importe mensual"
          type="number"
          min="0"
          step="any"
          placeholder="Importe al mes"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
        <label className="text-xs text-muted-foreground">
          Desde
          <Input
            type="date"
            value={f.starts_on}
            onChange={(e) => setF({ ...f, starts_on: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Hasta (opcional)
          <Input
            type="date"
            value={f.ends_on}
            onChange={(e) => setF({ ...f, ends_on: e.target.value })}
          />
        </label>
        <Button type="submit" disabled={busy} className="sm:col-span-2">
          Añadir coste
        </Button>
      </form>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aún no hay costes operativos.</p>
      ) : (
        <ul className="mt-4 divide-y text-sm">
          {lines.map((l) => {
            const months = monthsActive(l, quarter);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="break-words">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(l.category)} · desde {l.starts_on}
                    {l.ends_on ? ` hasta ${l.ends_on}` : ""} · {months}{" "}
                    {months === 1 ? "mes" : "meses"} en {quarter}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-2 font-mono text-xs">{money(Number(l.amount))}/mes</span>
                  {!l.ends_on && (
                    <Button size="sm" variant="ghost" onClick={() => endNow(l.id)}>
                      Finalizar
                    </Button>
                  )}
                  {isOwner && (
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id, l.name)}>
                      Borrar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Invoices({
  invoices,
}: {
  invoices: {
    id: string;
    number: string;
    amount: number;
    issued_on: string;
    paid_on: string | null;
    notes: string;
  }[];
}) {
  const { money } = useCurrency();
  const qc = useQueryClient();
  const isOwner = useIsOwner();
  const [f, setF] = useState({
    number: "",
    amount: "",
    issued_on: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
  const today = () => new Date().toISOString().slice(0, 10);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Pon un importe mayor que 0.");
    setBusy(true);
    const { error } = await supabase.from("finance_invoices").insert({
      number: f.number.trim().slice(0, 60),
      amount,
      issued_on: f.issued_on,
      notes: f.notes.trim().slice(0, 200),
    });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    setF((x) => ({ ...x, number: "", amount: "", notes: "" }));
    refresh();
  }
  async function togglePaid(id: string, paid: boolean) {
    const { error } = await supabase
      .from("finance_invoices")
      .update({ paid_on: paid ? null : today() })
      .eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }
  async function remove(id: string, label: string) {
    if (!(await askConfirm(`¿Borrar la factura ${label}?`, { confirmLabel: "Borrar" }))) return;
    const { error } = await supabase.from("finance_invoices").delete().eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }
  const shown = showAll ? invoices : invoices.slice(0, 10);

  return (
    <section className="min-w-0 rounded-lg border bg-card p-5">
      <h3 className="text-2xl">Facturas emitidas</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Son la fuente más fiable de ingresos: cuentan en el trimestre en que se emiten. Márcalas
        como cobradas para seguir la caja.
      </p>
      <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Número de factura"
          placeholder="Número (opcional)"
          value={f.number}
          onChange={(e) => setF({ ...f, number: e.target.value })}
        />
        <Input
          aria-label="Importe de la factura"
          type="number"
          min="0"
          step="any"
          placeholder="Importe"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
        <label className="text-xs text-muted-foreground">
          Fecha de emisión
          <Input
            type="date"
            value={f.issued_on}
            onChange={(e) => setF({ ...f, issued_on: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Cliente o nota
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
        <Button type="submit" disabled={busy} className="sm:col-span-2">
          Añadir factura
        </Button>
      </form>
      {invoices.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aún no hay facturas. Mientras tanto, los ingresos salen del presupuesto o de los deals
          ganados.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y text-sm">
            {shown.map((i) => {
              const label = i.number || money(Number(i.amount));
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="break-words">
                      {i.number || "Sin número"}
                      {i.notes ? ` · ${i.notes}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emitida {i.issued_on} ·{" "}
                      {i.paid_on ? (
                        <span className="text-success">cobrada {i.paid_on}</span>
                      ) : (
                        "pendiente de cobro"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 font-mono text-xs">{money(Number(i.amount))}</span>
                    <Button size="sm" variant="ghost" onClick={() => togglePaid(i.id, !!i.paid_on)}>
                      {i.paid_on ? "Desmarcar cobro" : "Cobrada"}
                    </Button>
                    {isOwner && (
                      <Button size="sm" variant="ghost" onClick={() => remove(i.id, label)}>
                        Borrar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {invoices.length > 10 && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setShowAll((x) => !x)}
            >
              {showAll ? "Ver menos" : `Ver las ${invoices.length}`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function Row({
  label,
  cells,
  strong,
  muted,
  tones,
}: {
  label: string;
  cells: ReactNode[];
  strong?: boolean;
  muted?: boolean;
  tones?: string[];
}) {
  return (
    <tr
      className={`border-b border-dashed ${muted ? "text-muted-foreground" : strong ? "font-medium" : ""}`}
    >
      <td className="py-1.5 pr-3">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`px-2 py-1.5 text-right font-mono text-xs ${tones?.[i] ?? ""}`}>
          {c}
        </td>
      ))}
    </tr>
  );
}
