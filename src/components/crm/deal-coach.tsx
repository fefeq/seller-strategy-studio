import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { JobProgress, useJob } from "@/components/background";

/** «Deal Coach»: runs in the background; the steps arrive in Sugerencias and the summary in the deal's history. */
export function DealCoach({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob("deal_coach", { targetId: dealId, onDone: () => { qc.invalidateQueries({ queryKey: ["timeline"] }); qc.invalidateQueries({ queryKey: ["suggestions"] }); } });
  const r = job?.status === "done" ? (job.result as { body?: string } | null) : null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="eyebrow">Deal Coach</p><p className="mt-1 text-sm text-ink-mid">Revisa el deal, su MEDDPICC y su historia y te deja riesgos y siguientes pasos en Sugerencias.</p></div>
        {running ? <JobProgress job={job} onCancel={cancel} /> : <Button variant="outline" onClick={() => start({ dealId })}>{job?.status === "done" ? "Volver a revisar" : "Revisar con IA"}</Button>}
      </div>
      {r?.body && <p className="mt-3 whitespace-pre-line text-sm">{r.body}</p>}
      {job?.status === "failed" && job.error && <p className="mt-3 text-sm text-signal">{job.error}</p>}
    </div>
  );
}
