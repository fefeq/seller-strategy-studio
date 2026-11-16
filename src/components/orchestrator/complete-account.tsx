import { useEffect, useRef, useState } from "react";
import { startBackgroundJob } from "@/lib/background.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ENRICH_LABEL, enrichPatch, type EnrichChange, type EnrichField } from "@/lib/clay";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";

export type Job = {
  id: string;
  status: string;
  step: string | null;
  finished_at: string | null;
  result: { review?: EnrichChange[]; sources?: string; body?: string | null } | null;
};

/** «Completar datos» runs in the background: empty fields are written, values that differ wait here for a person. */
export function CompleteAccount({
  account,
  onSaved,
}: {
  account: { id: string; domain: string | null };
  onSaved: () => void;
}) {
  const start = useServerFn(startBackgroundJob);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [picked, setPicked] = useState<EnrichField[]>([]);
  const key = ["account-job", "complete_account", account.id];
  const { data: job } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("background_jobs")
          .select("id,status,step,finished_at,result")
          .eq("kind", "complete_account")
          .eq("target_id", account.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data as Job | null,
    refetchInterval: (q) =>
      q.state.data && ["queued", "running"].includes((q.state.data as Job).status) ? 2500 : false,
  });
  const running = busy || (!!job && ["queued", "running"].includes(job.status));
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prev.current && ["queued", "running"].includes(prev.current) && job?.status === "done") {
      onSaved();
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
      setPicked((job.result?.review ?? []).map((c) => c.field));
    }
    prev.current = job?.status;
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function go() {
    setBusy(true);
    toast.success("En marcha. Te aviso cuando termine; puedes seguir trabajando.");
    start({ data: { kind: "complete_account", input: { accountId: account.id } } })
      .catch((e) => toast.error(errorText(e)))
      .finally(() => {
        setBusy(false);
        qc.invalidateQueries({ queryKey: key });
      });
    setTimeout(() => qc.invalidateQueries({ queryKey: key }), 900);
  }
  async function apply(review: EnrichChange[]) {
    const patch = enrichPatch(review, picked);
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    toast.success("Cuenta actualizada.");
    setDismissed(job?.id ?? null);
    onSaved();
  }
  const show = (c: EnrichChange, v: string | null) =>
    v && c.field === "country" ? countryName(v) : v;

  if (!account.domain)
    return (
      <p className="text-xs text-muted-foreground">
        Añade el dominio de la cuenta para que Nokko pueda completarla.
      </p>
    );
  if (running)
    return <p className="text-sm text-muted-foreground">Trabajando · {job?.step ?? "en cola"}…</p>;
  const review =
    job?.status === "done" &&
    job.id !== dismissed &&
    job.finished_at &&
    Date.now() - new Date(job.finished_at).getTime() < 24 * 3_600_000
      ? (job.result?.review ?? [])
      : [];
  if (!review.length)
    return (
      <Button variant="outline" size="sm" onClick={go}>
        Completar datos
      </Button>
    );
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="eyebrow">Datos distintos a los tuyos</p>
      {review.map((c) => (
        <label key={c.field} className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={picked.includes(c.field)}
            onCheckedChange={(v) =>
              setPicked((p) => (v ? [...p, c.field] : p.filter((x) => x !== c.field)))
            }
          />
          <span className="min-w-0">
            <span className="font-medium">{ENRICH_LABEL[c.field]}:</span> {show(c, c.proposed)}
            {c.current && (
              <span className="block text-xs text-muted-foreground">
                Ahora: {show(c, c.current)}
              </span>
            )}
          </span>
        </label>
      ))}
      {job?.result?.body && (
        <p className="font-mono text-xs text-muted-foreground">{job.result.body}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => apply(review)} disabled={!picked.length}>
          Aplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(job!.id)}>
          Mantener los míos
        </Button>
      </div>
    </div>
  );
}
