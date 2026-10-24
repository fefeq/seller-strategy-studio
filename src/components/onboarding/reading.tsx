import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Finding } from "@/lib/onboarding";

/** «Nokko lee»: the live ticker of what the background reading finds, each line with its source. */
export function ReadingStep({ jobId, findings, sources, onNext, onBack }: { jobId: string | null; findings: Finding[]; sources: string[]; onNext: () => void; onBack: () => void }) {
  const { data: job } = useQuery({
    queryKey: ["onboarding-job", jobId],
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ["done", "failed", "cancelled"].includes(q.state.data.status) ? false : 2000),
    queryFn: async () => (await supabase.from("background_jobs").select("status,step,error").eq("id", jobId!).maybeSingle()).data,
  });
  const done = job?.status === "done";
  const failed = job?.status === "failed" || job?.status === "cancelled";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <p className="smallcaps text-ink-mid">{done ? "Leído" : failed ? "Sin terminar" : `Leyendo · ${job?.step ?? "en cola"}`}</p>
        <ol className="mt-3 border-t border-hairline font-mono text-sm" aria-live="polite">
          {findings.map((f, i) => (
            <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-hairline py-2">
              <span className="text-ink-faint">{time(f.at)}</span>
              <span>{f.text}{f.source && <span className="text-ink-mid"> · {f.source}</span>}</span>
            </li>
          ))}
          {!findings.length && <li className="py-2 text-ink-faint">Esperando a empezar…</li>}
        </ol>
        {failed && <p className="mt-4 text-sm text-destructive">{job?.error ?? "La lectura se canceló."}</p>}
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps">Fuentes</p>
        <ul className="mt-2 space-y-1 text-sm">{sources.map((s) => <li key={s}>{s} <span className="text-ink-faint">{done ? "leído" : failed ? "sin acceso" : "leyendo"}</span></li>)}</ul>
        {done && <Button className="mt-4 w-full" onClick={onNext}>Seguir a tu diagnóstico</Button>}
        {failed && <Button variant="outline" className="mt-4 w-full" onClick={onBack}>Volver a tus fuentes</Button>}
        {!done && !failed && <p className="mt-4 text-xs text-ink-mid">Puedes salir: el aviso te traerá de vuelta aquí.</p>}
      </div>
    </div>
  );
}
