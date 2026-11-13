import { X } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/errors";
import { connectStripe, syncStripeNow } from "@/lib/stripe.functions";
import { ExplanationFold } from "@/components/explanation-fold";
import { ScreenState } from "@/components/page";

/** Connection status and the latest Stripe read of the current company. Key "stripe". */
export function useStripe() {
  return useQuery({
    queryKey: ["stripe"],
    queryFn: async () => {
      const [c, s] = await Promise.all([
        supabase
          .from("stripe_connections")
          .select("key_hint,livemode,restricted,status,last_error,last_synced_at")
          .maybeSingle(),
        supabase
          .from("stripe_snapshots")
          .select("*")
          .order("taken_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      // A failed read must reach the screen as an error, never as «Sin conectar» or «sin lectura».
      const failed = c.error ?? s.error;
      if (failed) throw failed;
      return { connection: c.data, snapshot: s.data };
    },
  });
}

const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "nunca";

/** In Conexiones: the Owner pastes the key; everyone sees whether it works and when it last read. */
export function StripeConnect() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const role = me?.roles[0];
  const isOwner = role === "owner";
  const canSync = isOwner || role === "sales_leader";
  const { data, isPending, error, refetch } = useStripe();
  const connect = useServerFn(connectStripe);
  const sync = useServerFn(syncStripeNow);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const c = data?.connection;

  async function run(fn: () => Promise<{ ok: boolean; error?: string } | void>, ok: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r && !r.ok) toast.error(r.error ?? "Stripe no ha respondido.");
      else toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["stripe"] });
    }
  }
  async function disconnect() {
    await run(async () => {
      const { error } = await supabase.rpc("remove_stripe_key");
      if (error) throw error;
    }, "Stripe desconectado. La clave se ha borrado; las lecturas anteriores se quedan como historial.");
  }

  if (isPending || error)
    return (
      <div className="rounded-lg border bg-card p-4">
        <span className="font-medium">Stripe</span>
        <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="line">
          {null}
        </ScreenState>
      </div>
    );
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">Stripe</span>
        <span
          className={`shrink-0 rounded px-1.5 font-mono text-xs uppercase ${!c ? "bg-muted text-muted-foreground" : c.status === "ok" ? "bg-success/15 text-success" : c.status === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/25"}`}
        >
          {!c
            ? "Sin conectar"
            : c.status === "ok"
              ? "Conectado"
              : c.status === "error"
                ? "Con error"
                : "Conectando"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes de pago, MRR y churn reales en Métricas, leídos de tus suscripciones. Solo lectura:
        Nokko nunca cobra ni cambia nada en Stripe.
      </p>
      {c && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            Clave {c.restricted ? "restringida" : "secreta"}{" "}
            {c.livemode ? "de producción" : "de pruebas"} terminada en «{c.key_hint}» · última
            lectura: {when(c.last_synced_at)} · se lee sola cada 6 horas.
          </p>
          {c.status === "error" && c.last_error && (
            <p className="text-destructive">{c.last_error}</p>
          )}
          {!c.livemode && (
            <p>
              Con una clave de pruebas, Métricas mostrará tus datos de prueba de Stripe, no los
              reales.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {canSync && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => sync(), "Stripe leído de nuevo.")}
              >
                Leer ahora
              </Button>
            )}
            {isOwner && !confirmOff && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmOff(true)}>
                Desconectar
              </Button>
            )}
            {isOwner && confirmOff && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setConfirmOff(false);
                    void disconnect();
                  }}
                >
                  Sí, borrar la clave
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmOff(false)}
                >
                  <IconText icon={X}>Cancelar</IconText>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {isOwner && (
        <details className="mt-3 text-sm" open={!c}>
          <summary className="cursor-pointer text-xs text-signal">
            {c ? "Cambiar la clave" : "Conectar con una clave restringida"}
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>En Stripe, ve a Desarrolladores → Claves de API → «Crear clave restringida».</li>
            <li>
              Ponle un nombre («Nokko») y deja todo en «Ninguno» salvo «Subscriptions», que va en
              «Lectura» («Read»). Ningún permiso de escritura: Nokko solo lee.
            </li>
            <li>Crea la clave, cópiala entera (empieza por rk_live_) y pégala aquí.</li>
          </ol>
          <div className="mt-2 flex gap-2">
            <Input
              type="password"
              autoComplete="off"
              aria-label="Clave restringida de Stripe"
              placeholder="rk_live_…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button
              disabled={busy || !key.trim()}
              onClick={() =>
                run(async () => {
                  const r = await connect({ data: { key } });
                  setKey("");
                  return r;
                }, "Stripe conectado y leído.")
              }
            >
              {busy ? "Conectando…" : "Conectar"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            La clave se guarda cifrada en el servidor. Nadie puede volver a verla desde la app,
            tampoco tú: solo se usa para leer Stripe.
          </p>
        </details>
      )}
      {!isOwner && !c && (
        <p className="mt-3 text-xs text-muted-foreground">
          El Owner de la empresa puede conectarlo desde aquí.
        </p>
      )}
    </div>
  );
}

