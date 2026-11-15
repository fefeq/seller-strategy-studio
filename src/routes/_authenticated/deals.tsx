import { NativeSelect } from "@/components/native-select";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/company-logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page, HealthDot, Kpi } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { DealSourceField } from "@/components/deal-source-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRadio } from "@/components/deal/score-radio";
import { useAgent } from "@/components/agent";
import { MEDDPICC } from "@/lib/roles";
import { JargonTerm } from "@/components/jargon-term";
import { stageGate, TRACKS } from "@/lib/bmad/tracks";
import { errorText } from "@/lib/errors";
import { mergeServerEdits } from "@/lib/merge-edits";
import { isOverdue, pipelineHeadline } from "@/lib/headlines";
import { staleDeals, staleThreshold } from "@/lib/stale";
import { actuals } from "@/lib/pipeline-real";
import { StaleSettings, useStaleSettings } from "@/components/stale-settings";
import { DateField } from "@/components/date-field";
import { NewDealButton } from "@/components/new-deal";
import { DealLinesEditor, useDealLines } from "@/components/deal-lines";
import { StageSettings, useStages } from "@/components/stage-settings";
import { stageLabel, stageOptions, stagePath, stageProbability } from "@/lib/stages";
import { fetchAll } from "@/lib/fetch-all";
import { dealsQuery, settle } from "@/hooks/screen-queries";
import type { Tables } from "@/integrations/supabase/types";
import { LossDialog, LossSection } from "@/components/loss-reason";
import { needsLossPrompt, type LossPatch } from "@/lib/loss-reasons";
import { BoardDnd, DragCard, DropColumn } from "@/components/board-dnd";
import { MoveMenu } from "@/components/move-menu";
import { MOVE_COPY, UNDO_MS, dealMoveOptions, isReversibleMove, undoDeal } from "@/lib/board-move";
import {
  WON_COPY,
  blockedByPendingWon,
  fetchPendingStageChanges,
  pendingStageChanges,
  pendingWonDealIds,
  requestWonApproval,
} from "@/lib/won-approval";

// The generated client is typed per table; the approvals helpers only need these two calls.
type ApprovalsDb = Parameters<typeof fetchPendingStageChanges>[0] &
  Parameters<typeof requestWonApproval>[0];
const approvalsDb = supabase as unknown as ApprovalsDb;

/** A row of the board query: the deal plus the account columns it selects. */
type Deal = Tables<"deals"> & { accounts: { name: string; domain: string | null } | null };

export const Route = createFileRoute("/_authenticated/deals")({
  validateSearch: (s: Record<string, unknown>) => ({
    deal: typeof s.deal === "string" ? s.deal : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pipeline — Nokko" },
      { name: "description", content: "Pipeline por etapas, forecast y cualificación MEDDPICC." },
      { property: "og:title", content: "Pipeline — Nokko" },
      {
        property: "og:description",
        content: "Pipeline por etapas, forecast y cualificación MEDDPICC.",
      },
    ],
  }),
  loader: ({ context }) => settle(context.queryClient.ensureQueryData(dealsQuery)),
  component: Deals,
});

