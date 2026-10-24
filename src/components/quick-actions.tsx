// Quick actions on each row of Leads and Cuentas: the usual next steps without opening the record.
// Heavy work (completar datos, personas clave, investigar, calificar) runs in the background and notifies when done.
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startBackgroundJob } from "@/lib/background.functions";
import { errorText } from "@/lib/errors";
import { useMe } from "@/hooks/use-me";
import { useLeadTouched } from "@/components/background";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LEAD_STAGES } from "@/lib/lead-funnel";

type JobData = Parameters<typeof startBackgroundJob>[0] extends { data: infer D } ? D : never;

function useStart() {
  const start = useServerFn(startBackgroundJob);
  const qc = useQueryClient();
  return (data: JobData, what: string) => {
    toast.success(`${what}: en marcha. Te aviso cuando termine.`);
    start({ data })
      .then((r) => { if (r?.reused) toast.message("Ya estaba en marcha: sigo con esa."); })
      .catch((e) => toast.error(errorText(e)))
      .finally(() => qc.invalidateQueries({ queryKey: ["jobs-running"] }));
  };
}

const isoInDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function Trigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      Acciones
    </DropdownMenuTrigger>
  );
}

export type QuickAccount = { id: string; name: string; domain: string | null; owner_id: string | null; is_target?: boolean | null };

export function AccountQuickActions({ account }: { account: QuickAccount }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const run = useStart();
  const refresh = () => qc.invalidateQueries({ queryKey: ["accounts"] });

  async function update(patch: { owner_id?: string; is_target?: boolean }, ok: string) {
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    toast.success(ok);
    refresh();
  }
  async function addTask() {
    const title = window.prompt(`Nueva tarea para ${account.name}`)?.trim();
    if (!title) return;
    const { error } = await supabase.from("tasks").insert({ title, account_id: account.id, owner_id: me?.user.id ?? null, due_date: isoInDays(1) });
    if (error) return toast.error(errorText(error));
    toast.success("Tarea creada para mañana.");
  }
  const noDomain = () => toast.error("Añade el dominio de la cuenta primero: lo necesito para buscar.");

  return (
    <DropdownMenu>
      <Trigger label={`Acciones de ${account.name}`} />
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{account.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run({ kind: "complete_account", input: { accountId: account.id } }, "Completar datos")}>Completar datos</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (account.domain ? run({ kind: "key_people", input: { accountId: account.id, titles: [], levels: [] } }, "Buscar personas clave") : noDomain())}>Buscar personas clave</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (account.domain ? run({ kind: "account_research", input: { accountId: account.id } }, "Investigar en la web") : noDomain())}>Investigar en la web</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={addTask}>Nueva tarea…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/accounts/$id", params: { id: account.id }, search: { tab: "meetings" } })}>Planificar reunión</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/accounts/$id", params: { id: account.id }, search: { tab: "deals" } })}>Nuevo deal</DropdownMenuItem>
        <DropdownMenuSeparator />
        {me?.user.id && account.owner_id !== me.user.id && <DropdownMenuItem onSelect={() => update({ owner_id: me.user.id }, "Ahora eres responsable de la cuenta.")}>Asignármela</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => update({ is_target: !account.is_target }, account.is_target ? "Ya no es cuenta objetivo." : "Marcada como cuenta objetivo.")}>{account.is_target ? "Quitar de objetivo" : "Marcar como objetivo"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type QuickLead = { id: string; company: string; stage: string; email: string | null; owner_id: string | null; account_id: string | null };

const OPEN_ORDER = LEAD_STAGES.map((s) => s.id);

export function LeadQuickActions({ lead, onMove }: { lead: QuickLead; onMove: (id: string, stage: string) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const touchLead = useLeadTouched();
  const run = useStart();
  const closed = lead.stage === "opportunity" || lead.stage === "disqualified";
  const next = LEAD_STAGES[OPEN_ORDER.indexOf(lead.stage as (typeof OPEN_ORDER)[number]) + 1];

  async function update(patch: { next_step_at?: string; owner_id?: string }, ok: string) {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) return toast.error(errorText(error));
    touchLead(lead.id);
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <DropdownMenu>
      <Trigger label={`Acciones de ${lead.company}`} />
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{lead.company}</DropdownMenuLabel>
        {!closed && next && <DropdownMenuItem onSelect={() => onMove(lead.id, next.id)}>Pasar a {next.label}</DropdownMenuItem>}
        {!closed && <DropdownMenuItem onSelect={() => run({ kind: "qualify_leads", input: { ids: [lead.id] } }, "Calificar con IA")}>Calificar con IA</DropdownMenuItem>}
        {!closed && <DropdownMenuSeparator />}
        {!closed && <DropdownMenuItem onSelect={() => update({ next_step_at: isoInDays(1) }, "Seguimiento para mañana.")}>Seguimiento mañana</DropdownMenuItem>}
        {!closed && <DropdownMenuItem onSelect={() => update({ next_step_at: isoInDays(7) }, "Seguimiento en una semana.")}>Seguimiento en una semana</DropdownMenuItem>}
        {lead.email && <DropdownMenuItem onSelect={() => { window.location.href = `mailto:${lead.email}`; }}>Escribir email</DropdownMenuItem>}
        {me?.user.id && lead.owner_id !== me.user.id && <DropdownMenuItem onSelect={() => update({ owner_id: me.user.id }, "Ahora eres responsable del lead.")}>Asignármelo</DropdownMenuItem>}
        {lead.account_id && <DropdownMenuItem onSelect={() => navigate({ to: "/accounts/$id", params: { id: lead.account_id! } })}>Abrir cuenta</DropdownMenuItem>}
        {!closed && <DropdownMenuSeparator />}
        {!closed && <DropdownMenuItem onSelect={() => onMove(lead.id, "disqualified")}>Descartar</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
