import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Field, Pick } from "@/components/fields";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/hooks/use-me";
import { lastQuarters } from "@/lib/pipeline-real";
import { acquisitionMotionText } from "@/lib/acquisition-motion";
import { loadFunnelDiagnosis } from "@/lib/funnel-diagnosis-data";
import type { Measure, Phase } from "@/lib/funnel-diagnosis";
import { errorText } from "@/lib/errors";

const valueText = (m: Measure) => {
  if (m.value == null) return m.status === "no_medido" ? "no medido" : "sin datos";
  const n = m.value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  return m.unit === "%" ? `${n} %` : m.unit === "meses" ? `${n} meses` : n;
};
const countText = (m: Measure) => (m.numerator != null && m.denominator != null ? `${m.numerator} de ${m.denominator}` : null);

function MeasureRow({ m }: { m: Measure }) {
  const count = countText(m);
  return (
    <div className="border-t px-3 py-2 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="break-words text-sm">{m.label}</span>
        <span className="flex items-center gap-2">
          <span className={`font-display text-lg ${m.status === "ok" ? "" : "text-muted-foreground"}`}>{valueText(m)}</span>
          {count && <span className="text-xs text-muted-foreground">{count}</span>}
          {m.verdict === "fuga" && <Badge variant="destructive">Fuga · objetivo {m.target} {m.unit === "meses" ? "meses" : "%"}</Badge>}
          {m.verdict === "en_objetivo" && <Badge variant="secondary">En objetivo · {m.target} {m.unit === "meses" ? "meses" : "%"}</Badge>}
        </span>
      </div>
      {m.status !== "ok" && m.missing && <p className="mt-1 text-xs text-muted-foreground">{m.status === "no_medido" ? m.missing : `Falta: ${m.missing}`}</p>}
      <p className="mt-0.5 break-words text-xs text-muted-foreground">Fuente: {m.source}</p>
    </div>
  );
}

function PhaseBlock({ p }: { p: Phase }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5">
        <span className="eyebrow text-xs">{p.label}</span>
        {p.status === "no_medido" && <span className="text-xs text-muted-foreground">no medido</span>}
        {p.status === "sin_datos" && <span className="text-xs text-muted-foreground">sin datos</span>}
      </div>
      {p.measures.map((m) => <MeasureRow key={m.id} m={m} />)}
    </div>
  );
}

/** Same data and same function as the get_funnel_diagnosis tool (loadFunnelDiagnosis), so the screen and the chat say the same. */
export function FunnelDiagnosisPanel() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const quarters = lastQuarters();
  const [quarter, setQuarter] = useState(quarters[0]!);
  const { data, error, isLoading } = useQuery({
    queryKey: ["segment-coverage", "funnel-diagnosis", orgId, quarter],
    enabled: !!orgId,
    queryFn: () => loadFunnelDiagnosis(supabase, orgId!, quarter),
  });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border bg-card p-6 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="eyebrow">Diagnóstico AARRR</p>
          <Field label="Trimestre"><Pick value={quarter} options={Object.fromEntries(quarters.map((q) => [q, q]))} onChange={setQuarter} /></Field>
        </div>
        <p className="text-sm text-muted-foreground">
          Dónde se pierde negocio, por segmento, con los datos que ya tiene Nokko. Una fase sin datos dice qué falta y nunca se rellena con una estimación. Solo se marca «fuga» donde el segmento tiene un objetivo (win rate o payback) contra el que comparar.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}
      {data && !data.segments.length && <p className="text-sm text-muted-foreground">Aún no hay segmentos. Créalos en «Modelos de venta por segmento».</p>}
      {data?.segments.map((s) => (
        <section key={s.segment_id} className="space-y-3 rounded-lg border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl">{s.name}</h3>
            <span className="text-sm text-muted-foreground">Motion de adquisición: {acquisitionMotionText(s.acquisition_motion)}</span>
          </div>
          {!s.acquisition_motion && <p className="text-xs text-muted-foreground">Sin motion de adquisición, Revenue muestra prueba a pago y deals sin juicio. Defínelo en «Modelos de venta por segmento».</p>}
          <div className="grid items-start gap-3 md:grid-cols-2">{s.phases.map((p) => <PhaseBlock key={p.id} p={p} />)}</div>
        </section>
      ))}
      {data && (
        <section className="space-y-3 rounded-lg border bg-card p-6">
          <h3 className="font-display text-2xl">Retention de la empresa</h3>
          <p className="text-xs text-muted-foreground">Stripe no separa a los clientes por segmento, así que el churn solo se puede ver para toda la empresa.</p>
          <div className="overflow-hidden rounded-md border"><MeasureRow m={data.company.retention} /></div>
        </section>
      )}
    </div>
  );
}
