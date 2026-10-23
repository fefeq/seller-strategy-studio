// Background work (Inngest) on the screens: a notice when a task ends, the «En segundo plano» buttons and
// the lead hook that keeps enrichment and the follow-up sequence in step.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";
import { backgroundStatus, leadTouched, startBackgroundJob } from "@/lib/background.functions";

/** Whether Inngest is answering (checked every 10 minutes). */
export function useBackgroundReady() {
  const status = useServerFn(backgroundStatus);
  const { data } = useQuery({ queryKey: ["background-ready"], queryFn: () => status(), staleTime: 10 * 60_000, retry: false });
  return !!data?.ready;
}

/** In the app shell: a toast when one of my background tasks ends, with a link to the result. */
export function BackgroundJobsWatcher({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`bg-jobs-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "background_jobs", filter: `user_id=eq.${userId}` }, (p) => {
        const j = p.new as { status: string; label: string; error: string | null; result: { title?: string; link?: string } | null };
        if (j.status === "done") toast.success(j.result?.title ?? `${j.label}: listo`, j.result?.link ? { duration: 15_000, action: { label: "Abrir", onClick: () => navigate({ to: j.result!.link! as "/" }) } } : undefined);
        if (j.status === "failed") toast.error(`${j.label}: ${j.error ?? "no se ha podido terminar"}`);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, navigate]);
  return null;
}

type JobArgs = Parameters<typeof startBackgroundJob>[0]["data"];

/** «En segundo plano»: starts the task and lets the person keep working; hidden while Inngest is not answering. */
export function BackgroundButton({ job, onStarted, size = "sm", label = "En segundo plano", disabled }: { job: () => JobArgs | null; onStarted?: () => void; size?: "sm" | "default"; label?: string; disabled?: boolean }) {
  const ready = useBackgroundReady();
  const start = useServerFn(startBackgroundJob);
  if (!ready) return null;
  async function go() {
    const args = job();
    if (!args) return;
    try { await start({ data: args }); toast.success("En marcha. Te aviso aquí cuando termine; puedes seguir trabajando."); onStarted?.(); }
    catch (e) { toast.error(errorText(e)); }
  }
  return <Button type="button" size={size} variant="ghost" disabled={disabled} onClick={go}>{label}</Button>;
}

/** Call after a lead is created or saved: new leads get enriched, Contactado starts the follow-up waits. Never blocks. */
export function useLeadTouched() {
  const touch = useServerFn(leadTouched);
  return (leadId: string | null | undefined) => { if (leadId) void touch({ data: { leadId } }).catch(() => undefined); };
}
