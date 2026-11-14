import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askConfirm } from "@/components/confirm-dialog";
import { useCurrency } from "@/hooks/use-me";
import { useBusinessLines } from "@/hooks/use-business-lines";
import { editBusinessLine, syncPrimaryDiagnosis, type EditableLine, type LineEdit } from "@/lib/business-lines-editor";
import { readLineInput } from "@/lib/business-lines";
import { errorText } from "@/lib/errors";
import { diagnose, type Diagnosis, type DiagnosisInput, type Friction, type Model, type Stage } from "@/lib/gtm-diagnosis";

const MODELS: [Model, string][] = [["b2b", "Vendo a empresas"], ["b2c", "Vendo a consumidores"], ["marketplace", "Conecto oferta y demanda"]];
const FRICTIONS: [Friction, string][] = [["self_serve", "Lo prueba solo en minutos"], ["committee", "Necesita integración o un comité"]];
const STAGES: [Stage, string][] = [["idea", "Idea o pre-MVP"], ["early", "Primeros clientes"], ["scale", "Escalando"]];
const label = <T extends string>(list: [T, string][], v: string) => list.find(([k]) => k === v)?.[1] ?? v;

function Choice<T extends string>({ title, value, options, onChange }: { title: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="smallcaps text-ink-mid">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([k, l]) => <Button key={k} type="button" size="sm" variant={value === k ? "default" : "outline"} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</Button>)}
      </div>
    </fieldset>
  );
}

type Draft = DiagnosisInput & { name: string };

