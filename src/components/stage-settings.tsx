import { useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import {
  checkStageEdit,
  newStageKey,
  openStages,
  reorderOpen,
  sortStages,
  type BoardGroup,
  type Stage,
} from "@/lib/stages";

/** The company's deal stages in order. Falls back to the default seven until they load. Key "deal-stages". */
export function useStages() {
  const q = useQuery({
    queryKey: ["deal-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id,key,label,position,kind,board_group,probability,color");
      if (error) throw error;
      return (data ?? []) as Stage[];
    },
    staleTime: 60_000,
  });
  return { ...q, stages: sortStages(q.data) };
}

const GROUPS: Record<BoardGroup, string> = { opportunity: "Oportunidad", progress: "En proceso" };
type Draft = { label: string; probability: string };

/** Owner and Sales Leader rename, reorder, add and remove stages. Rules the database also enforces are checked here first. */
export function StageSettings({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { stages, data } = useStages();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [newLabel, setNewLabel] = useState("");
  const loaded = !!data?.length;
  const editable = canEdit && loaded;

  /** Runs a change, then waits for the fresh stages before letting the next one start. True if it saved. */
  async function run(fn: () => Promise<unknown>, ok?: string): Promise<boolean> {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["deal-stages"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorText(e));
      await qc.invalidateQueries({ queryKey: ["deal-stages"] });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const value = (s: Stage): Draft =>
    draft[s.key] ?? { label: s.label, probability: String(s.probability) };
  const dropDraft = (key: string) => setDraft(({ [key]: _, ...rest }) => rest);

  // Saved on blur only (Enter blurs), so a field never saves twice; the draft stays until the save lands.
  async function saveRow(s: Stage) {
    const v = draft[s.key];
    if (!v || busy) return;
    const fixed = s.kind !== "open";
    const prob = fixed ? s.probability : v.probability.trim() === "" ? NaN : Number(v.probability);
    if (v.label.trim() === s.label && prob === s.probability) return dropDraft(s.key);
    const err = checkStageEdit(v.label, prob, stages, s.key);
    if (err) return toast.error(err);
    const saved = await run(
      () =>
        confirmed(
          supabase
            .from("deal_stages")
            .update({ label: v.label.trim(), probability: prob })
            .eq("id", s.id!)
            .select("id"),
        ),
      "Etapa guardada.",
    );
    if (saved) dropDraft(s.key);
  }
  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  async function setGroup(s: Stage, g: BoardGroup) {
    await run(() =>
      confirmed(
        supabase.from("deal_stages").update({ board_group: g }).eq("id", s.id!).select("id"),
      ),
    );
  }
  async function move(s: Stage, dir: -1 | 1) {
    const changes = reorderOpen(stages, s.key, dir);
    if (!changes.length) return;
    // One call renumbers every open stage in a single transaction.
    const order = openStages(stages).map((x) => x.key);
    const i = order.indexOf(s.key);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await run(async () => {
      const { error } = await supabase.rpc("reorder_deal_stages", { _keys: order });
      if (error) throw error;
    });
  }
  async function remove(s: Stage) {
    await run(
      () => confirmed(supabase.from("deal_stages").delete().eq("id", s.id!).select("id")),
      `«${s.label}» borrada.`,
    );
  }
  async function add() {
    if (busy || !newLabel.trim()) return;
    const err = checkStageEdit(newLabel, 50, stages);
    if (err) return toast.error(err);
    const opens = openStages(stages);
    const last = opens[opens.length - 1];
    const label = newLabel.trim();
    const saved = await run(
      () =>
        confirmed(
          supabase
            .from("deal_stages")
            .insert({
              key: newStageKey(label, stages),
              label,
              position: (last?.position ?? 0) + 1,
              kind: "open",
              board_group: "progress",
              probability: Math.min(95, (last?.probability ?? 0) + 10),
            })
            .select("id"),
        ),
      `«${label}» añadida al final de las etapas abiertas.`,
    );
    if (saved) setNewLabel("");
  }

  const opens = openStages(stages);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Etapas</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etapas del pipeline</DialogTitle>
          <DialogDescription>
            El nombre y la probabilidad son tuyos; la probabilidad se aplica al mover un deal a esa
            etapa y alimenta el forecast ponderado.
            {canEdit
              ? " Una etapa con deals no se puede borrar: muévelos antes."
              : " Solo el Owner o el Sales Leader pueden cambiarlas."}
          </DialogDescription>
        </DialogHeader>
        {!loaded && (
          <p className="text-sm text-muted-foreground">Cargando las etapas de tu empresa…</p>
        )}
        <ol className="divide-y divide-hairline border-y border-hairline text-sm">
          {stages.map((s) => {
            const v = value(s);
            const i = opens.findIndex((o) => o.key === s.key);
            const fixed = s.kind !== "open";
            return (
              <li
                key={s.key}
                className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_8.5rem_auto]"
              >
                <Input
                  aria-label={`Nombre de la etapa ${s.label}`}
                  value={v.label}
                  readOnly={!editable}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, [s.key]: { ...v, label: e.target.value } })}
                  onBlur={() => saveRow(s)}
                  onKeyDown={blurOnEnter}
                />
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={`Probabilidad de ${s.label} en %`}
                    inputMode="numeric"
                    value={v.probability}
                    readOnly={!editable || fixed}
                    title={fixed ? "Ganado cuenta siempre al 100 % y Perdido al 0 %." : undefined}
                    onChange={(e) =>
                      setDraft({ ...draft, [s.key]: { ...v, probability: e.target.value } })
                    }
                    onBlur={() => saveRow(s)}
                    onKeyDown={blurOnEnter}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                {s.kind === "open" ? (
                  <Pick
                    aria-label={`Bloque del tablero de ${s.label}`}
                    disabled={!editable || busy}
                    value={s.board_group ?? "progress"}
                    options={GROUPS}
                    onChange={(g) => setGroup(s, g as BoardGroup)}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {s.kind === "won" ? "Cierre ganado" : "Cierre perdido"}
                  </span>
                )}
                {s.kind === "open" && editable ? (
                  <span className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Subir ${s.label}`}
                      disabled={busy || i === 0}
                      onClick={() => move(s, -1)}
                    >
                      <span aria-hidden>↑</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Bajar ${s.label}`}
                      disabled={busy || i === opens.length - 1}
                      onClick={() => move(s, 1)}
                    >
                      <span aria-hidden>↓</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Borrar ${s.label}`}
                      disabled={busy || opens.length === 1}
                      onClick={() => remove(s)}
                    >
                      <span aria-hidden>×</span>
                    </Button>
                  </span>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            );
          })}
        </ol>
        {editable && (
          <div className="flex gap-2">
            <Input
              aria-label="Nombre de la nueva etapa"
              placeholder="Nueva etapa, por ejemplo Piloto"
              maxLength={40}
              value={newLabel}
              disabled={busy}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button disabled={busy || !newLabel.trim()} onClick={add}>
              Añadir
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          «Oportunidad» y «En proceso» deciden en qué bloque del tablero de Inicio sale cada etapa.
          Ganado y Perdido no se pueden borrar, pero sí renombrar.
        </p>
      </DialogContent>
    </Dialog>
  );
}
