// Background work on the screens: the useJob hook every heavy button uses (start, follow, cancel, read the
// result), the toast when a notice arrives, and the lead hook that keeps enrichment and follow-ups in step.
import { X } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";
import { useMe } from "@/hooks/use-me";
import { backgroundStatus, cancelBackgroundJob, leadTouched, startBackgroundJob, type JobArgs } from "@/lib/background.functions";

/** Whether Inngest is answering (checked every 10 minutes). */
export function useBackgroundReady() {
  const status = useServerFn(backgroundStatus);
  const { data } = useQuery({ queryKey: ["background-ready"], queryFn: () => status(), staleTime: 10 * 60_000, retry: false });
  return !!data?.ready;
}

export type BgJob<R = Record<string, any>> = { id: string; kind: string; status: string; step: string | null; error: string | null; created_at: string; finished_at: string | null; result: R | null; input: Record<string, any> };
type Kind = JobArgs["kind"];
type InputOf<K extends Kind> = Extract<JobArgs, { kind: K }>["input"];

const ACTIVE = ["queued", "running"];

/**
 * One heavy task on a screen: the latest job of this kind (for this record, by me, in this company), polled while
 * it runs. `start` returns at once («En marcha…»); `onDone` fires when it finishes while the screen is open.
 */
export function useJob<K extends Kind, R = Record<string, any>>(kind: K, opts: { targetId?: string | null; onDone?: (job: BgJob<R>) => void; quiet?: boolean } = {}) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const startFn = useServerFn(startBackgroundJob);
  const cancelFn = useServerFn(cancelBackgroundJob);
  const [starting, setStarting] = useState(false);
  const userId = me?.user.id;
  const orgId = me?.currentOrg?.org_id;
  const key = ["bg-job", kind, opts.targetId ?? null, userId, orgId];
  const { data: job = null } = useQuery({
    queryKey: key,
    enabled: !!userId && !!orgId,
    queryFn: async () => {
      let q = supabase.from("background_jobs").select("id,kind,status,step,error,created_at,finished_at,result,input").eq("kind", kind).eq("user_id", userId!).eq("org_id", orgId!);
      if (opts.targetId) q = q.eq("target_id", opts.targetId);
      return ((await q.order("created_at", { ascending: false }).limit(1).maybeSingle()).data ?? null) as BgJob<R> | null;
    },
    refetchInterval: (q) => (starting || (q.state.data && ACTIVE.includes((q.state.data as BgJob).status)) ? 2500 : false),
  });
  const running = starting || (!!job && ACTIVE.includes(job.status));

  const prev = useRef<string | undefined>(undefined);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;
  useEffect(() => {
    if (prev.current && ACTIVE.includes(prev.current) && job?.status === "done") onDone.current?.(job);
    prev.current = job?.status;
  }, [job?.status, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start(input: InputOf<K>, label?: string) {
    setStarting(true);
    if (!opts.quiet) toast.success("En marcha. Te aviso cuando termine; puedes seguir trabajando.");
    // Inngest answers in under a second; without it the task runs inside this call, so we do not wait for it.
    const call = startFn({ data: { kind, input, ...(label ? { label } : {}) } as JobArgs })
      .then((r) => { if (r.reused) toast.message("Ya estaba en marcha: sigo con esa."); return r; })
      .catch((e) => { toast.error(errorText(e)); return null; })
      .finally(() => { setStarting(false); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["jobs-running"] }); });
    setTimeout(() => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["jobs-running"] }); }, 800);
    setTimeout(() => setStarting(false), 4000);
    return call;
  }
  async function cancel() {
    if (!job) return;
    try {
      const r = await cancelFn({ data: { jobId: job.id } });
      toast.message(r.status === "cancelled" ? "Cancelado." : "Cancelando: paro en el siguiente paso. Lo que ya hizo se queda.");
      qc.invalidateQueries({ queryKey: key });
    } catch (e) { toast.error(errorText(e)); }
  }
  return { job, running, start, cancel };
}

/** «Trabajando · paso» with «Cancelar», for any screen that runs a job. */
export function JobProgress({ job, onCancel, className = "" }: { job: BgJob | null; onCancel?: () => void; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground ${className}`}>
      <span>Trabajando · {job?.step ?? (job?.status === "running" ? "en curso" : "en cola")}… Te aviso al terminar.</span>
      {job && onCancel && <button type="button" className="underline underline-offset-4" onClick={onCancel}><IconText icon={X}>Cancelar</IconText></button>}
    </p>
  );
}

/** In the app shell: a toast when a new notice arrives (my tasks, the autopilot), with a link to the result. */
export function BackgroundJobsWatcher({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`bg-notices-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as { kind: string; title: string; body: string | null; link: string | null };
        const action = n.link ? { duration: 15_000, action: { label: "Abrir", onClick: () => navigate({ to: n.link! as "/" }) } } : undefined;
        if (n.kind === "failed") toast.error(`${n.title}${n.body ? `: ${n.body}` : ""}`, action);
        else toast.success(n.title, action);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "research_runs", filter: `user_id=eq.${userId}` }, (p) => {
        const r = p.new as { status: string; kind: string; label: string; error: string | null; account_id: string | null };
        const link = r.kind === "account_report" && r.account_id ? `/accounts/${r.account_id}?tab=report` : "/accounts";
        if (r.status === "done") toast.success(`${r.label}: listo`, { duration: 15_000, action: { label: "Abrir", onClick: () => navigate({ to: link as "/" }) } });
        if (r.status === "failed") toast.error(`${r.label}: ${r.error ?? "no se ha podido terminar"}`);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, navigate]);
  return null;
}

/** «En segundo plano»: starts the task and lets the person keep working. */
export function BackgroundButton({ job, onStarted, size = "sm", label = "En segundo plano", disabled }: { job: () => JobArgs | null; onStarted?: () => void; size?: "sm" | "default"; label?: string; disabled?: boolean }) {
  const start = useServerFn(startBackgroundJob);
  const qc = useQueryClient();
  async function go() {
    const args = job();
    if (!args) return;
    toast.success("En marcha. Te aviso cuando termine; puedes seguir trabajando.");
    onStarted?.();
    try { await start({ data: args }); } catch (e) { toast.error(errorText(e)); }
    finally { qc.invalidateQueries({ queryKey: ["jobs-running"] }); }
  }
  return <Button type="button" size={size} variant="ghost" disabled={disabled} onClick={go}>{label}</Button>;
}

/** Call after a lead is created or saved: new leads get enriched, Contactado starts the follow-up waits. Never blocks. */
export function useLeadTouched() {
  const touch = useServerFn(leadTouched);
  return (leadId: string | null | undefined) => { if (leadId) void touch({ data: { leadId } }).catch(() => undefined); };
}
