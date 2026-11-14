import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconText } from "@/components/icon-text";
import { askConfirm } from "@/components/confirm-dialog";
import { useMe } from "@/hooks/use-me";
import { saveCustomPlay } from "@/lib/custom-plays.functions";
import { errorText } from "@/lib/errors";
import { checkCustomControl } from "@/lib/plays/custom/controls";
import { canTogglePlays } from "@/lib/plays/status";
import { jsonObject } from "@/lib/json";
import type { Tables } from "@/integrations/supabase/types";
import { CUSTOM_PLAYS_KEY, customPlaysQuery } from "./custom-play-queries";
import { CustomPlayActivity } from "./custom-play-activity";

const STATUS: Record<string, string> = { aprobado: "Aprobado · sin activar", activo: "Activo", pausado: "Pausado", archivado: "Archivado" };
function CustomPlayRow({ row, roles }: { row: Tables<"custom_plays">; roles: string[] }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const save = useServerFn(saveCustomPlay);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sample, setSample] = useState(String(row.test_sample ?? ""));
  const [successes, setSuccesses] = useState(String(row.test_successes ?? ""));
  const enabled = row.status !== "activo";
  const permission = checkCustomControl(roles, row.status, row.execution_pause, enabled);
  const d = jsonObject(row.definition);
  async function submit(action: { kind: "toggle"; enabled: boolean } | { kind: "result"; sample: number; successes: number }) {
    const orgId = me?.currentOrg?.org_id;
    if (!orgId) return;
    if (action.kind === "toggle" && action.enabled && !(await askConfirm(`Activar «${row.name}»`, { body: "Nokko buscará señales en las próximas revisiones automáticas y podrá consumir el presupuesto de tu empresa. Solo guardará pruebas y sugerencias; no enviará mensajes.", confirmLabel: "Activar" }))) return;
    setBusy(true);
    try {
      const r = await save({ data: { orgId, playId: row.id, action } });
      toast.success(r.mensaje); setEditing(false);
      await qc.invalidateQueries({ queryKey: CUSTOM_PLAYS_KEY });
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return <li className="min-w-0 border-t py-5">
    <p className="eyebrow">{d?.origin === "biblioteca" || (typeof d?.id === "string" && ["nokko:r1", "nokko:r2", "nokko:r3"].includes(d.id)) ? "De Nokko" : "Creado para tu empresa"}</p>
    <h3 className="mt-1 break-words text-lg font-medium">{row.name}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{STATUS[row.status] ?? "Estado sin dato"}{row.verified_only ? " · Solo contactos verificados" : ""}</p>
    {typeof d?.trigger === "string" && <p className="mt-2 break-words text-sm">{d.trigger}</p>}
    {row.execution_pause && <p className="mt-2 text-sm text-state-alarm">Pausa de seguridad: {row.execution_pause === "provider_denied" ? "el proveedor denegó el acceso" : row.execution_pause === "uncertain" ? "hay un paso sin resultado confirmado" : "la ejecución necesita revisión"}. No se reintenta automáticamente.</p>}
    <p className="mt-2 text-sm text-muted-foreground">{row.test_recorded_at ? `Resultado: ${row.test_successes} éxitos de ${row.test_sample} · ${new Date(row.test_recorded_at).toLocaleDateString("es-ES")}` : "Sin resultado de prueba registrado."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant={enabled ? "default" : "outline"} disabled={busy || !permission.ok} onClick={() => submit({ kind: "toggle", enabled })}><IconText icon={enabled ? Play : Pause}>{enabled ? "Activar" : "Pausar"}</IconText></Button>
      <Button size="sm" variant="outline" disabled={busy || !canTogglePlays(roles).ok || row.status === "archivado"} onClick={() => { setSample(String(row.test_sample ?? "")); setSuccesses(String(row.test_successes ?? "")); setEditing(!editing); }}>Registrar resultado</Button>
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Ocultar actividad" : "Pruebas y sugerencias"}</Button>
    </div>
    {!permission.ok && <p className="mt-2 text-sm text-muted-foreground">{permission.reason}</p>}
    {editing && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit({ kind: "result", sample: Number(sample), successes: Number(successes) }); }}>
      <label className="text-sm">Muestra observada<Input type="number" min={1} step={1} required value={sample} onChange={e => setSample(e.target.value)} /></label>
      <label className="text-sm">Éxitos observados<Input type="number" min={0} max={sample || undefined} step={1} required value={successes} onChange={e => setSuccesses(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button size="sm" type="submit" disabled={busy}><IconText icon={Check}>Guardar resultado</IconText></Button><Button size="sm" variant="outline" type="button" onClick={() => setEditing(false)}><IconText icon={X}>Cancelar</IconText></Button></div>
    </form>}
    {open && <CustomPlayActivity playId={row.id} playKey={row.key} />}
  </li>;
}

export function CustomPlaysPanel({ roles }: { roles: string[] }) {
  const { data: rows } = useSuspenseQuery(customPlaysQuery);
  return <section className="mb-8" aria-labelledby="custom-plays-title"><h2 id="custom-plays-title" className="mb-3 text-xl font-medium">Plays de tu empresa</h2>
    {!rows.length && <p className="text-sm text-muted-foreground">Todavía no hay plays guardados para esta empresa.</p>}
    <ul className="grid gap-x-8 lg:grid-cols-2">{rows.map(row => <CustomPlayRow key={row.id} row={row} roles={roles} />)}</ul>
  </section>;
}