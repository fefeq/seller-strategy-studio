import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { quarterRange } from "@/lib/metrics";
import { closedAtFromDay, wonDealRows, wonSummary, WON_ISSUE_LABEL, type WonDealRow } from "@/lib/won-deals";

const SELECT = "h-10 rounded-md border bg-background px-2 text-xs md:h-8";
const STICKY_FIRST = "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-10 [&_tr>*:first-child]:bg-background";

/** Won deals of the quarter with close date, value and segment: the deals the real CAC divides by. */
export function WonDealsPanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const qc = useQueryClient();
  const range = quarterRange(quarter);
  const [adding, setAdding] = useState(false);
  const { data } = useQuery({
    queryKey: ["segment-coverage", orgId, "won-deals"],
    enabled: !!orgId,
    queryFn: async () => {
      const [d, s, a] = await Promise.all([
        supabase.from("deals").select("id,name,account_id,segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("accounts").select("id,name"),
      ]);
      return { deals: d.data ?? [], segments: s.data ?? [], accounts: a.data ?? [] };
    },
  });
  const segments = data?.segments ?? [];
  const rows = useMemo(() => (data ? wonDealRows(data.deals, data.segments, range) : []), [data, quarter]);
  const summary = wonSummary(rows, segments);
  const openDeals = (data?.deals ?? []).filter((d) => d.stage !== "won" && d.stage !== "lost");
  const accountName = (id: string | null) => data?.accounts.find((a) => a.id === id)?.name;
  const segName = (id: string | null) => segments.find((s) => s.id === id)?.name ?? "—";

  const refresh = () => qc.invalidateQueries({ predicate: (q) => ["segment-coverage", "deals", "deals-real", "metrics", "home"].includes(String(q.queryKey[0])) });

  async function update(id: string, patch: { closed_at?: string; close_date?: string; amount?: number | null; segment_id?: string | null }) {
    const { error } = await supabase.from("deals").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Deals ganados · {quarter}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Son los clientes nuevos entre los que se divide el gasto de «CAC real». Revisa que cada uno tenga su fecha de cierre real, su valor y su segmento:
            la fecha decide el trimestre, el segmento decide a quién se le imputa el CAC y el valor alimenta el ACV del payback.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-right text-sm">
          <div>
            <p className="font-mono">{summary.total.deals} · {money(summary.total.amount)}</p>
            <p className="text-xs text-muted-foreground">ganados en el trimestre</p>
          </div>
          <Button size="sm" variant={adding ? "ghost" : "default"} onClick={() => setAdding((x) => !x)}>
            {adding ? "Cerrar" : <><Plus className="mr-1 h-3.5 w-3.5" /> Añadir deal ganado</>}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {summary.bySegment.map((s) => (
          <span key={s.segment.id} className="rounded-none border px-3 py-1">
            {s.segment.name}: <span className="font-mono">{s.deals} · {money(s.amount)}</span>
          </span>
        ))}
        {summary.unassigned > 0 && <span className="rounded-none border border-signal px-3 py-1 text-signal">Sin segmento: {summary.unassigned}</span>}
        {summary.withIssues > 0 && <span className="flex items-center gap-1 rounded-none bg-signal/10 px-3 py-1 text-signal"><AlertTriangle className="h-3 w-3" /> {summary.withIssues} por revisar</span>}
      </div>

      {adding && <AddWon quarter={quarter} segments={segments} openDeals={openDeals} onDone={() => { setAdding(false); refresh(); }} />}

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Ningún deal ganado en {quarter}. Sin clientes nuevos no hay CAC real: añade los que cerraste o márcalos como ganados en Pipeline.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[720px] text-sm ${STICKY_FIRST}`}>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Deal</th>
                <th className="px-2 py-2 font-normal">Fecha de cierre</th>
                <th className="px-2 py-2 text-right font-normal">Valor</th>
                <th className="px-2 py-2 font-normal">Segmento</th>
                <th className="px-2 py-2 font-normal">Avisos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <WonRow key={r.deal.id} r={r} account={accountName(r.deal.account_id ?? null)} segments={segments} segName={segName} onUpdate={(p) => update(r.deal.id, p)} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WonRow({ r, account, segments, segName, onUpdate }: {
  r: WonDealRow; account?: string; segments: { id: string; name: string }[]; segName: (id: string | null) => string;
  onUpdate: (p: { closed_at?: string; close_date?: string; amount?: number | null; segment_id?: string | null }) => void;
}) {
  const d = r.deal;
  return (
    <tr className="border-b border-dashed align-top">
      <td className="max-w-36 break-words py-2 pr-3 sm:max-w-none">
        <p className="font-medium">{d.name}</p>
        {account && <p className="text-[11px] text-muted-foreground">{account}</p>}
      </td>
      <td className="px-2 py-1.5">
        <Input type="date" aria-label={`Fecha de cierre · ${d.name}`} className="h-10 w-40 text-xs md:h-8" key={`${d.id}-${r.closedOn}`} defaultValue={r.closedOn}
          onBlur={(e) => { const v = e.target.value; if (v && (v !== r.closedOn || r.dateSource === "estimada")) onUpdate({ closed_at: closedAtFromDay(v), close_date: v }); }} />
        {r.dateSource === "estimada" && <p className="mt-0.5 text-[11px] text-signal">Estimada · confírmala</p>}
      </td>
      <td className="px-2 py-1.5 text-right">
        <Input type="number" min={0} aria-label={`Valor · ${d.name}`} className="ml-auto h-10 w-32 text-right text-xs md:h-8" key={`${d.id}-${d.amount ?? ""}`} defaultValue={d.amount ?? ""} placeholder="0"
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v != null && (!Number.isFinite(v) || v < 0)) return toast.error("Introduce un valor válido");
            if (v !== (d.amount == null ? null : Number(d.amount))) onUpdate({ amount: v });
          }} />
      </td>
      <td className="px-2 py-1.5">
        <select aria-label={`Segmento · ${d.name}`} className={SELECT} value={r.segmentSource === "manual" ? d.segment_id ?? "" : ""} onChange={(e) => onUpdate({ segment_id: e.target.value || null })}>
          <option value="">{r.segmentSource === "importe" ? `Automático (${segName(r.segmentId)})` : "Automático por valor"}</option>
          {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2 text-[11px] text-signal">
        {r.issues.length ? r.issues.map((i) => <p key={i}>{WON_ISSUE_LABEL[i]}</p>) : <span className="text-success">Correcto</span>}
      </td>
    </tr>
  );
}

function AddWon({ quarter, segments, openDeals, onDone }: {
  quarter: string; segments: { id: string; name: string }[]; openDeals: { id: string; name: string; amount: number | null; segment_id: string | null }[]; onDone: () => void;
}) {
  const { start, end } = quarterRange(quarter);
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10);
  const defaultDay = today >= start.toISOString().slice(0, 10) && today <= lastDay ? today : lastDay;
  const [dealId, setDealId] = useState("");
  const [name, setName] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [amount, setAmount] = useState("");
  const [segment, setSegment] = useState("");
  const [saving, setSaving] = useState(false);

  function pick(id: string) {
    setDealId(id);
    const d = openDeals.find((x) => x.id === id);
    setAmount(d?.amount != null ? String(d.amount) : "");
    setSegment(d?.segment_id ?? "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = amount === "" ? null : Number(amount);
    if (!dealId && !name.trim()) return toast.error("Pon un nombre al deal");
    if (!day) return toast.error("Indica la fecha de cierre");
    if (value == null || !Number.isFinite(value) || value <= 0) return toast.error("Indica el valor del deal");
    setSaving(true);
    const common = { stage: "won", probability: 100, closed_at: closedAtFromDay(day), close_date: day, amount: value, segment_id: segment || null };
    const { error } = dealId
      ? await supabase.from("deals").update(common).eq("id", dealId)
      : await supabase.from("deals").insert({ ...common, name: name.trim().slice(0, 200) });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(dealId ? "Deal marcado como ganado" : "Deal ganado añadido");
    onDone();
  }

  return (
    <form onSubmit={save} className="mb-5 grid gap-3 rounded-md border border-dashed p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-end">
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Deal</span>
        <select className={`${SELECT} w-full`} value={dealId} onChange={(e) => pick(e.target.value)} aria-label="Deal abierto o nuevo">
          <option value="">Nuevo deal (no está en Pipeline)</option>
          {openDeals.map((d) => <option key={d.id} value={d.id}>Ganado: {d.name}</option>)}
        </select>
        {!dealId && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del deal o cliente" className="h-10 text-xs md:h-8" aria-label="Nombre del deal" />}
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Fecha de cierre</span>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-10 text-xs md:h-8" aria-label="Fecha de cierre del nuevo deal" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Valor anual</span>
        <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-10 text-right text-xs md:h-8" aria-label="Valor del nuevo deal" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Segmento</span>
        <select className={`${SELECT} w-full`} value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segmento del nuevo deal">
          <option value="">Automático por valor</option>
          {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <Button type="submit" size="sm" disabled={saving}>{dealId ? "Marcar ganado" : "Guardar"}</Button>
    </form>
  );
}
