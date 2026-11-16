import { useState } from "react";
import { useLeadTouched } from "@/components/background";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LEAD_STAGES, OPEN_LEAD_STAGES, leadStageLabel, type LeadSla } from "@/lib/lead-funnel";
import { errorText } from "@/lib/errors";
import { DateField } from "@/components/date-field";
import { EntityCombobox, useAccountOptions } from "@/components/entity-combobox";

const NEW_STAGES = Object.fromEntries(
  LEAD_STAGES.filter((s) => s.id !== "opportunity").map((s) => [s.id, s.label]),
);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function NewLead({ segments }: { segments: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = {
    company: "",
    contact_name: "",
    email: "",
    source: "",
    segment_id: "",
    stage: "new",
    next_step_at: "",
  };
  const [f, setF] = useState(empty);
  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: accounts = [] } = useAccountOptions(open);
  const touchLead = useLeadTouched();
  const set = (k: keyof typeof empty) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    const company = f.company.trim();
    if (!company) return toast.error("Escribe la empresa.");
    // The account picked in «Buscar o crear», else an existing one with the same name; otherwise the lead flow creates it.
    const acc = accountId
      ? { id: accountId }
      : (
          await supabase
            .from("accounts")
            .select("id")
            .ilike("name", escapeLike(company))
            .limit(1)
            .maybeSingle()
        ).data;
    const { data: created, error } = await supabase
      .from("leads")
      .insert({
        company,
        contact_name: f.contact_name.trim() || null,
        email: f.email.trim().toLowerCase() || null,
        source: f.source.trim() || "Manual",
        segment_id: f.segment_id || null,
        stage: f.stage,
        next_step_at: f.next_step_at || null,
        account_id: acc?.id ?? null,
      })
      .select("id")
      .single();
    if (error) return toast.error(errorText(error));
    touchLead(created?.id);
    toast.success(`Lead ${company} creado.`);
    setF(empty);
    setAccountId(null);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Nuevo lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Empresa">
              <EntityCombobox
                items={accounts}
                value={f.company}
                selectedId={accountId}
                onChange={(t, a) => {
                  set("company")(t);
                  setAccountId(a?.id ?? null);
                }}
                placeholder="Busca entre tus cuentas o escribe una nueva"
                noun="cuenta nueva"
                logos
                autoFocus
                ariaLabel="Empresa"
              />
            </Field>
          </div>
          <Field label="Contacto">
            <Input value={f.contact_name} onChange={(e) => set("contact_name")(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} />
          </Field>
          <Field
            label="Origen"
            why="Métricas lo usa para mostrar de dónde vienen los deals que se pierden."
          >
            <Input
              value={f.source}
              onChange={(e) => set("source")(e.target.value)}
              placeholder="Webinar, LinkedIn, Referido…"
            />
          </Field>
          <Field
            label="Segmento"
            why="Métricas lo usa para separar pérdidas y embudo por segmento."
          >
            <Pick
              value={f.segment_id}
              options={{
                "": "Sin segmento",
                ...Object.fromEntries(segments.map((s) => [s.id, s.name])),
              }}
              onChange={set("segment_id")}
            />
          </Field>
          <Field label="Etapa">
            <Pick value={f.stage} options={NEW_STAGES} onChange={set("stage")} />
          </Field>
          <Field
            label="Próximo seguimiento"
            why="Si pasa la fecha, Nokko te propone una tarea de seguimiento en Sugerencias."
          >
            <DateField value={f.next_step_at} onChange={(iso) => set("next_step_at")(iso ?? "")} />
          </Field>
        </div>
        <Button className="mt-2 w-full" onClick={save}>
          Crear lead
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function SlaSettings({
  sla,
  canEdit,
  orgId,
}: {
  sla: LeadSla;
  canEdit: boolean;
  orgId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<LeadSla>(sla);

  async function save() {
    const clean = Object.fromEntries(
      OPEN_LEAD_STAGES.map((k) => [k, Math.max(1, Math.round(Number(v[k]) || 1))]),
    );
    // The same json holds the cold-deal threshold (stale_deal_days): keep whatever else is there.
    const { data: current } = await supabase
      .from("lead_settings")
      .select("sla")
      .eq("org_id", orgId)
      .maybeSingle();
    const prev =
      current?.sla && typeof current.sla === "object" && !Array.isArray(current.sla)
        ? current.sla
        : {};
    const { error } = await supabase
      .from("lead_settings")
      .upsert(
        { org_id: orgId, sla: { ...prev, ...clean }, updated_at: new Date().toISOString() },
        { onConflict: "org_id" },
      );
    if (error) return toast.error(errorText(error));
    toast.success("Plazos guardados.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["lead-funnel"] });
    qc.invalidateQueries({ queryKey: ["stale-settings"] });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setV(sla);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Plazos por etapa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cuándo va con retraso un lead?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Un lead va con retraso si pasa en una etapa más días de los indicados <strong>o</strong>{" "}
          si su fecha de próximo seguimiento ya ha pasado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {OPEN_LEAD_STAGES.map((k) => (
            <Field key={k} label={`${leadStageLabel(k)} · días máx.`}>
              {canEdit ? (
                <Input
                  type="number"
                  min={1}
                  value={v[k]}
                  onChange={(e) => setV((p) => ({ ...p, [k]: Number(e.target.value) }))}
                />
              ) : (
                <p className="font-mono">{sla[k]} días</p>
              )}
            </Field>
          ))}
        </div>
        {canEdit ? (
          <Button className="w-full" onClick={save}>
            Guardar plazos
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo Owner, Sales Leader o Marketing pueden cambiar los plazos.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Per-company switch for the automatic completion of new leads' accounts (Apollo → Clay → web). Owner/Sales Leader change it. */
export function AutoEnrichSwitch({ canEdit, orgId }: { canEdit: boolean; orgId: string }) {
  const qc = useQueryClient();
  const { data: on } = useQuery({
    queryKey: ["auto-enrich", orgId],
    queryFn: async () =>
      (await supabase.from("lead_settings").select("auto_enrich").eq("org_id", orgId).maybeSingle())
        .data?.auto_enrich !== false,
  });
  async function toggle(next: boolean) {
    const { error } = await supabase
      .from("lead_settings")
      .upsert(
        { org_id: orgId, auto_enrich: next, updated_at: new Date().toISOString() },
        { onConflict: "org_id" },
      );
    if (error) return toast.error(errorText(error));
    toast.success(
      next
        ? "Completado automático activado."
        : "Completado automático desactivado: los leads nuevos no gastarán créditos solos.",
    );
    qc.invalidateQueries({ queryKey: ["auto-enrich", orgId] });
  }
  if (on === undefined) return null;
  return (
    <label
      className="flex items-center gap-2 text-sm"
      title={canEdit ? undefined : "Solo Owner o Sales Leader pueden cambiarlo."}
    >
      <Switch
        checked={on}
        disabled={!canEdit}
        onCheckedChange={toggle}
        aria-label="Completar cuentas automáticamente"
      />
      Completar solo {on ? "· Activo" : "· Pausado"}
    </label>
  );
}