/** In Métricas: what Stripe says today, with its date. */
export function StripeMetricsPanel() {
  const { data, isPending, error, refetch } = useStripe();
  const { money, currency } = useCurrency();
  const { data: me } = useMe();
  const role = me?.roles[0];
  const c = data?.connection;
  const s = data?.snapshot;
  if (isPending || error)
    return (
      <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="cards">
        {null}
      </ScreenState>
    );
  // The database only gives revenue to these roles; say so instead of showing an empty panel.
  if (c && !s && role && !["owner", "sales_leader", "deal_desk"].includes(role))
    return (
      <p className="text-xs text-muted-foreground">
        Stripe está conectado. Los ingresos solo los ven el Owner, el Sales Leader y Deal Desk.
      </p>
    );
  if (!c && !s)
    return (
      <p className="text-xs text-muted-foreground">
        Clientes de pago, MRR y churn reales:{" "}
        <Link to="/integrations" className="underline">
          conecta Stripe en Conexiones
        </Link>
        .
      </p>
    );
  if (!s)
    return (
      <p className="text-xs text-muted-foreground">
        Stripe está conectado pero aún no hay ninguna lectura
        {c?.status === "error" && c.last_error ? `: ${c.last_error}` : "."}
      </p>
    );
  const d = (s.details ?? {}) as {
    truncated?: boolean;
    unpriced_items?: number;
    other_currencies?: Record<string, { mrr: number; customers: number }>;
  };
  const pctText = (x: number | null) =>
    x == null ? "sin dato" : `${x.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  const sameCurrency = s.currency === currency;
  const tile = (label: string, v: string, hint?: string) => (
    <div className="rounded-lg border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl">{v}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl">Ingresos en Stripe</h2>
        <span className="text-xs text-muted-foreground">
          Lectura del {when(s.taken_at)}
          {!c
            ? " · Stripe está desconectado: es la última lectura, no se actualiza"
            : c.status === "error"
              ? " · la última sincronización falló, ver Conexiones"
              : ""}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {tile(
          "MRR",
          sameCurrency
            ? money(Number(s.mrr))
            : `${Number(s.mrr).toLocaleString("es-ES")} ${s.currency}`,
          `ARR ${sameCurrency ? money(Number(s.mrr) * 12) : `${(Number(s.mrr) * 12).toLocaleString("es-ES")} ${s.currency}`}`,
        )}
        {tile(
          "Clientes de pago",
          String(s.active_customers),
          s.trialing ? `${s.trialing} en prueba` : undefined,
        )}
        {tile(
          `Altas (${s.window_days} días)`,
          String(s.new_customers),
          `+${sameCurrency ? money(Number(s.new_mrr)) : `${Number(s.new_mrr).toLocaleString("es-ES")} ${s.currency}`} de MRR`,
        )}
        {tile(
          `Bajas (${s.window_days} días)`,
          String(s.churned_customers),
          `Churn ${pctText(s.logo_churn_pct == null ? null : Number(s.logo_churn_pct))} de clientes · ${pctText(s.revenue_churn_pct == null ? null : Number(s.revenue_churn_pct))} del MRR`,
        )}
      </div>
      {/* Warnings that depend on the data stay in view; only the fixed counting rules fold. */}
      {d.unpriced_items ||
      d.truncated ||
      (d.other_currencies && Object.keys(d.other_currencies).length) ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {d.unpriced_items
            ? ` ${d.unpriced_items} conceptos con precio por tramos o por uso no se han podido sumar.`
            : ""}
          {d.truncated ? " Hay más de 5.000 suscripciones: las cifras son parciales." : ""}
          {d.other_currencies && Object.keys(d.other_currencies).length
            ? ` Suscripciones en otras monedas, sin convertir: ${Object.entries(d.other_currencies)
                .map(
                  ([k, v]) =>
                    `${v.customers} clientes y ${v.mrr.toLocaleString("es-ES")} ${k} de MRR`,
                )
                .join("; ")}.`
            : ""}
        </p>
      ) : null}
      <ExplanationFold kind="calculo" className="mt-2">
        <p className="text-xs text-muted-foreground">
          Cuenta como cliente de pago quien tiene una suscripción activa o con un pago pendiente,
          igual que Stripe; las pruebas van aparte y una prueba cancelada no es una baja. Un cambio
          de plan no cuenta como alta ni como baja. Las suscripciones impagadas o pausadas dejan de
          contar como clientes de pago, pero no como bajas. Los precios anuales o trimestrales se
          pasan a mes.
        </p>
      </ExplanationFold>
    </section>
  );
}
