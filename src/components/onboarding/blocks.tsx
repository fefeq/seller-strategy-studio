import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { Field } from "@/components/setup/ai-fill";
import { askText } from "@/components/confirm-dialog";
import { applySetupItems, undoSetupItems } from "@/lib/agent.functions";
import { redoOnboardingBlock } from "@/lib/onboarding.functions";
import {
  itemDetail,
  proposalItems,
  type ProposalItem,
  type SetupProposal,
} from "@/lib/setup-extraction";
import {
  BLOCK_LABEL,
  LEVEL_LABEL,
  REDO_HINT_MAX,
  blockBasis,
  blockOf,
  blockOrder,
  blocksDecided,
  protectManual,
  type BlockId,
  type BlockState,
  type Opinion,
} from "@/lib/onboarding";
import type { Archetype } from "@/lib/gtm-diagnosis";
import { errorText } from "@/lib/errors";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";

type Status = Partial<Record<BlockId, BlockState>>;

/** «Aprobar bloque a bloque»: nothing is saved until its block is approved, and what the person wrote is never overwritten. */
export function BlocksStep({
  proposal,
  opinions,
  archetype,
  status,
  onStatus,
  onDone,
}: {
  proposal: SetupProposal;
  opinions: Opinion[];
  archetype: Archetype | null;
  status: Status;
  onStatus: (s: Status) => Promise<unknown>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const { data: setup } = useSetup();
  const apply = useServerFn(applySetupItems);
  const undo = useServerFn(undoSetupItems);
  const redo = useServerFn(redoOnboardingBlock);
  const segsQ = useQuery({
    queryKey: ["segments-min", me?.currentOrg?.org_id],
    queryFn: async () => (await supabase.from("segments").select("id,name")).data ?? [],
  });
  const segs = useMemo(() => segsQ.data ?? [], [segsQ.data]);
  // What the company had written when this review opened: approving a block must not hide its own items.
  const baseline = useRef<typeof setup>(undefined);
  if (setup && !baseline.current) baseline.current = setup;
  const base = baseline.current;
  const { items, kept } = useMemo(() => {
    const all = proposalItems(proposal, segs, me?.currentOrg?.currency ?? null);
    return base ? protectManual(all, base.data) : { items: all, kept: [] as string[] };
  }, [proposal, segs, me, base]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<BlockId | null>(null);
  // CA-3: edits to a proposal item live in this screen until its block is approved; leaving with edits asks first.
  // The only way to keep them is approving the block they belong to, so «Guardar» is not offered here.
  useUnsavedGuard(
    Object.keys(edits).some((k) => {
      const it = items.find((i) => i.key === k);
      return !!it && !status[blockOf(it)];
    }),
    undefined,
  );

  const order = blockOrder(archetype);
  const byBlock = (b: BlockId) =>
    items.filter((i) => blockOf(i) === b).map((i) => ({ ...i, args: edits[i.key] ?? i.args }));
  const present = new Set(order.filter((b) => byBlock(b).length || status[b]));
  const pct = setup?.status.pct ?? 0;

  const setArg = (it: ProposalItem, path: string[], value: string) =>
    setEdits((e) => {
      const args = structuredClone(e[it.key] ?? it.args);
      let o: Record<string, unknown> = args;
      for (const p of path.slice(0, -1)) o = o[p] as Record<string, unknown>;
      const last = path[path.length - 1];
      o[last] = typeof o[last] === "number" ? (value === "" ? undefined : Number(value)) : value;
      return { ...e, [it.key]: args };
    });

  async function approve(b: BlockId) {
    const chosen = byBlock(b).filter((i) => !off.has(i.key));
    setBusy(b);
    try {
      const r = chosen.length
        ? await apply({ data: { items: chosen.map(({ tool, args }) => ({ tool, args })) } })
        : [];
      const bad = r.filter((x) => !x.ok);
      if (bad.length)
        toast.warning(
          `${r.length - bad.length} guardados, ${bad.length} con error: ${bad[0].error ?? ""}`,
        );
      const refs = r.flatMap((x) => (x.undo ? [x.undo] : []));
      await onStatus({
        ...status,
        [b]: { status: "approved", at: new Date().toISOString(), undo: refs },
      });
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  async function undoBlock(b: BlockId) {
    setBusy(b);
    try {
      const refs = status[b]?.undo ?? [];
      if (refs.length) await undo({ data: { refs } });
      const next = { ...status };
      delete next[b];
      await onStatus(next);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  async function redoBlock(b: BlockId) {
    const hint = await askText(`Rehacer «${BLOCK_LABEL[b]}» con IA`, {
      body: "¿Qué quieres que cambie? Puedes escribir una indicación corta o pegar un documento entero (posicionamiento, notas, una transcripción).",
      placeholder: "Por ejemplo: céntrate en agencias de más de 50 personas",
      confirmLabel: "Rehacer",
      multiline: true,
      maxLength: REDO_HINT_MAX,
    });
    if (!hint) return;
    setBusy(b);
    try {
      await redo({ data: { block: b, hint } });
      setEdits({});
      await qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Bloque rehecho: revísalo.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!setup || !segsQ.data || !me) return <p className="text-ink-mid">Preparando tu propuesta…</p>;
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg">{proposal.summary}</p>
        <p className="smallcaps text-ink-mid">Estrategia completa al {pct} %</p>
      </div>
      {kept.length > 0 && (
        <p className="text-sm text-ink-mid">
          Mantengo lo que ya habías escrito ({kept.length} {kept.length === 1 ? "dato" : "datos"}):
          no lo propongo de nuevo.
        </p>
      )}
      {order
        .filter((b) => present.has(b))
        .map((b, n) => {
          const st = status[b];
          const basis = blockBasis(proposal, b);
          const op = opinions.find((o) => o.block === b);
          return (
            <section key={b} className="border-t-2 border-hairline-firm pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl">
                  {n + 1}. {BLOCK_LABEL[b]}
                </h2>
                <span className="smallcaps">
                  {st?.status === "approved"
                    ? "Aprobado"
                    : st?.status === "skipped"
                      ? "Saltado"
                      : "Pendiente"}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <span className="smallcaps text-ink-mid">{LEVEL_LABEL[basis.level]}</span> ·{" "}
                {basis.source}
              </p>
              {op && (
                <p className="mt-2 border-l-2 border-hairline pl-3 font-mono text-sm">
                  <span className="text-ink-mid">{op.persona} (C-Levels):</span> {op.text}
                </p>
              )}
              <ul className="mt-3 divide-y divide-hairline">
                {byBlock(b).map((i) => (
                  <li key={i.key} className={`py-3 ${off.has(i.key) ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{i.label}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-mid">
                          {itemDetail(i.tool, i.args) ?? i.detail}
                        </p>
                      </div>
                      {!st && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant={off.has(i.key) ? "outline" : "ghost"}
                            onClick={() =>
                              setOff((s) => {
                                const x = new Set(s);
                                x.has(i.key) ? x.delete(i.key) : x.add(i.key);
                                return x;
                              })
                            }
                          >
                            {off.has(i.key) ? "Descartado" : "Descartar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(editing === i.key ? null : i.key)}
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                    {editing === i.key && !st && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {Object.entries(i.args).flatMap(([k, v]) =>
                          v && typeof v === "object"
                            ? Object.entries(v as Record<string, unknown>).map(([k2, v2]) => (
                                <Field
                                  key={`${k}.${k2}`}
                                  label={k2}
                                  value={v2}
                                  onChange={(x) => setArg(i, [k, k2], x)}
                                />
                              ))
                            : k === "segment_id" || typeof v === "boolean"
                              ? []
                              : [
                                  <Field
                                    key={k}
                                    label={k}
                                    value={v}
                                    onChange={(x) => setArg(i, [k], x)}
                                  />,
                                ],
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {!st && (
                  <>
                    <Button size="sm" disabled={busy === b} onClick={() => approve(b)}>
                      {busy === b ? "Guardando…" : "Aprobar bloque"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === b}
                      onClick={() => redoBlock(b)}
                    >
                      Rehacer con IA
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === b}
                      onClick={() =>
                        onStatus({
                          ...status,
                          [b]: { status: "skipped", at: new Date().toISOString() },
                        })
                      }
                    >
                      Saltar por ahora
                    </Button>
                  </>
                )}
                {st?.status === "skipped" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const x = { ...status };
                      delete x[b];
                      onStatus(x);
                    }}
                  >
                    Revisarlo ahora
                  </Button>
                )}
                {st?.status === "approved" &&
                  (isOwner || !st.undo?.length ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === b}
                      onClick={() => undoBlock(b)}
                    >
                      Deshacer
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-mid">Deshacer lo puede hacer el Owner.</span>
                  ))}
                {st?.status === "approved" && (
                  <span className="self-center text-xs text-ink-mid">
                    Deshacer borra lo que este bloque creó; lo que actualizó en su sitio se edita en
                    Estrategia.
                  </span>
                )}
              </div>
            </section>
          );
        })}
      {!present.size && (
        <p className="text-ink-mid">
          La propuesta no trae nada nuevo que guardar: ya tenías todo escrito.
        </p>
      )}
      <Button disabled={!blocksDecided(order, status, present)} onClick={onDone}>
        Ver tu roadmap
      </Button>
    </div>
  );
}
