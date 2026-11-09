import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validatedUser } from "@/lib/session";
import { SESSION_CHECK_FAILED } from "@/lib/session-check";
import { useCurrency } from "@/hooks/use-me";
import { Empty, HealthDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { firstOpenStage, stageLabel } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { errorText } from "@/lib/errors";

export function CallsTab({
  accountId,
  list,
  onChange,
}: {
  accountId: string;
  list: any[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [next, setNext] = useState("");
  async function add() {
    const { error } = await supabase
      .from("calls")
      .insert({ account_id: accountId, title, summary, next_steps: next });
    if (error) return toast.error(errorText(error));
    setTitle("");
    setSummary("");
    setNext("");
    onChange();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h3 className="text-2xl">Registrar llamada</h3>
        <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Qué se dijo"
          rows={5}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Textarea
          placeholder="Próximos pasos"
          rows={3}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Button disabled={!title} onClick={add}>
          Guardar
        </Button>
      </div>
      <div className="space-y-3">
        {list.length === 0 && (
          <Empty>Sin llamadas registradas. Registra la primera con el formulario.</Empty>
        )}
        {list.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="min-w-0 break-words font-medium">{c.title}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {c.occurred_at ? new Date(c.occurred_at).toLocaleDateString("es-ES") : ""}
              </span>
            </div>
            {c.summary && <p className="mt-2 whitespace-pre-wrap break-words">{c.summary}</p>}
            {c.next_steps && <p className="mt-2 text-signal">→ {c.next_steps}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DealsTab({
  accountId,
  list,
  onChange,
}: {
  accountId: string;
  list: any[];
  onChange: () => void;
}) {
  const { stages } = useStages();
  const { money: eur } = useCurrency();
  async function add() {
    const user = await validatedUser();
    if (!user) return toast.error(SESSION_CHECK_FAILED);
    const { error } = await supabase.from("deals").insert({
      account_id: accountId,
      name: "Nuevo deal",
      stage: firstOpenStage(stages).key,
      owner_id: user.id,
    });
    if (error) return toast.error(errorText(error));
    onChange();
  }
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={add}>
        + Nuevo deal
      </Button>
      {list.length === 0 && <Empty>Esta cuenta no tiene deals. Crea uno con «+ Nuevo deal».</Empty>}
      {list.map((d) => (
        <Link
          key={d.id}
          to="/deals"
          search={{ deal: d.id }}
          className="flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-sm hover:border-signal sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="min-w-0 break-words font-medium">{d.name}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:shrink-0">
            <span>{stageLabel(d.stage, stages)}</span>
            <span className="font-mono">{eur(Number(d.amount ?? 0))}</span>
            <HealthDot value={d.health} />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** On < lg the editor sits below the list: bring it into view when a new item is selected. */
