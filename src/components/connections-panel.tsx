// «Tus cuentas» in Conexiones: one card per provider with its state in words, the account, who connected it and
// when, what it is used for, and (Owner only) connect, change or disconnect. Rules in src/lib/connections.ts.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { PROVIDERS, READ_ONLY_NOTE, STATE_LABEL, canManage, connectSteps, connectedLine, connectionState, coverageNote, disconnectNote, rowFromPosthog, rowFromStripe, type ConnectionRow, type Provider } from "@/lib/connections";
import { connectAccountFn, disconnectAccountFn, nokkoProvidedFn } from "@/lib/connections.functions";

function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const [own, ph, st, who] = await Promise.all([
        supabase.from("org_connections").select("provider,status,account_label,connected_by,connected_at,last_error,fallback_active"),
        supabase.from("posthog_connections").select("project_id,status,created_at,created_by,last_error").maybeSingle(),
        supabase.from("stripe_connections").select("account_name,key_hint,status,created_at,connected_by,last_error").maybeSingle(),
        supabase.from("profiles").select("id,full_name"),
      ]);
      const rows = new Map<string, ConnectionRow>();
      for (const r of own.data ?? []) rows.set(r.provider, { ...r, status: r.status as ConnectionRow["status"] });
      const p = rowFromPosthog(ph.data); if (p) rows.set("posthog", p);
      const s = rowFromStripe(st.data); if (s) rows.set("stripe", s);
      return { rows, names: new Map((who.data ?? []).map((m) => [m.id, m.full_name])) };
    },
  });
}

const tone = (s: ReturnType<typeof connectionState>) => (s === "own" ? "bg-muted text-foreground" : s === "error" || s === "no_response" ? "bg-warning/25" : "bg-muted text-muted-foreground");

function ConnectForm({ p, onDone, onCancel }: { p: Provider; onDone: () => void; onCancel: () => void }) {
  const connect = useServerFn(connectAccountFn);
  const [credential, setCredential] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string; accountLabel?: string; needsConfirmation?: boolean; saved?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(mode: "check" | "save", confirmShared = false) {
    setBusy(true);
    try {
      const r = await connect({ data: { provider: p.id, credential, mode, confirmShared } });
      setResult(r);
      if (r.ok && r.saved) { setCredential(""); toast.success(r.message); onDone(); }
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">{connectSteps(p.kind, p.name).map((s) => <li key={s}>{s}</li>)}</ol>
      {p.kind === "key" && <Input type="password" autoComplete="off" aria-label={`Clave de ${p.name}`} value={credential} onChange={(e) => { setCredential(e.target.value); setResult(null); }} placeholder="Pega la clave" />}
      {result && <p role="status" className="text-xs">{result.message}</p>}
      <div className="flex flex-wrap gap-2">
        {!(result?.ok && !result.saved) && <Button size="sm" disabled={busy || (p.kind === "key" && !credential.trim())} onClick={() => run("check")}>Comprobar</Button>}
        {result?.ok && !result.saved && <Button size="sm" disabled={busy} onClick={() => run("save", !!result.needsConfirmation)}>{result.needsConfirmation ? "Usar igualmente" : "Guardar"}</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function ConnectionsPanel() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const manage = canManage(me?.roles[0]);
  const { data } = useConnections();
  const { data: provided } = useQuery({ queryKey: ["connections-provided"], queryFn: () => nokkoProvidedFn() });
  const disconnect = useServerFn(disconnectAccountFn);
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["connections"] }); setOpen(null); };

  async function off(p: Provider) {
    if (!(await askConfirm(`¿Desconectar tu cuenta de ${p.name}?`, { body: disconnectNote(p.name), confirmLabel: "Desconectar" }))) return;
    try {
      const r = await disconnect({ data: { provider: p.id } });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) { toast.error(errorText(e)); }
    refresh();
  }

  return (
    <section className="mb-10">
      <h2 className="text-3xl">Tus cuentas</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Usa tu propia cuenta de cada proveedor. NOKKO solo hará lo que se indica en cada tarjeta.{!manage && ` ${READ_ONLY_NOTE}`}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PROVIDERS.map((p) => {
          const row = data?.rows.get(p.id) ?? null;
          const state = connectionState(p, row, !!provided?.provided.includes(p.id));
          const own = state === "own" || state === "error" || state === "no_response";
          const canConnect = manage && p.kind !== "panel" && p.ownAccount;
          return (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium">{p.name}</span>
                <span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${tone(state)}`}>{STATE_LABEL[state]}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.purpose}</p>
              {row && <p className="mt-2 break-words text-xs">{connectedLine(row, row.connected_by ? data?.names.get(row.connected_by) ?? null : null)}</p>}
              {row?.last_error && state !== "own" && <p className="mt-1 text-xs text-muted-foreground">{row.last_error}</p>}
              {coverageNote(row) && <p className="mt-1 text-xs text-muted-foreground">{coverageNote(row)}</p>}
              {p.kind === "panel" && <p className="mt-2 text-xs text-muted-foreground">Se gestiona en su panel, más abajo.</p>}
              {canConnect && open !== p.id && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(p.id)}>{own ? "Cambiar" : "Conectar mi cuenta"}</Button>
                  {own && <Button size="sm" variant="ghost" onClick={() => off(p)}>Desconectar</Button>}
                </div>
              )}
              {open === p.id && <ConnectForm p={p} onDone={refresh} onCancel={() => setOpen(null)} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