function Deals() {
  const { money: eur } = useCurrency();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // With the agent docked beside it («Resolver»), the deal panel must not block the agent.
  const { docked: agentDocked } = useAgent();
  const qc = useQueryClient();
  const { data: deals = [] } = useQuery(dealsQuery);
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const selected = deals.find((d) => d.id === search.deal);
  const { data: me } = useMe();
  const { data: staleCfg } = useStaleSettings();
  const now = new Date();
  const cold = new Map(
    staleDeals(deals, staleCfg?.segments ?? [], staleCfg?.staleDays ?? null, now).map((r) => [
      r.deal.id,
      r,
    ]),
  );
  const coldCount = [...cold.values()].filter((r) => r.stale).length;
  const companyThreshold = staleThreshold(
    actuals(deals, now).cycleDays,
    staleCfg?.staleDays ?? null,
  );
  const canEditStale = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  const { stages } = useStages();
  // Deals waiting for approval to become «Ganado»: marked on their card and not movable meanwhile.
  const { data: pendingRows = [] } = useQuery({
    queryKey: ["approvals", "pending-stage-change"],
    queryFn: () => fetchPendingStageChanges(approvalsDb),
  });
  const pendingWon = pendingWonDealIds(pendingRows);
  const toApprovals = { label: "Aprobaciones", onClick: () => navigate({ to: "/approvals" }) };

  // Moving a deal into «Perdido» first asks why (CA-8); the deal only moves when the person saves, skips or the dialog closes with a choice.
  const [losing, setLosing] = useState<string | null>(null);
  const losingDeal = deals.find((d) => d.id === losing) ?? null;

  async function move(id: string, stage: string, loss?: LossPatch | null) {
    const deal = deals.find((d) => d.id === id);
    if (deal && deal.stage === stage && loss === undefined) return;
    // Fresh read, before anything is asked: another person may have requested «Ganado» a second ago.
    const pendingNow = await fetchPendingStageChanges(approvalsDb).catch(() => pendingRows);
    if (blockedByPendingWon(pendingStageChanges(pendingNow, id).length, stage)) {
      toast.warning(WON_COPY.blockedByPending, { action: toApprovals });
      return;
    }
    if (deal && loss === undefined && needsLossPrompt(stage, deal.stage)) {
      setLosing(id);
      return;
    }
    if (deal && stage !== "lost") {
      const gate = stageGate(
        { amount: deal.amount, meddpicc: deal.meddpicc as Record<string, unknown> | null },
        stage,
        stagePath(stages),
      );
      if (gate.missing.length)
        toast.warning(
          `Camino ${TRACKS[gate.track].label}: para esta etapa falta ${gate.missing.join(", ")}.`,
          {
            description: "Puedes moverlo igualmente; completa la cualificación MEDDPICC del deal.",
            duration: 8000,
          },
        );
    }
    if (stage === "won") {
      const r = await requestWonApproval(approvalsDb, {
        dealId: id,
        dealName: deal?.name ?? "",
        dealStage: deal?.stage,
        wonKey: stage,
        pending: pendingNow,
      });
      if (r.result === "error") {
        toast.error(errorText(r.error));
        return;
      }
      toast.dismiss(`move-${id}`);
      if (r.result === "created") toast.info(WON_COPY.sent);
      else if (r.result === "already-pending")
        toast.info(WON_COPY.alreadyPending, { action: toApprovals });
      else toast.info(WON_COPY.alreadyWon);
      qc.invalidateQueries();
      return;
    }
    const { error } = await supabase
      .from("deals")
      .update({ stage, probability: stageProbability(stage, stages), ...(loss ?? {}) })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["deals"] });
    if (error) {
      toast.error(errorText(error));
      return;
    }
    if (deal) announceMove(id, deal.stage, deal.probability ?? null, stage);
  }

  // Every successful move says where the deal went; the reversible ones offer «Deshacer» for a few seconds.
  function announceMove(
    id: string,
    fromStage: string,
    fromProbability: number | null,
    toStage: string,
  ) {
    const label = stageLabel(toStage, stages);
    if (!isReversibleMove({ entity: "deal", from: fromStage, to: toStage, stages })) {
      toast.info(MOVE_COPY.moved(label), { id: `move-${id}` });
      return;
    }
    toast(MOVE_COPY.moved(label), {
      id: `move-${id}`,
      duration: UNDO_MS,
      action: {
        label: MOVE_COPY.undo,
        onClick: () => void undoMove(id, fromStage, fromProbability, toStage),
      },
    });
  }
  async function undoMove(
    id: string,
    prevStage: string,
    prevProbability: number | null,
    movedTo: string,
  ) {
    // Meanwhile somebody may have asked for «Ganado»: the deal must not move back then.
    const pending = await fetchPendingStageChanges(approvalsDb).catch(
      () => [] as typeof pendingRows,
    );
    if (pendingStageChanges(pending, id).length)
      return void toast.warning(WON_COPY.blockedByPending, {
        id: `move-${id}`,
        action: toApprovals,
      });
    const plan = undoDeal({ prevStage, prevProbability, movedTo });
    const { data, error } = await supabase
      .from("deals")
      .update(plan.patch)
      .eq("id", id)
      .eq("stage", plan.onlyIfStage)
      .select("id");
    if (error) return void toast.error(errorText(error));
    if (!data?.length) return void toast.info(MOVE_COPY.changedMeanwhile, { id: `move-${id}` });
    qc.invalidateQueries({ queryKey: ["deals"] });
    toast.success(MOVE_COPY.undone(stageLabel(prevStage, stages)), { id: `move-${id}` });
  }

  return (
    <Page
      eyebrow="Pipeline"
      title={pipelineHeadline({
        openDeals: open.length,
        openAmount: open.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        overdue: open.filter((d) => isOverdue(d.close_date)).length,
        cold: coldCount,
        money: eur,
      })}
      actions={
        <>
          {me?.currentOrg?.org_id && (
            <StaleSettings
              staleDays={staleCfg?.staleDays ?? null}
              cycleDays={actuals(deals, now).cycleDays}
              canEdit={canEditStale}
              orgId={me.currentOrg.org_id}
            />
          )}
          <Button variant="outline" asChild>
            <Link to="/leads/entrada">Conectar leads reales</Link>
          </Button>
          <StageSettings canEdit={canEditStale} />
          <NewDealButton />
        </>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Kpi
          size="hero"
          label="Pipeline abierto"
          value={eur(open.reduce((s, d) => s + Number(d.amount ?? 0), 0))}
        />
        <Kpi
          size="hero"
          label="Forecast ponderado"
          value={eur(
            open.reduce((s, d) => s + (Number(d.amount ?? 0) * (d.probability ?? 0)) / 100, 0),
          )}
        />
        <Kpi
          size="hero"
          label="Ganado"
          value={eur(
            deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.amount ?? 0), 0),
          )}
        />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Un deal se da por enfriado a los {companyThreshold.days} días sin actividad (
        {companyThreshold.source === "empresa"
          ? "fijado por la empresa"
          : companyThreshold.source === "ciclo"
            ? `un cuarto del ciclo real de ${companyThreshold.cycleDays} días`
            : "por defecto, aún sin ciclo real"}
        ); cada segmento usa su propio ciclo cuando lo tiene.
      </p>
      <p className="mb-2 text-xs text-muted-foreground md:hidden">
        Desliza para ver todas las etapas. Usa «Mover a…» en cada tarjeta para cambiar su etapa.
      </p>
      <BoardDnd
        cardLabel={(id) => deals.find((d) => d.id === id)?.name ?? ""}
        columnLabel={(key) => stageLabel(key, stages)}
        onMove={(id, key) => void move(id, key)}
      >
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:snap-none">
          {stages.map((st) => {
            const col = deals.filter((d) => d.stage === st.key);
            return (
              <DropColumn
                key={st.key}
                id={st.key}
                className="w-[80vw] max-w-72 shrink-0 snap-start rounded-lg bg-muted/60 p-2 md:w-64 md:max-w-none"
              >
                <div className="flex justify-between gap-3 px-2 py-2">
                  <span className="eyebrow">{st.label}</span>
                  <span className="shrink-0 font-mono text-xs">
                    {eur(col.reduce((s, d) => s + Number(d.amount ?? 0), 0))}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.map((d) => (
                    <DragCard key={d.id} id={d.id} column={st.key}>
                      {({ dragging, ...drag }) => (
                        <div className="relative">
                          <button
                            {...drag}
                            onClick={() => navigate({ search: { deal: d.id } })}
                            className={`block w-full rounded-md border bg-card p-3 pb-10 text-left text-sm hover:border-signal ${dragging ? "opacity-40" : ""} ${cold.get(d.id)?.stale ? "border-signal/60" : ""}`}
                          >
                            <span className="break-words font-medium">
                              <CompanyLogo
                                domain={d.accounts?.domain}
                                size={16}
                                className="mr-1.5 -mt-0.5"
                              />
                              {d.name}
                            </span>
                            {d.accounts?.name &&
                              d.accounts.name.trim().toLowerCase() !==
                                d.name.trim().toLowerCase() && (
                                <span className="block text-xs text-muted-foreground">
                                  {d.accounts.name}
                                </span>
                              )}
                            {pendingWon.has(d.id) && (
                              <span className="mt-1 block text-xs font-medium text-signal">
                                {WON_COPY.mark}
                              </span>
                            )}
                            {cold.get(d.id)?.stale && (
                              <span className="mt-1 block text-xs text-signal">
                                Enfriado: {cold.get(d.id)!.idleDays} días sin actividad (umbral{" "}
                                {cold.get(d.id)!.threshold.days})
                              </span>
                            )}
                            <span className="mt-2 flex items-center justify-between">
                              <span className="font-mono text-xs">
                                {eur(Number(d.amount ?? 0))}
                              </span>
                              <HealthDot value={d.health} />
                            </span>
                          </button>
                          <span className="absolute bottom-1 right-2">
                            <MoveMenu
                              itemLabel={d.name}
                              options={dealMoveOptions(stages, d.stage)}
                              onMove={(key) => void move(d.id, key)}
                            />
                          </span>
                        </div>
                      )}
                    </DragCard>
                  ))}
                </div>
              </DropColumn>
            );
          })}
        </div>
      </BoardDnd>
      <LossDialog
        deal={losingDeal}
        onCancel={() => setLosing(null)}
        onDone={async (patch) => {
          const id = losing;
          setLosing(null);
          if (id) await move(id, "lost", patch);
        }}
      />
      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && navigate({ search: { deal: undefined } })}
        modal={!agentDocked}
      >
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-2xl"
          onInteractOutside={agentDocked ? (e) => e.preventDefault() : undefined}
        >
          {selected && (
            <DealDetail
              deal={selected}
              onMove={(stage) => move(selected.id, stage)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["deals"] })}
            />
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function DealDetail({
  deal,
  onMove,
  onSaved,
}: {
  deal: Deal;
  onMove: (stage: string) => Promise<void>;
  onSaved: () => void;
}) {
  const { money: eur, symbol } = useCurrency();
  const { stages } = useStages();
  const [d, setD] = useState(deal);
  // When the deal refreshes (stage change, realtime, save), keep what the person is still editing.
  const server = useRef(deal);
  useEffect(() => {
    const prev = server.current;
    server.current = deal;
    if (prev === deal) return;
    setD((cur) => (prev.id !== deal.id ? deal : mergeServerEdits(cur, prev, deal)));
  }, [deal]);
  const m = (d.meddpicc ?? {}) as Record<string, { score: number; note: string }>;
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["map", deal.id],
    queryFn: async () =>
      (
        await supabase
          .from("mutual_action_items")
          .select("*")
          .eq("deal_id", deal.id)
          .order("due_date")
      ).data ?? [],
  });
  const [newItem, setNewItem] = useState("");
  const [due, setDue] = useState("");
  const [side, setSide] = useState("nosotros");
  const { data: lookups = { segments: [], partners: [] } } = useQuery({
    queryKey: ["deal-lookups"],
    queryFn: async () => {
      const [s, p] = await Promise.all([
        supabase.from("segments").select("id,name"),
        supabase.from("partners").select("id,name"),
      ]);
      return { segments: s.data ?? [], partners: p.data ?? [] };
    },
  });
  const total = MEDDPICC.reduce((s, [k]) => s + (m[k]?.score ?? 0), 0);
  const FORM_KEYS = ["name", "amount", "close_date", "probability", "health", "meddpicc", "forecast_category", "source", "segment_id", "partner_id"] as const;
  const dirty = FORM_KEYS.some((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify(deal[k] ?? null));
  const [saving, setSaving] = useState(false);
  // With product lines the amount is theirs (the database recomputes it): the form must not overwrite it.
  const { data: lines = [] } = useDealLines(deal.id);
  const hasLines = lines.length > 0;

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({
        name: d.name,
        ...(hasLines ? {} : { amount: d.amount }),
        close_date: d.close_date || null,
        probability: d.probability,
        health: d.health,
        meddpicc: d.meddpicc,
        forecast_category: d.forecast_category,
        source: d.source,
        segment_id: d.segment_id || null,
        partner_id: d.partner_id || null,
      })
      .eq("id", d.id);
    setSaving(false);
    if (error) return toast.error(errorText(error));
    toast.success("Deal guardado.");
    onSaved();
  }
  async function addItem() {
    await supabase
      .from("mutual_action_items")
      .insert({ deal_id: deal.id, title: newItem, due_date: due || null, owner_side: side });
    setNewItem("");
    setDue("");
    qc.invalidateQueries({ queryKey: ["map", deal.id] });
  }
  async function toggle(id: string, done: boolean) {
    await supabase.from("mutual_action_items").update({ done }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["map", deal.id] });
  }
  async function requestDiscount() {
    await supabase.from("approvals").insert({
      kind: "discount",
      title: `Descuento para ${d.name}`,
      evidence: `Importe: ${eur(Number(d.amount ?? 0))}. Justificación: añade el contexto en la cuenta.`,
    });
    toast.success("Solicitud enviada a Deal Desk.");
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle className="break-words pr-10 font-display text-3xl">{d.name}</SheetTitle>
      </SheetHeader>
      {d.account_id && (
        <Link to="/accounts/$id" params={{ id: d.account_id }} className="text-sm text-signal">
          Abrir cuenta y plan →
        </Link>
      )}
      <Tabs defaultValue="resumen">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="meddpicc">MEDDPICC {total}/24</TabsTrigger>
          <TabsTrigger value="plan">Plan conjunto</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="space-y-4 pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Same path as drag & drop: MEDDPICC gate, Ganado → Aprobaciones. Saved immediately, not with "Guardar deal". */}
        <Field label="Etapa">
          <Pick
            value={deal.stage}
            options={stageOptions(stages, true)}
            onChange={(v) => {
              if (v !== deal.stage) void onMove(v);
            }}
          />
        </Field>
        <Field label="Nombre">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label={`Importe (${symbol})`}>
          {hasLines ? (
            <p
              className="flex h-10 items-center font-mono text-sm md:h-9"
              title="Suma de las líneas del deal en un año"
            >
              {eur(Number(deal.amount ?? 0))} · de sus líneas
            </p>
          ) : (
            <Input
              type="number"
              value={d.amount ?? 0}
              onChange={(e) => setD({ ...d, amount: Number(e.target.value) })}
            />
          )}
        </Field>
        <Field label="Fecha de cierre">
          <DateField value={d.close_date} onChange={(iso) => setD({ ...d, close_date: iso })} />
        </Field>
        <Field label="Probabilidad (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={d.probability ?? 0}
            onChange={(e) => setD({ ...d, probability: Number(e.target.value) })}
          />
        </Field>
        <Field label="Salud">
          <Pick
            value={d.health ?? ""}
            options={{ green: "Sano", yellow: "Atención", red: "En riesgo" }}
            onChange={(v) => setD({ ...d, health: v })}
          />
        </Field>
        <Field label="Categoría de forecast">
          <Pick
            value={d.forecast_category ?? "pipeline"}
            options={{
              commit: "Commit",
              best_case: "Best case",
              pipeline: "Pipeline",
              omitted: "Omitido",
            }}
            onChange={(v) => setD({ ...d, forecast_category: v })}
          />
        </Field>
        <Field label="Fuente">
          <DealSourceField value={d.source ?? null} onChange={(v) => setD({ ...d, source: v })} />
        </Field>
        <Field label="Segmento">
          <Pick
            value={d.segment_id ?? ""}
            options={Object.fromEntries([
              ["", "—"],
              ...lookups.segments.map((s) => [s.id, s.name]),
            ])}
            onChange={(v) => setD({ ...d, segment_id: v })}
          />
        </Field>
        <Field label="Partner">
          <Pick
            value={d.partner_id ?? ""}
            options={Object.fromEntries([
              ["", "—"],
              ...lookups.partners.map((s) => [s.id, s.name]),
            ])}
            onChange={(v) => setD({ ...d, partner_id: v })}
          />
        </Field>
      </div>
      {deal.stage === "lost" && <LossSection deal={deal} onSaved={onSaved} />}
      {d.slip_count > 0 && (
        <p className="text-xs text-signal">
          La fecha de cierre se ha retrasado {d.slip_count} {d.slip_count === 1 ? "vez" : "veces"}.
        </p>
      )}
      <Button variant="outline" onClick={requestDiscount}>
        Pedir descuento
      </Button>
        </TabsContent>
        <TabsContent value="productos" className="pt-4">
          {/* Product lines save on their own; the deal amount follows them. */}
          <DealLinesEditor dealId={deal.id} orgId={deal.org_id ?? undefined} />
        </TabsContent>
        <TabsContent value="meddpicc" className="pt-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-2xl">
            <JargonTerm term="MEDDPICC" />
          </h3>
          <span className="font-mono text-sm">{total}/24</span>
        </div>
        <div className="space-y-2">
          {MEDDPICC.map(([k, label, q]) => (
            <div
              key={k}
              className={`rounded-md border p-3 ${(m[k]?.score ?? 0) === 0 ? "border-signal/50" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 text-sm font-medium">{label}</span>
                <ScoreRadio
                  label={label}
                  value={m[k]?.score ?? 0}
                  onChange={(n) => setD({ ...d, meddpicc: { ...m, [k]: { ...m[k], score: n } } })}
                />
              </div>
              <Textarea
                rows={1}
                placeholder={q}
                className="mt-2 md:text-sm"
                value={m[k]?.note ?? ""}
                onChange={(e) =>
                  setD({
                    ...d,
                    meddpicc: { ...m, [k]: { score: m[k]?.score ?? 0, note: e.target.value } },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
        </TabsContent>
        <TabsContent value="plan" className="pt-4">
      <div>
        <h3 className="mb-2 text-2xl">Plan de acción conjunto</h3>
        <p className="mb-2 text-xs text-muted-foreground">Cada hito se guarda al añadirlo o marcarlo.</p>
        <div className="space-y-1.5">
          {items.map((i) => (
            <label
              key={i.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-2.5 text-sm"
            >
              <Checkbox checked={i.done} onCheckedChange={(v) => toggle(i.id, !!v)} />
              <span
                className={`min-w-0 flex-1 break-words ${i.done ? "line-through opacity-60" : ""}`}
              >
                {i.title}
              </span>
              <span className="w-full pl-7 font-mono text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:pl-0">
                {i.owner_side} · {i.due_date ?? "sin fecha"}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 sm:flex">
          <Input
            placeholder="Hito (p. ej. revisión de seguridad)"
            className="col-span-3 sm:col-span-1"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <DateField
            aria-label="Fecha del hito"
            className="w-full sm:w-40"
            value={due || null}
            onChange={(iso) => setDue(iso ?? "")}
          />
          <NativeSelect
            aria-label="Lado del hito"
            value={side}
            onChange={(e) => setSide(e.target.value)}
          >
            <option value="nosotros">Nosotros</option>
            <option value="cliente">Cliente</option>
          </NativeSelect>
          <Button disabled={!newItem} onClick={addItem}>
            Añadir hito
          </Button>
        </div>
      </div>
        </TabsContent>
      </Tabs>
      {/* One save for every tab's deal fields (D2). Stage, product lines and plan milestones save on their own. */}
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? "Tienes cambios sin guardar." : "Todo guardado."}
        </span>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Guardando…" : "Guardar deal"}
        </Button>
      </div>
    </div>
  );
}
