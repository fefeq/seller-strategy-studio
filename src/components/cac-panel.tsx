import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { quarterRange } from "@/lib/metrics";
import { segmentCoverage } from "@/lib/segment-coverage";
import { CAC_CHANNELS, costByChannel, previousQuarter } from "@/lib/cac";
import { useSegmentCoverageData } from "@/components/segment-coverage";

const SHARED = "shared";

/** Acquisition costs per channel × segment for a quarter → real CAC and payback per segment. */
export function CacPanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = !!me?.roles.some((r) => r === "owner" || r === "sales_leader" || r === "marketing");
  const qc = useQueryClient();
  const { data } = useSegmentCoverageData(quarter);
  const [extra, setExtra] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [copying, setCopying] = useState(false);

  const rows = useMemo(() => (data ? segmentCoverage(data.segments, data.deals, data.targets, quarterRange(quarter), data.costs) : []), [data, quarter]);
  const costs = data?.costs ?? [];
  const channels = useMemo(() => [...new Set([...CAC_CHANNELS, ...costs.map((c) => c.channel), ...extra])], [costs, extra]);
  const cell = (channel: string, seg: string) => costs.find((c) => c.channel === channel && (c.segment_id ?? SHARED) === seg);
  const columns = [...(data?.segments ?? []).map((s) => ({ id: s.id, name: s.name })), { id: SHARED, name: "Compartido" }];
  const colTotal = (seg: string) => costs.filter((c) => (c.segment_id ?? SHARED) === seg).reduce((s, c) => s + Number(c.amount), 0);
  const totalCost = costs.reduce((s, c) => s + Number(c.amount), 0);
  const totalCustomers = rows.reduce((s, r) => s + r.cac.customers, 0);
  const byChannel = costByChannel(costs);

  async function save(channel: string, seg: string, value: string) {
    const amount = value === "" ? 0 : Number(value);
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Introduce un importe válido");
    const current = cell(channel, seg);
    if (Number(current?.amount ?? 0) === amount) return;
    const { error } = await supabase.from("cac_costs").upsert(
      { org_id: orgId!, segment_id: seg === SHARED ? null : seg, channel, period: quarter, amount },
      { onConflict: "org_id,segment_id,channel,period" },
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  async function copyPrevious() {
    const prev = previousQuarter(quarter);
    setCopying(true);
    const { data: old, error } = await supabase.from("cac_costs").select("segment_id,channel,amount").eq("period", prev);
    if (error || !old?.length) { setCopying(false); return toast.error(error?.message ?? `No hay costes en ${prev}`); }
    const { error: e2 } = await supabase.from("cac_costs").upsert(
      old.map((o) => ({ org_id: orgId!, segment_id: o.segment_id, channel: o.channel, period: quarter, amount: o.amount })),
      { onConflict: "org_id,segment_id,channel,period" },
    );
    setCopying(false);
    if (e2) return toast.error(e2.message);
    toast.success(`Costes de ${prev} copiados. Ajústalos a este trimestre.`);
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  function addChannel() {
    const name = newChannel.trim().slice(0, 60);
    if (!name || channels.includes(name)) return;
    setExtra((x) => [...x, name]);
    setNewChannel("");
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">CAC real · {quarter}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Introduce lo que gastaste para captar clientes, por canal y segmento. CAC = coste / deals ganados en el trimestre.
            Los costes «Compartido» se reparten entre segmentos según los clientes ganados. El payback de la cobertura usa este CAC.
          </p>
        </div>
        <div className="flex items-center gap-4 text-right text-sm">
          <div>
            <p className="font-mono">{money(totalCost)}</p>
            <p className="text-xs text-muted-foreground">coste total</p>
          </div>
          <div>
            <p className="font-mono">{totalCustomers && totalCost ? money(totalCost / totalCustomers) : "—"}</p>
            <p className="text-xs text-muted-foreground">CAC medio · {totalCustomers} clientes</p>
          </div>
          {canEdit && totalCost === 0 && (
            <Button variant="outline" size="sm" onClick={copyPrevious} disabled={copying}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copiar de {previousQuarter(quarter)}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Canal</th>
              {columns.map((c) => <th key={c.id} className="px-2 py-2 text-right font-normal">{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch} className="border-b border-dashed">
                <td className="py-1.5 pr-3">{ch}</td>
                {columns.map((col) => {
                  const v = cell(ch, col.id);
                  return (
                    <td key={col.id} className="px-2 py-1 text-right">
                      {canEdit
                        ? <Input type="number" min={0} aria-label={`${ch} · ${col.name}`} className="ml-auto h-8 w-28 text-right" key={`${ch}-${col.id}-${quarter}-${v?.amount ?? ""}`} defaultValue={v && Number(v.amount) ? Number(v.amount) : ""} placeholder="0" onBlur={(e) => save(ch, col.id, e.target.value)} />
                        : <span className="font-mono text-xs">{v && Number(v.amount) ? money(Number(v.amount)) : "—"}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b font-medium">
              <td className="py-2 pr-3">Total directo</td>
              {columns.map((c) => <td key={c.id} className="px-2 py-2 text-right font-mono text-xs">{money(colTotal(c.id))}</td>)}
            </tr>
            <SummaryRow label="+ Compartido asignado" cells={rows.map((r) => money(r.cac.shared))} />
            <SummaryRow label="Coste total" cells={rows.map((r) => money(r.cac.cost))} strong />
            <SummaryRow label="Deals ganados" cells={rows.map((r) => String(r.cac.customers))} />
            <SummaryRow label="CAC real" cells={rows.map((r) => (r.cac.real != null ? money(r.cac.real) : "—"))} strong />
            <SummaryRow label="CAC objetivo" cells={rows.map((r) => (r.cac.target != null ? money(r.cac.target) : "—"))} muted />
            <SummaryRow
              label="Payback real"
              cells={rows.map((r) => (r.payback.source === "real" && r.payback.real != null ? `${r.payback.real.toFixed(1)} m${r.payback.target != null ? ` / ${r.payback.target}` : ""}` : "—"))}
              tones={rows.map((r) => (r.payback.source !== "real" ? "" : r.payback.ok === false ? "text-signal" : r.payback.ok ? "text-success" : ""))}
              strong
            />
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        {canEdit ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); addChannel(); }}>
            <Input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="Otro canal (p. ej. LinkedIn Ads)" className="h-8 w-56" />
            <Button type="submit" size="sm" variant="ghost" disabled={!newChannel.trim()}><Plus className="mr-1 h-3.5 w-3.5" /> Añadir canal</Button>
          </form>
        ) : <p className="text-xs text-muted-foreground">Solo Owner, Sales Leader y Marketing pueden introducir costes.</p>}
        {byChannel.length > 0 && (
          <div className="w-full max-w-sm space-y-1.5">
            <p className="text-xs text-muted-foreground">Peso de cada canal</p>
            {byChannel.slice(0, 5).map((c) => (
              <div key={c.channel} className="text-xs">
                <div className="flex justify-between"><span>{c.channel}</span><span className="font-mono">{money(c.amount)} · {Math.round(c.share * 100)}%</span></div>
                <div className="mt-0.5 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.round(c.share * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryRow({ label, cells, strong, muted, tones }: { label: string; cells: string[]; strong?: boolean; muted?: boolean; tones?: string[] }) {
  return (
    <tr className={muted ? "text-muted-foreground" : strong ? "font-medium" : ""}>
      <td className="py-1.5 pr-3">{label}</td>
      {cells.map((c, i) => <td key={i} className={`px-2 py-1.5 text-right font-mono text-xs ${tones?.[i] ?? ""}`}>{c}</td>)}
      <td className="px-2 py-1.5" />
    </tr>
  );
}
