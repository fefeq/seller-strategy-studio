import { Trash2 } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page, Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { parseCsv } from "@/lib/dedupe";
import { hashLeadKey } from "@/lib/leads-ingest";
import {
  applyColumnMapping,
  columnMapping,
  CSV_FIELD_LABELS,
  dealsWithoutCloseDate,
  intakeStageOptions,
  LEAD_LIMITS,
  type CsvField,
} from "@/lib/leads";
import { useStages } from "@/components/stage-settings";
import { importLeads } from "@/lib/leads.functions";
import { errorText } from "@/lib/errors";
import { ImportReview } from "@/components/import-review";
import { askConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/leads/entrada")({
  head: () => ({
    meta: [
      { title: "Entrada de leads — Nokko" },
      {
        name: "description",
        content:
          "Conecta formularios, automatizaciones, CRMs y CSV para que cada lead entre con su etapa y fecha en la pantalla de Leads.",
      },
      { property: "og:title", content: "Entrada de leads — Nokko" },
      {
        property: "og:description",
        content:
          "Conecta formularios, automatizaciones, CRMs y CSV para que cada lead entre con su etapa y fecha en la pantalla de Leads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leads,
});

const CSV_FIELD_OPTS: Record<string, string> = { "": "No importar", ...CSV_FIELD_LABELS };
const STATUS: Record<string, [string, string]> = {
  created: ["Nuevo", "bg-success/15 text-success"],
  updated: ["Actualizado", "bg-muted text-foreground"],
  error: ["Error", "bg-destructive/15 text-destructive"],
};

/** Public base URL for external tools: the editor preview is private, so use the live domain there. */
function publicBase() {
  if (typeof window === "undefined") return "";
  const h = window.location.hostname;
  return h.startsWith("id-preview--") || h === "localhost" || h.endsWith(".lovableproject.com")
    ? "https://nokko.ai"
    : window.location.origin;
}

function Leads() {
  const { data: me } = useMe();
  const canManage = !!me?.roles.some(
    (r) => r === "owner" || r === "sales_leader" || r === "marketing",
  );
  return (
    <Page
      eyebrow="Leads reales"
      title="Entrada de leads"
      actions={
        <Button variant="outline" asChild>
          <Link to="/leads">Ver leads</Link>
        </Button>
      }
    >
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-muted-foreground">
        Cada lead entra en <strong>Leads</strong> con su cuenta, su contacto, su etapa (Nuevo,
        Contactado, MQL o SQL) y su fecha. Si ya trae una etapa de venta (Propuesta, Negociación… o
        una de las etapas de tu pipeline), entra directamente como <strong>oportunidad</strong> en
        la pipeline. Si vuelve a llegar el mismo lead, se actualiza en lugar de duplicarse. Leads,
        pipeline, métricas y la calculadora de Estrategia GTM se recalculan solas al momento.
      </p>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Sources
          canManage={canManage}
          isLeader={!!me?.roles.some((r) => r === "owner" || r === "sales_leader")}
          isOwner={!!me?.roles.includes("owner")}
        />
        <CsvImport />
      </div>
      <ImportReview canManage={canManage} isOwner={!!me?.roles.includes("owner")} />
      <Events />
    </Page>
  );
}

const KIND: Record<string, string> = { leads: "Leads", accounts: "Cuentas" };
const MODE: Record<string, string> = {
  review: "Revisar antes de entrar",
  direct: "Entrada directa",
};
const intakeUrl = (kind: string, key = "TU_CLAVE") =>
  `${publicBase()}/api/public/${kind === "accounts" ? "accounts" : "leads"}?key=${key}`;

function Sources({
  canManage,
  isLeader,
  isOwner,
}: {
  canManage: boolean;
  isLeader: boolean;
  isOwner: boolean;
}) {
  const STAGE_OPTS = intakeStageOptions(useStages().stages);
  const qc = useQueryClient();
  const { data: sources = [] } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: async () =>
      (await supabase.from("lead_sources").select("*").order("created_at")).data ?? [],
  });
  async function upd(
    id: string,
    patch: {
      active?: boolean;
      default_stage?: string;
      mode?: string;
      max_per_request?: number;
      daily_limit?: number;
      paused_reason?: string | null;
    },
  ) {
    const { error } = await supabase.from("lead_sources").update(patch).eq("id", id);
    if (error) toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["lead-sources"] });
  }
  async function remove(id: string) {
    if (
      !(await askConfirm("¿Borrar esta conexión?", {
        body: "Las herramientas que la usan dejarán de enviar datos.",
        confirmLabel: "Borrar",
      }))
    )
      return;
    const { error } = await supabase.from("lead_sources").delete().eq("id", id);
    if (error) toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["lead-sources"] });
  }
  const modeOpts = isLeader ? MODE : { review: MODE.review };
  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-3xl">Conexiones de entrada</h2>
        {canManage && <NewSource isLeader={isLeader} />}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Un enlace seguro por origen (formulario, Zapier, Make, n8n, tu CRM o una lista de Sales
        Navigator). En «Revisar antes de entrar» nada toca tus datos hasta que lo apruebes. Si una
        conexión supera su límite diario, se pausa sola.
      </p>
      {sources.length === 0 ? (
        <Empty>
          {canManage
            ? "Crea tu primera conexión para empezar a recibir leads o cuentas."
            : "Pide al Owner, Sales Leader o Marketing que cree una conexión."}
        </Empty>
      ) : (
        <div className="divide-y rounded-md border">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-end gap-3 p-3 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {s.name}{" "}
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    · {KIND[s.kind] ?? s.kind}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Clave …{s.token_hint} · {s.received_count} recibidos
                  {s.last_received_at
                    ? ` · último ${new Date(s.last_received_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`
                    : " · aún sin envíos"}
                </p>
                {!s.active && s.paused_reason && (
                  <p className="text-xs text-destructive">Pausada: {s.paused_reason}</p>
                )}
              </div>
              <div className="w-48">
                <Field label="Modo">
                  {canManage && (isLeader || s.mode === "review") ? (
                    <Pick
                      value={s.mode}
                      options={modeOpts}
                      onChange={(v) => upd(s.id, { mode: v })}
                    />
                  ) : (
                    <p>{MODE[s.mode]}</p>
                  )}
                </Field>
              </div>
              {s.kind === "leads" && (
                <div className="w-40">
                  <Field label="Etapa por defecto">
                    {canManage ? (
                      <Pick
                        value={s.default_stage}
                        options={STAGE_OPTS}
                        onChange={(v) => upd(s.id, { default_stage: v })}
                      />
                    ) : (
                      <p>{STAGE_OPTS[s.default_stage]}</p>
                    )}
                  </Field>
                </div>
              )}
              <div className="w-24">
                <Field label="Por envío">
                  {canManage ? (
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={s.max_per_request}
                      onBlur={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (v >= 1 && v <= 500 && v !== s.max_per_request)
                          upd(s.id, { max_per_request: v });
                      }}
                    />
                  ) : (
                    <p>{s.max_per_request}</p>
                  )}
                </Field>
              </div>
              <div className="w-24">
                <Field label="Al día">
                  {canManage ? (
                    <Input
                      type="number"
                      min={1}
                      max={20000}
                      defaultValue={s.daily_limit}
                      onBlur={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (v >= 1 && v <= 20000 && v !== s.daily_limit)
                          upd(s.id, { daily_limit: v });
                      }}
                    />
                  ) : (
                    <p>{s.daily_limit}</p>
                  )}
                </Field>
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs">
                <Switch
                  checked={s.active}
                  disabled={!canManage}
                  onCheckedChange={(v) =>
                    upd(s.id, { active: v, ...(v ? { paused_reason: null } : {}) })
                  }
                />
                {s.active ? "Activo" : "Pausado"}
              </label>
              {isOwner && (
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                  <IconText icon={Trash2}>Borrar</IconText>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <HowTo />
    </section>
  );
}

