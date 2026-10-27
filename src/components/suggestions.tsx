import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/components/agent";
import { decideSuggestion, refreshSuggestions } from "@/lib/agent.functions";
import { digest } from "@/lib/proactive";
import { linkTarget, resolvePlan } from "@/lib/proactive/resolve";
import { errorText } from "@/lib/errors";
import { actionTool } from "@/lib/json";
import { Input } from "@/components/ui/input";
import { canViewStrategy, limitStrategy, parseStrategy, strategyHeading } from "@/lib/strategy-suggestions";
import { StrategyBadge, StrategyEvidence } from "@/components/strategy-evidence";
import { ExecuteDialog, executeKind } from "@/components/strategy-execute";

const PRIO: Record<number, string> = { 1: "Urgente", 2: "Importante", 3: "Cuando puedas" };

// Suggestions the user opened with «Resolver» and that have not been re-checked yet (per tab, per org).
const resolvingKey = (orgId: string) => `gtm-resolving-${orgId}`;
function readResolving(orgId: string): string[] {
  try { return JSON.parse(sessionStorage.getItem(resolvingKey(orgId)) ?? "[]"); } catch { return []; }
}
function markResolving(orgId: string, id: string) {
  try { sessionStorage.setItem(resolvingKey(orgId), JSON.stringify([...new Set([...readResolving(orgId), id])])); } catch { /* storage off: the next check closes it as solved */ }
}
function clearResolving(orgId: string) {
  try { sessionStorage.removeItem(resolvingKey(orgId)); } catch { /* nothing to clear */ }
}

/** Re-runs the detectors now; what the user resolved and no longer applies closes as done. */
export function useRecheckSuggestions() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const refresh = useServerFn(refreshSuggestions);
  const qc = useQueryClient();
  return () => {
    if (!orgId) return;
    const touched = readResolving(orgId);
    refresh({ data: { touched } })
      .then(() => { clearResolving(orgId); qc.invalidateQueries({ queryKey: ["suggestions"] }); })
      .catch((e) => toast.error(`No pude revisar las sugerencias: ${errorText(e)}`));
  };
}

export function useSuggestions() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const refresh = useServerFn(refreshSuggestions);
  const qc = useQueryClient();
  // Re-run the (database-only) detectors once per org when the app opens, and right away when the user
  // comes back after a «Resolver».
  useEffect(() => {
    if (!orgId) return;
    const k = `gtm-detect-${orgId}`;
    const touched = readResolving(orgId);
    const last = Number(sessionStorage.getItem(k) ?? 0);
    if (!touched.length && Date.now() - last < 5 * 60_000) return;
    sessionStorage.setItem(k, String(Date.now()));
    refresh({ data: { touched } })
      .then(() => { if (touched.length) clearResolving(orgId); qc.invalidateQueries({ queryKey: ["suggestions"] }); })
      .catch((e) => console.warn("[suggestions] background recheck failed", e));
  }, [orgId, refresh, qc]);
  return useQuery({
    queryKey: ["suggestions", orgId, (me?.roles ?? []).join(",")],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("suggestions").select("id,title,body,priority,link,action,created_at,detector,dedupe_key,strategy").eq("org_id", orgId!).eq("status", "pending").or(`user_id.is.null,user_id.eq.${me!.user.id}`).order("priority").order("created_at", { ascending: false }).limit(100);
      // At most 7 strategic suggestions open at once (CA-7); the operational ones are not capped.
      return limitStrategy((data ?? []).filter((r) => canViewStrategy(r, me?.roles ?? [])), new Date());
    },
  });
}

type S = NonNullable<ReturnType<typeof useSuggestions>["data"]>[number];

export function SuggestionCard({ s, compact = false }: { s: S; compact?: boolean }) {
  const decide = useServerFn(decideSuggestion);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { open } = useAgent();
  const navigate = useNavigate();
  const recheck = useRecheckSuggestions();
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState(false);
  const strategy = parseStrategy(s.strategy);
  async function act(decision: "approve" | "snooze" | "dismiss") {
    setBusy(decision);
    try {
      const r = await decide({ data: { id: s.id, decision, ...(strategy && reason.trim() ? { reason: reason.trim() } : {}) } });
      toast.success(r.message);
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  }
  const hasAction = !!actionTool(s.action);
  const target = linkTarget(s.link);
  // «Resolver»: go to the exact record and open the agent beside it with the problem already set out.
  function resolve() {
    const plan = resolvePlan(s);
    const orgId = me?.currentOrg?.org_id;
    if (orgId) markResolving(orgId, s.id);
    open({ prompt: plan.prompt, fresh: true, docked: true, side: plan.side, mode: "chat", personaId: null, workflowId: null, onClose: recheck });
    const to = linkTarget(plan.to);
    if (to) navigate({ to: to.to, search: to.search });
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-mono text-[10px] uppercase ${s.priority === 1 ? "text-signal" : "text-muted-foreground"}`}>{PRIO[s.priority]}{strategy ? ` · ${strategyHeading(strategy)}` : ""}</p>
          <p className="mt-0.5 break-words font-medium">{s.title}</p>
          <p className={`mt-1 whitespace-pre-line break-words text-sm text-muted-foreground ${compact ? "line-clamp-3" : ""}`}>{s.body}</p>
          {strategy && <><StrategyBadge m={strategy} /><StrategyEvidence m={strategy} /></>}
        </div>
        {target && <Link to={target.to} search={target.search} className="-m-2 shrink-0 p-2 text-muted-foreground hover:text-foreground md:m-0 md:p-0" aria-label="Abrir"><span aria-hidden>→</span></Link>}
      </div>
      {strategy && executeKind(s) && form && <ExecuteDialog s={s} open={form} onOpenChange={setForm} reason={reason} />}
      {strategy && <Input className="mt-3" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo de tu decisión (opcional)" />}
      <div className="mt-3 flex flex-wrap gap-2">
        {strategy ? <>
          <Button size="sm" disabled={!!busy} onClick={() => (executeKind(s) ? setForm(true) : act("approve"))}>Aceptar</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("snooze")}>Más tarde</Button>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("dismiss")}>Descartar</Button>
        </> : <>
        {hasAction
          ? <Button size="sm" disabled={!!busy} onClick={() => act("approve")}>Aprobar y hacer</Button>
          : <>
              <Button size="sm" disabled={!!busy} onClick={resolve}>Resolver</Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("approve")}>Hecho</Button>
            </>}
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("snooze")}>En 3 días</Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("dismiss")}>Descartar</Button>
        </>}
      </div>
    </div>
  );
}

export function TodayDigest() {
  const { data = [] } = useSuggestions();
  const top = digest(data, 3);
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl">3 cosas para hoy</h3>
        <Link to="/inbox" className="-my-2 py-2 text-xs text-muted-foreground hover:text-foreground md:my-0 md:py-0">{data.length === 1 ? "Ver 1 sugerencia" : `Ver las ${data.length} sugerencias`}</Link>
      </div>
      {top.length === 0 ? <p className="text-sm text-muted-foreground">Todo en orden. Te avisaré cuando detecte algo.</p> : <div className="space-y-3">{top.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>}
    </div>
  );
}
