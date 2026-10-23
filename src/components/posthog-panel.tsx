// The company's own PostHog: connect it (Owner), choose which events mean sign-up, activation and payment,
// and see product usage per account. Data reads run on the server (posthog.functions.ts).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/errors";
import { ageText } from "@/lib/web-research";
import { TREND_LABEL, usageTrend } from "@/lib/product-usage";
import { configurePosthogFn, connectPosthogFn, disconnectPosthogFn, posthogEventsFn, syncPosthogFn } from "@/lib/posthog.functions";

export function usePosthog() {
  return useQuery({
    queryKey: ["posthog"],
    queryFn: async () => (await supabase.from("posthog_connections").select("host,project_id,key_hint,signup_event,activation_event,paid_event,domain_property,status,last_synced_at,last_error").maybeSingle()).data,
  });
}

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca");
type SyncResult = { ok: boolean; error?: string; trials?: { added: number; updated: number }; usage?: { companies: number; matched: number } };
const syncText = (r: SyncResult) => [
  r.usage ? `${r.usage.companies} empresas con uso (${r.usage.matched} ya son cuentas en Nokko)` : "",
  r.trials ? `${r.trials.added} altas nuevas y ${r.trials.updated} actualizadas en el funnel` : "",
].filter(Boolean).join(" · ") || "PostHog leído.";

