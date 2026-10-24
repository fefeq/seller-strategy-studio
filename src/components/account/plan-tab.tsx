import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { generateProposal } from "@/lib/ai.functions";
import { errorText } from "@/lib/errors";
import { AccountResearch } from "@/components/web-research";
import { SaveToDriveButton } from "@/components/drive";
import { planMarkdown } from "@/lib/drive";

export const PLAN_FIELDS = [
  ["objectives", "Objetivos de la cuenta", "Qué quiere conseguir el cliente este año"],
  ["current_state", "Situación actual", "Cómo lo hacen hoy, herramientas, equipo"],
  ["pains", "Dolores", "Problemas concretos y su impacto"],
  ["initiatives", "Iniciativas estratégicas", "Proyectos en marcha donde encajamos"],
  ["whitespace", "Whitespace / oportunidades", "Áreas, equipos o productos por expandir"],
  ["competitors", "Competencia", "Proveedores actuales y alternativas"],
  ["risks", "Riesgos", "Qué puede hacernos perder"],
  ["action_plan", "Plan de acción", "Acción · responsable · fecha"],
] as const;

export function PlanTab({ accountId, accountName, hasDomain, plan, onSaved }: { accountId: string; accountName: string; hasDomain: boolean; plan: Record<string, any> | null; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);
  const propose = useServerFn(generateProposal);
  useEffect(() => { setForm(Object.fromEntries(PLAN_FIELDS.map(([k]) => [k, plan?.[k] ?? ""]))); }, [plan]);
  async function save(next = form) {
    const { error } = plan
      ? await supabase.from("account_plans").update(next).eq("id", plan.id)
      : await supabase.from("account_plans").insert({ account_id: accountId, ...next });
    if (error) return toast.error(errorText(error));
    toast.success("Plan de cuenta guardado.");
    onSaved();
  }
  /** Web research goes below what is already written (with its sources) and is saved with the rest of the form. */
  async function applyResearch(fields: Record<string, string>) {
    const next = { ...form };
    for (const [k, v] of Object.entries(fields)) next[k] = next[k]?.trim() ? `${next[k].trim()}\n\n${v}` : v;
    setForm(next);
    await save(next);
  }
  async function genProposal() {
    setBusy(true);
    try { setProposal((await propose({ data: { accountId } })).text); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {PLAN_FIELDS.map(([k, label, hint]) => (
          <div key={k} className="space-y-1.5 rounded-lg border bg-card p-4">
            <Label className="font-display text-[22px] font-medium normal-case leading-7 tracking-normal text-ink">{label}</Label>
            <Textarea rows={4} placeholder={hint} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()}>Guardar plan</Button>
        <SaveToDriveButton title={`Plan de cuenta · ${accountName}`} accountId={accountId} markdown={() => planMarkdown(accountName, PLAN_FIELDS.map(([k, label]) => [label, form[k]]))} label="Guardar plan en Drive" />
        <Button variant="outline" onClick={genProposal} disabled={busy}>{busy ? "Generando…" : "Borrador de propuesta con IA"}</Button>
      </div>
      <AccountResearch accountId={accountId} hasDomain={hasDomain} onApply={applyResearch} />
      {proposal && <>
        <pre className="whitespace-pre-wrap break-words rounded-lg border bg-card p-6 font-sans text-sm">{proposal}</pre>
        <SaveToDriveButton title={`Propuesta · ${accountName}`} accountId={accountId} markdown={proposal} label="Guardar propuesta en Drive" />
      </>}
    </div>
  );
}
