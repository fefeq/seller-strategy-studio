import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { parseCsv, normEmail } from "@/lib/dedupe";
import { cohort, funnelBySegment, funnelStats, parseDateCell, type FunnelStats } from "@/lib/self-service";
import { quarterRange } from "@/lib/metrics";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const dd = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} d`);
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function SelfServiceFunnel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data } = useQuery({
    queryKey: ["trials", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [t, s] = await Promise.all([
        supabase.from("trials").select("*").order("signed_up_at", { ascending: false }),
        supabase.from("segments").select("id,name").order("acv_min", { ascending: true }),
      ]);
      if (t.error) throw t.error;
      return { trials: t.data ?? [], segments: s.data ?? [] };
    },
  });

  const view = useMemo(() => {
    if (!data) return null;
    const { start, end } = quarterRange(quarter);
    const c = cohort(data.trials, start, end);
    return { total: funnelStats(c), bySeg: funnelBySegment(c) };
  }, [data, quarter]);

  const segName = (id: string | null) => (id ? data?.segments.find((s) => s.id === id)?.name ?? "Segmento eliminado" : "Sin segmento");
  const rows = view?.bySeg ?? [];
  const best = (k: keyof FunnelStats, low = false) => {
    const vals = rows.filter((r) => r.signups > 0 && r[k] != null).map((r) => r[k] as number);
    if (rows.length < 2 || !vals.length) return null;
    return low ? Math.min(...vals) : Math.max(...vals);
  };
  const bestAct = best("activationRate"), bestPaid = best("trialToPaid"), bestA2P = best("activatedToPaid"), bestTtp = best("medianDaysToPurchase", true);
  const mark = (v: number | null, b: number | null) => (b != null && v === b ? "font-medium text-primary" : "");

  const t = view?.total;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Self-service · PLG</p>
          <h2 className="text-3xl">Funnel self-service {quarter}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cohorte de registros del trimestre: cuántos se activan, cuántos pasan a pago y cuánto tardan.</p>
        </div>
        <ManageTrials trials={data?.trials ?? []} segments={data?.segments ?? []} />
      </div>

      {t && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Activación" v={t.signups ? pct(t.activationRate) : "—"} hint={`${t.activated} de ${t.signups} registros`} />
            <Kpi label="Prueba → pago" v={t.signups ? pct(t.trialToPaid) : "—"} hint={`${t.paid} ${t.paid === 1 ? "cliente" : "clientes"} · activados → pago ${t.activated ? pct(t.activatedToPaid) : "—"}`} />
            <Kpi label="Tiempo hasta la compra" v={dd(t.medianDaysToPurchase)} hint={`Mediana · activación en ${dd(t.medianDaysToActivate)}`} />
            <Kpi label="MRR nuevo self-service" v={money(t.newMrr)} hint={t.paid ? `${money(t.newMrr / t.paid)} por cliente` : "Sin pagos todavía"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-4 text-2xl">Embudo</h3>
              {t.signups === 0 ? (
                <p className="text-sm text-muted-foreground">Sin registros en {quarter}. Añádelos o importa un CSV desde «Gestionar registros».</p>
              ) : (
                <div className="space-y-3">
                  <Step label="Registros / pruebas" n={t.signups} ratio={1} />
                  <Step label="Activados" n={t.activated} ratio={t.activationRate} note={pct(t.activationRate)} />
                  <Step label="Pago" n={t.paid} ratio={t.trialToPaid} note={pct(t.trialToPaid)} />
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-2xl">Comparativa por segmento</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos para comparar.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-normal">Segmento</th>
                      <th className="py-2 pr-3 text-right font-normal">Registros</th>
                      <th className="py-2 pr-3 text-right font-normal">Activación</th>
                      <th className="py-2 pr-3 text-right font-normal">Prueba→pago</th>
                      <th className="py-2 pr-3 text-right font-normal">Activado→pago</th>
                      <th className="py-2 pr-3 text-right font-normal">Días a compra</th>
                      <th className="py-2 text-right font-normal">MRR nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {rows.map((r) => (
                      <tr key={r.segment_id ?? "none"} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-sans text-sm">{segName(r.segment_id)}</td>
                        <td className="py-2 pr-3 text-right">{r.signups}</td>
                        <td className={`py-2 pr-3 text-right ${mark(r.activationRate, bestAct)}`}>{pct(r.activationRate)}</td>
                        <td className={`py-2 pr-3 text-right ${mark(r.trialToPaid, bestPaid)}`}>{pct(r.trialToPaid)}</td>
                        <td className={`py-2 pr-3 text-right ${mark(r.activatedToPaid, bestA2P)}`}>{r.activated ? pct(r.activatedToPaid) : "—"}</td>
                        <td className={`py-2 pr-3 text-right ${mark(r.medianDaysToPurchase, bestTtp)}`}>{dd(r.medianDaysToPurchase)}</td>
                        <td className="py-2 text-right">{money(r.newMrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {rows.length > 1 && <p className="mt-3 text-xs text-muted-foreground">En color, el mejor segmento de cada columna. Días a compra = mediana desde el registro hasta el pago.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Step({ label, n, ratio, note }: { label: string; n: number; ratio: number; note?: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-mono text-xs text-muted-foreground">{n}{note ? ` · ${note}` : ""}</span></div>
      <div className="mt-1 h-7 rounded bg-muted"><div className="h-full rounded bg-primary transition-all" style={{ width: `${Math.max(n ? 2 : 0, Math.round(ratio * 100))}%` }} /></div>
    </div>
  );
}

function Kpi({ label, v, hint }: { label: string; v: string; hint: string }) {
  return <div className="rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-3xl">{v}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>;
}

type TrialRow = { id: string; email: string; company: string; segment_id: string | null; source: string; signed_up_at: string; activated_at: string | null; converted_at: string | null; mrr: number | null };
type Seg = { id: string; name: string };

function ManageTrials({ trials, segments }: { trials: TrialRow[]; segments: Seg[] }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ email: "", company: "", segment_id: "", signed_up_at: new Date().toISOString().slice(0, 10) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["trials"] });

  async function add() {
    const signed = parseDateCell(form.signed_up_at);
    if (!signed) return toast.error("Fecha de alta no válida");
    const { error } = await supabase.from("trials").insert({ email: normEmail(form.email) ?? "", company: form.company.trim(), segment_id: form.segment_id || null, signed_up_at: signed });
    if (error) return toast.error(error.code === "23505" ? "Ya existe un registro con ese email" : error.message);
    setForm((f) => ({ ...f, email: "", company: "" }));
    toast.success("Registro añadido");
    refresh();
  }

  async function patch(id: string, values: Partial<TrialRow>) {
    const { error } = await supabase.from("trials").update(values).eq("id", id);
    if (error) return toast.error(error.code === "23514" ? "La fecha no puede ser anterior al alta" : error.message);
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("trials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function onFile(file: File) {
    const segByName = new Map(segments.map((s) => [s.name.trim().toLowerCase(), s.id]));
    const byEmail = new Map(trials.filter((t) => t.email).map((t) => [t.email.toLowerCase(), t.id]));
    let inserted = 0, updated = 0, skipped = 0;
    for (const r of parseCsv(await file.text())) {
      const email = normEmail(r.email || r.correo) ?? "";
      const signed = parseDateCell(r.alta || r.signup || r.signed_up_at || r.registro);
      const segRaw = (r.segmento || r.segment || "").trim().toLowerCase();
      const row = {
        email,
        company: (r.empresa || r.company || "").trim(),
        segment_id: segRaw ? segByName.get(segRaw) ?? null : null,
        source: (r.fuente || r.source || "").trim(),
        plan: (r.plan || "").trim(),
        activated_at: parseDateCell(r.activacion || r["activación"] || r.activated_at),
        converted_at: parseDateCell(r.pago || r.converted_at || r.paid),
        mrr: r.mrr ? Number(r.mrr.replace(",", ".")) || null : null,
      };
      const existing = email ? byEmail.get(email) : undefined;
      if (existing) {
        const { error } = await supabase.from("trials").update({ ...row, ...(signed ? { signed_up_at: signed } : {}) }).eq("id", existing);
        error ? skipped++ : updated++;
      } else {
        if (!signed) { skipped++; continue; }
        const { error } = await supabase.from("trials").insert({ ...row, signed_up_at: signed });
        error ? skipped++ : inserted++;
        if (!error && email) byEmail.set(email, "pending");
      }
    }
    toast.success(`${inserted} añadidos · ${updated} actualizados · ${skipped} omitidos`);
    refresh();
  }

  const list = trials.filter((t) => !q || `${t.email} ${t.company}`.toLowerCase().includes(q.toLowerCase())).slice(0, 100);

  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline">Gestionar registros</Button></SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader><SheetTitle>Registros self-service</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-6">
          <div className="space-y-2 rounded-lg border p-4">
            <p className="eyebrow">Añadir registro</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <select className="h-9 rounded-md border bg-card px-2 text-sm" value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })}>
                <option value="">Sin segmento</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="date" aria-label="Fecha de alta" value={form.signed_up_at} onChange={(e) => setForm({ ...form, signed_up_at: e.target.value })} />
            </div>
            <Button size="sm" onClick={add}>Añadir</Button>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="eyebrow">Importar CSV</p>
            <p className="text-xs text-muted-foreground">Columnas: email, empresa, segmento (nombre exacto), fuente, plan, alta, activacion, pago, mrr. Fechas AAAA-MM-DD o DD/MM/AAAA. Si el email ya existe, se actualiza.</p>
            <Input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </div>

          <div className="space-y-2">
            <Input placeholder="Buscar por email o empresa" value={q} onChange={(e) => setQ(e.target.value)} />
            {list.length === 0 && <p className="text-sm text-muted-foreground">Sin registros.</p>}
            {list.map((t) => (
              <div key={t.id} className="grid items-center gap-2 border-b py-2 text-sm sm:grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr_auto]">
                <div className="min-w-0">
                  <p className="truncate">{t.company || t.email || "Sin nombre"}</p>
                  <select className="mt-1 h-7 w-full rounded border bg-card px-1 text-xs" value={t.segment_id ?? ""} onChange={(e) => patch(t.id, { segment_id: e.target.value || null })}>
                    <option value="">Sin segmento</option>
                    {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <DateField label="Alta" value={t.signed_up_at} onSave={(v) => v && patch(t.id, { signed_up_at: v })} />
                <DateField label="Activación" value={t.activated_at} onSave={(v) => patch(t.id, { activated_at: v })} />
                <DateField label="Pago" value={t.converted_at} onSave={(v) => patch(t.id, { converted_at: v })} />
                <label className="text-xs text-muted-foreground">MRR
                  <Input type="number" min={0} className="h-8" defaultValue={t.mrr ?? ""} key={`${t.id}-${t.mrr}`} onBlur={(e) => patch(t.id, { mrr: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
                {isOwner ? <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>Borrar</Button> : <span />}
              </div>
            ))}
            {trials.length > 100 && <p className="text-xs text-muted-foreground">Mostrando 100 de {trials.length}. Usa la búsqueda.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DateField({ label, value, onSave }: { label: string; value: string | null; onSave: (iso: string | null) => void }) {
  return (
    <label className="text-xs text-muted-foreground">{label}
      <Input type="date" className="h-8" defaultValue={toDateInput(value)} key={value ?? "none"} onBlur={(e) => { const v = e.target.value; if (v !== toDateInput(value)) onSave(v ? parseDateCell(v) : null); }} />
    </label>
  );
}