/** In Conexiones. */
export function PosthogConnect() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const role = me?.roles[0];
  const isOwner = role === "owner";
  const canSync = isOwner || role === "sales_leader";
  const { data: c } = usePosthog();
  const connect = useServerFn(connectPosthogFn);
  const listEvents = useServerFn(posthogEventsFn);
  const configure = useServerFn(configurePosthogFn);
  const sync = useServerFn(syncPosthogFn);
  const disconnect = useServerFn(disconnectPosthogFn);
  const [form, setForm] = useState({ region: "eu", host: "", projectId: "", key: "" });
  const [events, setEvents] = useState<string[] | null>(null);
  const [cfg, setCfg] = useState<{ signup: string; activation: string; paid: string; domainProperty: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["posthog"] }); qc.invalidateQueries({ queryKey: ["product-usage"] }); qc.invalidateQueries({ queryKey: ["trials"] }); };

  async function run<T>(fn: () => Promise<T>, onOk: (r: T) => void) {
    setBusy(true);
    try { onOk(await fn()); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); refresh(); }
  }
  const openConfig = (list: string[]) => {
    setEvents(list);
    setCfg({ signup: c?.signup_event ?? "", activation: c?.activation_event ?? "", paid: c?.paid_event ?? "", domainProperty: c?.domain_property ?? "" });
  };
  const host = form.region === "custom" ? form.host : form.region;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">PostHog (tu producto)</span>
        <span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${!c ? "bg-muted text-muted-foreground" : c.status === "ok" ? "bg-success/15 text-success" : c.status === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/25"}`}>
          {!c ? "Sin conectar" : c.status === "ok" ? "Conectado" : c.status === "error" ? "Con error" : "Conectando"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Los datos de uso de tu producto: altas, activación y pago en el funnel self-service de Métricas, uso por cuenta en cada ficha y avisos de leads cualificados por producto o de clientes que dejan de usarlo. Solo lectura.</p>
      {c && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Proyecto {c.project_id} en {c.host.replace("https://", "")} · clave terminada en «{c.key_hint}» · última lectura: {when(c.last_synced_at)} · se lee sola cada 6 horas.</p>
          <p>Funnel: {c.signup_event ? <>alta = «{c.signup_event}»{c.activation_event ? <>, activación = «{c.activation_event}»</> : null}{c.paid_event ? <>, pago = «{c.paid_event}»</> : null}</> : "elige el evento de alta para llenar el funnel"} · empresa por {c.domain_property ? `la propiedad «${c.domain_property}»` : "el dominio del email"}.</p>
          {c.status === "error" && c.last_error && <p className="text-destructive">{c.last_error}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {canSync && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => sync(), (r) => (r.ok ? toast.success(syncText(r)) : toast.error(r.error ?? "PostHog no ha respondido.")))}>Leer ahora</Button>}
            {isOwner && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => listEvents(), openConfig)}>Elegir eventos</Button>}
            {isOwner && !confirmOff && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmOff(true)}>Desconectar</Button>}
            {isOwner && confirmOff && <>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setConfirmOff(false); void run(() => disconnect(), () => toast.success("PostHog desconectado. La clave y el uso por cuenta se han borrado; las altas del funnel se quedan.")); }}>Sí, desconectar</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmOff(false)}>Cancelar</Button>
            </>}
          </div>
        </div>
      )}
      {isOwner && events && cfg && (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          <p className="eyebrow">Qué significa cada evento</p>
          <datalist id="posthog-events">{events.map((e) => <option key={e} value={e} />)}</datalist>
          {([["signup", "Alta (registro o inicio de prueba)"], ["activation", "Activación (opcional: el momento «ajá»)"], ["paid", "Pago (opcional: pasa a plan de pago)"]] as const).map(([k, label]) => (
            <label key={k} className="block text-xs">{label}
              <Input className="mt-1" list="posthog-events" placeholder="Nombre del evento en PostHog" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} />
            </label>
          ))}
          <label className="block text-xs">Propiedad de persona con el dominio de su empresa (opcional; si no, se usa el dominio del email)
            <Input className="mt-1" placeholder="p. ej. company_domain" value={cfg.domainProperty} onChange={(e) => setCfg({ ...cfg, domainProperty: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => configure({ data: { signup: cfg.signup || null, activation: cfg.activation || null, paid: cfg.paid || null, domainProperty: cfg.domainProperty || null } }), (r) => { setEvents(null); r.ok ? toast.success(syncText(r)) : toast.error(r.error ?? "PostHog no ha respondido."); })}>{busy ? "Guardando y leyendo…" : "Guardar y leer"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEvents(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {isOwner && (
        <details className="mt-3 text-sm" open={!c}>
          <summary className="cursor-pointer text-xs text-signal">{c ? "Cambiar la conexión" : "Conectar el PostHog de esta empresa"}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>En PostHog, ve a Ajustes de tu cuenta → Claves de API personales → «Crear clave».</li>
            <li>Dale acceso solo al proyecto del producto y el permiso «Query: Read». Nada de escritura.</li>
            <li>Copia la clave (empieza por phx_) y el ID del proyecto (el número en la dirección: /project/12345).</li>
          </ol>
          <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
            <select aria-label="Región de PostHog" className="h-9 rounded-md border bg-background px-2 text-sm" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
              <option value="eu">PostHog EU</option><option value="us">PostHog US</option><option value="custom">Propio</option>
            </select>
            {form.region === "custom"
              ? <Input placeholder="https://posthog.tuempresa.com" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
              : <Input inputMode="numeric" placeholder="ID del proyecto (12345)" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />}
            {form.region === "custom" && <Input className="sm:col-start-2" inputMode="numeric" placeholder="ID del proyecto (12345)" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />}
            <Input className="sm:col-start-2" type="password" autoComplete="off" aria-label="Clave personal de PostHog" placeholder="phx_…" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          </div>
          <Button className="mt-2" disabled={busy || !form.key.trim() || !form.projectId.trim()} onClick={() => run(() => connect({ data: { host, projectId: form.projectId, key: form.key } }), (r) => { setForm({ ...form, key: "" }); toast.success("PostHog conectado. Ahora elige qué evento es el alta."); openConfig(r.events); })}>{busy ? "Comprobando…" : "Conectar"}</Button>
          <p className="mt-1 text-[11px] text-muted-foreground">La clave se guarda cifrada en el servidor. Nadie puede volver a verla desde la app: solo se usa para leer PostHog.</p>
        </details>
      )}
      {!isOwner && !c && <p className="mt-3 text-xs text-muted-foreground">El Owner de la empresa puede conectarlo desde aquí.</p>}
    </div>
  );
}

/** On the account page: how much the account uses the product (from the company's PostHog). */
export function ProductUsageCard({ accountId }: { accountId: string }) {
  const { data } = useQuery({
    queryKey: ["product-usage", accountId],
    queryFn: async () => (await supabase.from("product_usage").select("domain,active_users_7d,active_users_prev_7d,active_users_30d,events_30d,last_seen_at,synced_at").eq("account_id", accountId)).data ?? [],
  });
  if (!data?.length) return null;
  const wau = data.reduce((s, u) => s + u.active_users_7d, 0);
  const prev = data.reduce((s, u) => s + u.active_users_prev_7d, 0);
  const mau = data.reduce((s, u) => s + u.active_users_30d, 0);
  const last = data.map((u) => u.last_seen_at).filter(Boolean).sort().pop() ?? null;
  const trend = usageTrend(wau, prev);
  return (
    <div className="border-t pt-3 text-sm">
      <p className="eyebrow">Uso del producto (PostHog)</p>
      <p className="mt-1"><span className="font-display text-2xl">{wau}</span> {wau === 1 ? "persona activa" : "personas activas"} esta semana · <span className={trend === "down" ? "text-destructive" : trend === "up" || trend === "new" ? "text-success" : ""}>{TREND_LABEL[trend]}</span> (antes {prev})</p>
      <p className="text-xs text-muted-foreground">{mau} en 30 días · último uso {last ? ageText(last) : "—"} · {data.map((u) => u.domain).join(", ")}</p>
    </div>
  );
}