export function BusinessLinesStep({ orgId, roles, initial, saveDiagnosis, onNext }: {
  orgId: string | null;
  roles: readonly string[];
  initial: DiagnosisInput;
  saveDiagnosis: (p: { input: DiagnosisInput; result: Diagnosis }) => Promise<void>;
  onNext: () => void;
}) {
  const { money, symbol } = useCurrency();
  const { data: lines, isLoading, error, ports, refresh } = useBusinessLines(orgId, saveDiagnosis);
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const lock = useRef(false);
  const isOwner = roles.includes("owner");
  const list = lines ?? [];
  const primary = list.filter((l) => l.is_primary);

  async function run(action: LineEdit | "sync") {
    if (lock.current) return; // double-submit guard
    lock.current = true; setBusy(true);
    try {
      const r = action === "sync" ? await syncPrimaryDiagnosis(ports) : await editBusinessLine(ports, roles, action);
      if (r.committed || action === "sync") setEditing(null);
      setSyncFailed(!r.diagnosisSynced);
      if (!r.diagnosisSynced) toast.error(`La línea se guardó, pero tu diagnóstico personal no. ${errorText(r.syncError)}`);
      else toast.success(action === "sync" ? "Diagnóstico sincronizado." : "Guardado.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      lock.current = false; setBusy(false);
      void refresh();
    }
  }

  const startNew = () => setEditing({ draft: { ...(list.length ? { model: "b2b", acv: 0, friction: "self_serve", stage: "early" } : initial), name: "" } });
  const startEdit = (l: EditableLine) => {
    const input = readLineInput(l);
    if (input) setEditing({ id: l.id, draft: { ...input, name: l.name ?? "" } });
  };
  async function remove(l: EditableLine) {
    if (await askConfirm(`¿Quitar la línea «${l.name || "sin nombre"}»?`, { description: l.is_primary ? "Otra línea pasará a ser la principal." : "Puedes volver a crearla después." }))
      void run({ kind: "remove", id: l.id });
  }

  if (isLoading) return <p className="text-sm text-ink-mid">Cargando tus líneas de negocio…</p>;
  if (error) return <div className="space-y-3"><p className="text-sm">{errorText(error)}</p><Button variant="outline" onClick={() => void refresh()}>Reintentar</Button></div>;

  const d = editing ? diagnose(editing.draft, (n) => money(n)) : null;

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-ink-mid">
        Cada línea es una forma distinta de vender: otro producto, otro tipo de cliente u otro ticket. Nokko calcula un diagnóstico GTM por línea; la principal guía tu estrategia. Hasta cuatro líneas.
      </p>

      {list.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((l) => {
            const input = readLineInput(l);
            const ld = input ? diagnose(input, (n) => money(n)) : null;
            return (
              <li key={l.id} className={`border-t-2 pt-3 ${l.is_primary ? "border-ink" : "border-hairline"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-xl">{l.name || ld?.name || "Línea sin nombre"}</span>
                  {l.is_primary && <span className="smallcaps text-signal">Principal</span>}
                </div>
                <p className="mt-1 text-sm text-ink-mid">
                  {label(MODELS, l.model)} · <span className="tabular-nums">{money(l.acv)}</span>/año · {label(FRICTIONS, l.friction)} · {label(STAGES, l.stage)}
                </p>
                {ld && <p className="mt-1 text-sm">Arquetipo {ld.archetype}, {ld.name}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(l)}>Editar</Button>
                  {!l.is_primary && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run({ kind: "primary", id: l.id })}>Hacer principal</Button>}
                  {isOwner && list.length > 1 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove(l)}>Quitar</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!isOwner && list.length > 1 && <p className="text-xs text-ink-faint">Solo el Owner puede quitar líneas.</p>}

      {syncFailed && (
        <div className="flex flex-wrap items-center gap-3 border border-hairline-firm p-3 text-sm">
          <span>Tus líneas están guardadas, pero falta copiar el diagnóstico de la principal a tu onboarding.</span>
          <Button size="sm" disabled={busy} onClick={() => void run("sync")}>Reintentar sincronización</Button>
        </div>
      )}

      {editing && d ? (
        <form className="grid gap-10 border-t border-hairline pt-6 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void run({ kind: "save", id: editing.id, input: editing.draft, name: editing.draft.name }); }}>
          <div className="space-y-6">
            <div>
              <label htmlFor="bl-name" className="smallcaps text-ink-mid">Nombre (opcional)</label>
              <Input id="bl-name" className="mt-2" maxLength={200} value={editing.draft.name} placeholder="Ej.: Plan Pro para pymes" onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} />
            </div>
            <Choice title="Modelo" value={editing.draft.model} options={MODELS} onChange={(model) => setEditing({ ...editing, draft: { ...editing.draft, model } })} />
            <div>
              <label htmlFor="bl-acv" className="smallcaps text-ink-mid">Ticket anual por cliente ({symbol})</label>
              <Input id="bl-acv" className="mt-2 max-w-48 tabular-nums" inputMode="numeric" value={editing.draft.acv || ""} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, acv: Number(e.target.value.replace(/\D/g, "")) || 0 } })} />
            </div>
            <Choice title="Adopción" value={editing.draft.friction} options={FRICTIONS} onChange={(friction) => setEditing({ ...editing, draft: { ...editing.draft, friction } })} />
            <Choice title="Etapa" value={editing.draft.stage} options={STAGES} onChange={(stage) => setEditing({ ...editing, draft: { ...editing.draft, stage } })} />
          </div>
          <div className="border-t-2 border-hairline-firm pt-4">
            <p className="smallcaps text-signal">Diagnóstico de esta línea · arquetipo {d.archetype}</p>
            <h2 className="mt-1 font-display text-3xl">{d.name}</h2>
            <p className="mt-3 text-sm"><span className="smallcaps text-ink-mid">Se activa</span> {[...d.forced, ...d.active].join(" · ")}</p>
            <p className="mt-2 text-sm"><span className="smallcaps text-ink-mid">Siguiente paso</span> {d.nextStep}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || editing.draft.acv <= 0}>{editing.id ? "Guardar cambios" : "Guardar línea"}</Button>
              {list.length > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button>}
            </div>
            {editing.draft.acv <= 0 && <p className="mt-2 text-xs text-ink-faint">Indica un ticket mayor que cero.</p>}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
          {list.length < 4 && <Button variant={list.length ? "outline" : "default"} onClick={startNew}>{list.length ? "Añadir otra línea" : "Crear tu primera línea"}</Button>}
          {list.length >= 4 && <p className="text-sm text-ink-mid">Ya tienes cuatro líneas, el máximo.</p>}
          <Button disabled={busy || primary.length !== 1 || syncFailed} onClick={onNext}>Continuar</Button>
        </div>
      )}
    </div>
  );
}