function NewSource({ isLeader }: { isLeader: boolean }) {
  const STAGE_OPTS = intakeStageOptions(useStages().stages);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Formulario web");
  const [kind, setKind] = useState("leads");
  const [mode, setMode] = useState("review");
  const [stage, setStage] = useState("new");
  const [url, setUrl] = useState<string | null>(null);
  async function create() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = `gtm_${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
    const { error } = await supabase.from("lead_sources").insert({
      name: name.trim() || "Entrada",
      kind,
      mode,
      default_stage: stage,
      token_hash: await hashLeadKey(key),
      token_hint: key.slice(-4),
    });
    if (error) return toast.error(errorText(error));
    setUrl(intakeUrl(kind, key));
    qc.invalidateQueries({ queryKey: ["lead-sources"] });
  }
  function close(v: boolean) {
    setOpen(v);
    if (!v) {
      setUrl(null);
      setName("Formulario web");
      setKind("leads");
      setMode("review");
    }
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm">+ Nueva conexión</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{url ? "Tu enlace de entrada" : "Nueva conexión de entrada"}</DialogTitle>
        </DialogHeader>
        {url ? (
          <div className="space-y-3">
            <p className="text-sm">
              Cópialo ahora: por seguridad <strong>no se volverá a mostrar</strong>. Si lo pierdes,
              crea otra conexión y borra esta.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={url}
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant="outline"
                aria-label="Copiar enlace"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Enlace copiado.");
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pégalo como destino «Webhook» (método POST, JSON). Para probar sin guardar nada, añade{" "}
              <code>&test=1</code> al final.
            </p>
            <Button className="w-full" onClick={() => close(false)}>
              Hecho
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Nombre del origen">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sales Navigator vía Make, HubSpot…"
              />
            </Field>
            <Field label="Qué recibe">
              <Pick
                value={kind}
                options={{
                  leads: "Leads (personas o empresas interesadas)",
                  accounts: "Cuentas objetivo",
                }}
                onChange={setKind}
              />
            </Field>
            <Field label="Modo">
              <Pick
                value={mode}
                options={isLeader ? MODE : { review: MODE.review }}
                onChange={setMode}
              />
            </Field>
            {kind === "leads" && (
              <Field label="Etapa si el lead no trae ninguna">
                <Pick value={stage} options={STAGE_OPTS} onChange={setStage} />
              </Field>
            )}
            <Button className="w-full" onClick={create}>
              Crear conexión
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HowTo() {
  const example = `{
  "empresa": "Acme Logistics",
  "web": "acme.com",
  "email": "ana@acme.com",
  "nombre": "Ana Pérez",
  "etapa": "MQL",
  "fecha": "2026-10-15",
  "fecha_cierre": "2026-12-20",
  "importe": 24000,
  "id": "hubspot-123"
}`;
  return (
    <Accordion type="single" collapsible className="mt-4">
      <AccordionItem value="fields">
        <AccordionTrigger className="font-sans text-sm tracking-normal">
          Qué datos entiende
        </AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Reconoce nombres en español o inglés y las preguntas de tus formularios. Solo es
            obligatoria la <strong>empresa</strong> (o su web, o un email de empresa).
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Etapa del lead:</strong> Nuevo, Contactado, MQL, SQL o Descartado.{" "}
              <strong>Etapa de venta:</strong> Oportunidad, Descubrimiento, Cualificado, Demo,
              Propuesta, Negociación, Ganado, Perdido o el nombre de cualquier etapa de tu pipeline
              (entra como deal). También las de HubSpot, Pipedrive o Salesforce (p. ej.
              «marketingqualifiedlead» o «closedwon»).
            </li>
            <li>
              <strong>Fecha:</strong> cuándo entró el lead. <strong>Fecha de cierre:</strong>{" "}
              prevista o real. Admite 15/10/2026 o 2026-10-15.
            </li>
            <li>
              <strong>Importe:</strong> valor anual del deal. Con él se calcula el ACV real.
            </li>
            <li>
              <strong>id:</strong> el identificador en tu herramienta. Con él, cada actualización
              cae en el mismo lead o deal.
            </li>
          </ul>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {example}
          </pre>
          <p>
            Puedes enviar un lead o varios a la vez (máximo {LEAD_LIMITS.maxLeads} por envío) dentro
            de <code>{'{ "leads": [ … ] }'}</code>.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="forms">
        <AccordionTrigger className="font-sans text-sm tracking-normal">
          Formularios: Typeform, Tally, Webflow
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          En los ajustes del formulario abre <strong>Webhooks</strong>, añade uno nuevo y pega el
          enlace. Cada respuesta llega como lead Nuevo (o en la etapa por defecto del enlace).
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="zap">
        <AccordionTrigger className="font-sans text-sm tracking-normal">
          Zapier o Make
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          Añade el paso <strong>Webhooks → POST</strong> (en Make, «HTTP → Make a request»), pega el
          enlace, elige JSON y mapea los campos: empresa, email, etapa, fecha, importe e id. Así
          conectas cualquier herramienta: Google Sheets, LinkedIn Lead Gen, Calendly…
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="salesnav">
        <AccordionTrigger className="font-sans text-sm tracking-normal">
          Sales Navigator (con Make, n8n, Evaboot o Phantombuster)
        </AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Crea una conexión de <strong>Cuentas</strong> para listas de empresas o de{" "}
            <strong>Leads</strong> para listas de personas, en modo «Revisar antes de entrar».
          </p>
          <p>
            En Make o n8n: el disparador es tu extractor (Evaboot, Phantombuster o una hoja de
            Google con la exportación) y el paso final es «HTTP → POST» con JSON a tu enlace. Para
            cuentas envía{" "}
            <code>
              {'{ "accounts": [ { "empresa": …, "web": …, "sector": …, "empleados": … } ] }'}
            </code>
            ; para leads, empresa, nombre, cargo, email y LinkedIn.
          </p>
          <p>
            Prueba primero con <code>&test=1</code>: te devuelve qué entraría y qué no, sin guardar
            nada. Después cada envío aparece en «Pendientes de revisar».
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="hubspot">
        <AccordionTrigger className="font-sans text-sm tracking-normal">HubSpot</AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          En HubSpot crea un workflow (Automatización → Workflows) que se dispare al crear un
          contacto o deal y añade la acción «Enviar un webhook» (POST) a tu enlace. Incluye el id
          del registro como <code>id</code> para que las actualizaciones caigan en el mismo lead o
          deal. Empieza en modo «Revisar» y pásalo a «Entrada directa» cuando confíes en los datos.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="crm">
        <AccordionTrigger className="font-sans text-sm tracking-normal">
          CRM: HubSpot, Pipedrive, Attio, Salesforce
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          Crea una automatización que se dispare cuando se crea un deal o cambia de etapa y que
          envíe un webhook a este enlace. Incluye el id del deal, para que cada cambio de etapa
          actualice el mismo deal. Si tu CRM no tiene webhooks, usa Zapier o Make.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function CsvImport() {
  const STAGE_OPTS = intakeStageOptions(useStages().stages);
  const qc = useQueryClient();
  const run = useServerFn(importLeads);
  const [stage, setStage] = useState("new");
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, CsvField | null>>({});
  const [progress, setProgress] = useState<number | null>(null);
  async function onFile(file: File) {
    const parsed = parseCsv(await file.text());
    if (!parsed.length) return toast.error("El archivo no tiene filas.");
    setRows(parsed);
    setMapping(columnMapping(Object.keys(parsed[0] ?? {})));
  }
  async function start() {
    if (!rows) return;
    if (
      !Object.values(mapping).includes("company") &&
      !Object.values(mapping).some((f) => f === "domain" || f === "email")
    ) {
      return toast.error(
        "Ninguna columna es la empresa, el dominio o el email: asigna una en la tabla de columnas.",
      );
    }
    // The importer reads the columns as the person mapped them, not by guessing again.
    const mapped = applyColumnMapping(rows, mapping);
    const total = { created: 0, updated: 0, errors: 0 };
    setProgress(0);
    try {
      for (let i = 0; i < mapped.length; i += LEAD_LIMITS.maxLeads) {
        const r = await run({
          data: { rows: mapped.slice(i, i + LEAD_LIMITS.maxLeads), defaultStage: stage },
        });
        total.created += r.created;
        total.updated += r.updated;
        total.errors += r.errors.length;
        setProgress(Math.min(rows.length, i + LEAD_LIMITS.maxLeads));
      }
      toast.success(
        `${total.created} leads nuevos · ${total.updated} actualizados${total.errors ? ` · ${total.errors} con errores (mira «Últimos leads»)` : ""}`,
      );
      setRows(null);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setProgress(null);
      qc.invalidateQueries();
    }
  }
  const cols = rows ? Object.keys(rows[0] ?? {}) : [];
  const noCloseDate = rows ? dealsWithoutCloseDate(rows, mapping, stage) : false;
  const ignored = cols.filter((c) => mapping[c] == null);
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-3xl">Subir CSV o Excel</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Exporta tus leads a CSV (en Excel: Guardar como → CSV) con columnas como empresa, email,
        etapa, fecha de entrada, fecha de cierre e importe. Antes de importar verás qué campo
        rellena cada columna. Puedes repetir la subida: actualiza sin duplicar.
      </p>
      <div className="space-y-3">
        <Field label="Etapa si la fila no trae ninguna">
          <Pick value={stage} options={STAGE_OPTS} onChange={setStage} />
        </Field>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {rows && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p>
              <strong>{rows.length}</strong> filas · {cols.length} columnas. Revisa qué campo
              rellena cada una antes de importar:
            </p>
            <div className="mt-2 divide-y divide-hairline border-y border-hairline">
              {cols.map((c) => (
                <div
                  key={c}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 py-1.5"
                >
                  <span className="truncate font-mono text-xs" title={c}>
                    {c} <span className="text-muted-foreground">· {rows[0]?.[c] || "vacía"}</span>
                  </span>
                  <Pick
                    value={mapping[c] ?? ""}
                    options={CSV_FIELD_OPTS}
                    onChange={(v) =>
                      setMapping({ ...mapping, [c]: (v || null) as CsvField | null })
                    }
                  />
                </div>
              ))}
            </div>
            {ignored.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No se importan: {ignored.join(", ")}.
              </p>
            )}
            {noCloseDate && (
              <p className="mt-2 text-xs text-destructive">
                Hay filas que crean deals y ninguna columna es la fecha de cierre: esos deals no
                contarán en la cobertura ni en el forecast de ningún trimestre. Si una columna es la
                fecha de cierre, asígnala arriba.
              </p>
            )}
            <Button className="mt-3 w-full" disabled={progress != null} onClick={start}>
              {progress != null
                ? `Importando ${progress}/${rows.length}…`
                : `Importar ${rows.length} leads`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Events() {
  const { data: events = [] } = useQuery({
    queryKey: ["lead-events"],
    queryFn: async () =>
      (
        await supabase
          .from("lead_events")
          .select("*, lead_sources(name)")
          .order("received_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-3xl">Últimos leads</h2>
      {events.length === 0 ? (
        <Empty>Aún no ha entrado ningún lead. Aparecerán aquí al momento.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                {["Cuándo", "Origen", "Estado", "Lead", "Aviso"].map((h) => (
                  <th key={h} className="eyebrow px-3 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const [label, tone] = STATUS[e.status] ?? [e.status, "bg-muted"];
                return (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(e.received_at).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      {e.channel === "csv"
                        ? "CSV"
                        : ((e.lead_sources as { name: string } | null)?.name ?? "Enlace")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-xs uppercase ${tone}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {e.account_id ? (
                        <Link
                          to="/accounts/$id"
                          params={{ id: e.account_id }}
                          className="underline-offset-2 hover:underline"
                        >
                          {e.summary}
                        </Link>
                      ) : (
                        e.summary
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.error}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
