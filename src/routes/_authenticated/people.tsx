import { NativeSelect } from "@/components/native-select";
import { createFileRoute } from "@tanstack/react-router";
import { EntityCombobox, useAccountOptions } from "@/components/entity-combobox";
import { normName } from "@/lib/match";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Page, Empty } from "@/components/page";
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
import { dedupePeople, parseCsv } from "@/lib/dedupe";
import { CAMPAIGN_RESULTS, SOURCES } from "@/lib/roles";
import { errorText } from "@/lib/errors";
import { ApolloPhones } from "@/components/apollo";
import { PersonQuickActions } from "@/components/quick-actions";
import { fetchAll } from "@/lib/fetch-all";
import { askConfirm } from "@/components/confirm-dialog";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { EmailVerificationMark, useEmailVerifications } from "@/components/email-verification";

export const Route = createFileRoute("/_authenticated/people")({
  validateSearch: (s: Record<string, unknown>): { persona?: string } => ({
    persona: typeof s.persona === "string" ? s.persona : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personas — Nokko" },
      { name: "description", content: "Base única de personas sin duplicados." },
      { property: "og:title", content: "Personas — Nokko" },
      { property: "og:description", content: "Base única de personas sin duplicados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: People,
});

const SEQ = {
  none: "Sin secuencia",
  active: "En secuencia",
  finished: "Terminada",
  paused: "Pausada",
};
const CRM = {
  lead: "Lead",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Oportunidad",
  customer: "Cliente",
  disqualified: "Descartado",
};

function People() {
  const qc = useQueryClient();
  const { persona } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [p, c, r] = await Promise.all([
        fetchAll((a, b) =>
          supabase
            .from("people")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id")
            .range(a, b),
        ).then((r) => ({ data: r.rows })),
        supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("campaign_results").select("*"),
      ]);
      return { people: p.data ?? [], campaigns: c.data ?? [], results: r.data ?? [] };
    },
  });
  const people = data?.people ?? [];
  const byPerson = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of data?.results ?? [])
      m.set(r.person_id, [...(m.get(r.person_id) ?? []), r.result]);
    return m;
  }, [data]);
  const list = people.filter((p) => {
    if (persona) return p.id === persona;
    const t = `${p.full_name} ${p.email} ${p.company}`.toLowerCase();
    if (q && !t.includes(q.toLowerCase())) return false;
    const res = byPerson.get(p.id) ?? [];
    if (filter === "replied_no_book") return res.includes("replied") && !res.includes("booked");
    if (filter === "tierA") return p.tier === "A";
    if (filter === "in_deal") return p.crm_stage === "opportunity" || p.crm_stage === "customer";
    return true;
  });
  const verification = useEmailVerifications(list.map((p) => p.email));

  async function update(id: string, patch: TablesUpdate<"people">) {
    const { error } = await supabase.from("people").update(patch).eq("id", id);
    if (error) toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  async function logResult(person_id: string, campaign_id: string, result: string) {
    const { error } = await supabase
      .from("campaign_results")
      .upsert({ person_id, campaign_id, result }, { onConflict: "campaign_id,person_id" });
    if (error) toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  // Editable fields per person, shared by the mobile cards and the desktop table.
  const editors = (p: (typeof people)[number]) => [
    {
      label: "Fuente",
      w: "w-36",
      node: (
        <Pick
          value={p.source ?? ""}
          options={SOURCES}
          onChange={(v) => update(p.id, { source: v })}
        />
      ),
    },
    {
      label: "Tier",
      w: "w-20",
      node: (
        <Pick
          value={p.tier ?? "B"}
          options={{ A: "A", B: "B", C: "C" }}
          onChange={(v) => update(p.id, { tier: v })}
        />
      ),
    },
    {
      label: "Secuencia",
      w: "w-36",
      node: (
        <Pick
          value={p.sequence_stage ?? "none"}
          options={SEQ}
          onChange={(v) => update(p.id, { sequence_stage: v })}
        />
      ),
    },
    {
      label: "Etapa CRM",
      w: "w-36",
      node: (
        <Pick
          value={p.crm_stage ?? "lead"}
          options={CRM}
          onChange={(v) => update(p.id, { crm_stage: v })}
        />
      ),
    },
  ];
  const results = (id: string) =>
    (byPerson.get(id) ?? []).map((r) => CAMPAIGN_RESULTS[r]).join(", ") || "—";

  return (
    <Page
      eyebrow="Una fila por persona"
      title="Personas"
      actions={
        <>
          <NewCampaign />
          <AddPerson existing={people} />
          <ImportCsv existing={people} />
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {[
          ["all", "Todas"],
          ["tierA", "Tier A"],
          ["replied_no_book", "Respondió y no reservó"],
          ["in_deal", "En deal / cliente"],
        ].map(([k, l]) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {l}
          </Button>
        ))}
        <span className="ml-auto self-center font-mono text-xs text-muted-foreground">
          {list.length} / {people.length}
        </span>
      </div>
      {persona && (
        <p className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-mid">
          Mostrando la persona que abriste desde la búsqueda.
          <Button size="sm" variant="outline" onClick={() => navigate({ search: {} })}>
            Ver todas
          </Button>
        </p>
      )}
      {list.length === 0 ? (
        <Empty>Sin personas. Importa un CSV o añade una a mano.</Empty>
      ) : (
        <>
          <ul className="border-t md:hidden">
            {list.map((p) => (
              <li key={p.id} className="space-y-3 border-b py-4 text-sm">
                <div>
                  <p className="break-words font-medium">{p.full_name || "—"}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {p.email}
                    {p.company ? ` · ${p.company}` : ""}
                  </p>
                  <EmailVerificationMark
                    email={p.email}
                    rows={verification.data}
                    error={verification.error}
                  />
                  <span className="mt-1 inline-block">
                    <PersonQuickActions person={p} />
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {editors(p).map((e) => (
                    <Field key={e.label} label={e.label}>
                      {e.node}
                    </Field>
                  ))}
                </div>
                <p className="text-xs">
                  <span className="eyebrow mr-2">Campañas</span>
                  {results(p.id)}
                </p>
                <ResultLogger
                  campaigns={data?.campaigns ?? []}
                  onLog={(c, r) => logResult(p.id, c, r)}
                />
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {[
                    "Persona",
                    "Fuente",
                    "Tier",
                    "Secuencia",
                    "Etapa CRM",
                    "Campañas",
                    "Registrar resultado",
                    "",
                  ].map((h) => (
                    <th key={h} className="eyebrow px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{p.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.email}
                        {p.company ? ` · ${p.company}` : ""}
                      </p>
                      <EmailVerificationMark
                        email={p.email}
                        rows={verification.data}
                        error={verification.error}
                      />
                    </td>
                    {editors(p).map((e) => (
                      <td key={e.label} className={`px-3 py-2 ${e.w}`}>
                        {e.node}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs">{results(p.id)}</td>
                    <td className="px-3 py-2">
                      <ResultLogger
                        campaigns={data?.campaigns ?? []}
                        onLog={(c, r) => logResult(p.id, c, r)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <PersonQuickActions person={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ApolloPhones />
    </Page>
  );
}

function ResultLogger({
  campaigns,
  onLog,
}: {
  campaigns: { id: string; name: string }[];
  onLog: (c: string, r: string) => void;
}) {
  const [c, setC] = useState("");
  if (!campaigns.length)
    return <span className="text-xs text-muted-foreground">Crea una campaña</span>;
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:gap-1">
      <NativeSelect
        density="compact"
        aria-label="Campaña"
        className="min-w-0"
        value={c}
        onChange={(e) => setC(e.target.value)}
      >
        <option value="">Campaña…</option>
        {campaigns.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        density="compact"
        aria-label="Resultado"
        className="min-w-0"
        disabled={!c}
        value=""
        onChange={(e) => e.target.value && onLog(c, e.target.value)}
      >
        <option value="">Resultado…</option>
        {Object.entries(CAMPAIGN_RESULTS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function AddPerson({
  existing,
}: {
  existing: {
    email: string | null;
    linkedin_url: string | null;
    full_name?: string | null;
    company?: string | null;
  }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    full_name: "",
    email: "",
    linkedin_url: "",
    company: "",
    title: "",
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: accounts = [] } = useAccountOptions(open);
  async function save() {
    const same = existing.find(
      (p) =>
        normName(p.full_name) === normName(f.full_name) &&
        normName(p.company) === normName(f.company),
    );
    if (
      same &&
      !(await askConfirm(`Ya tienes a ${f.full_name}${f.company ? ` en ${f.company}` : ""}`, {
        body: "¿Añadirla igualmente?",
        confirmLabel: "Añadir igualmente",
      }))
    )
      return;
    const { fresh } = dedupePeople([f], existing);
    if (!fresh.length)
      return toast.error("Esta persona ya existe (mismo email o LinkedIn) o falta email/LinkedIn.");
    const { error } = await supabase.from("people").insert({
      ...fresh[0],
      full_name: f.full_name,
      company: f.company,
      title: f.title,
      account_id: accountId,
    });
    if (error)
      return toast.error(error.code === "23505" ? "Duplicado: ya existe." : errorText(error));
    setOpen(false);
    setF({ full_name: "", email: "", linkedin_url: "", company: "", title: "" });
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Persona</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir persona</DialogTitle>
        </DialogHeader>
        {(["full_name", "email", "linkedin_url"] as const).map((k) => (
          <Input
            key={k}
            placeholder={
              {
                full_name: "Nombre",
                email: "Email",
                linkedin_url: "URL de LinkedIn",
                company: "Empresa",
                title: "Cargo",
              }[k]
            }
            value={f[k]}
            onChange={(e) => setF({ ...f, [k]: e.target.value })}
          />
        ))}
        <EntityCombobox
          items={accounts}
          value={f.company}
          selectedId={accountId}
          onChange={(t, a) => {
            setF({ ...f, company: t });
            setAccountId(a?.id ?? null);
          }}
          placeholder="Empresa (busca entre tus cuentas)"
          noun="empresa nueva"
          logos
          ariaLabel="Empresa"
        />
        <Input
          placeholder="Cargo"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <Button onClick={save}>Guardar</Button>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsv({
  existing,
}: {
  existing: { email: string | null; linkedin_url: string | null }[];
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState("cold_list");
  const [open, setOpen] = useState(false);
  async function onFile(file: File) {
    const rows = parseCsv(await file.text()).map((r) => ({
      full_name: r.name || r.full_name || r.nombre || "",
      email: r.email || r.correo || "",
      linkedin_url: r.linkedin || r.linkedin_url || "",
      company: r.company || r.empresa || "",
      title: r.title || r.cargo || "",
      source,
    }));
    const { fresh, skipped } = dedupePeople(rows, existing);
    let inserted = 0;
    for (let i = 0; i < fresh.length; i += 200) {
      const batch = fresh.slice(i, i + 200);
      const { data, error } = await supabase.from("people").insert(batch).select("id");
      if (!error) {
        inserted += data?.length ?? 0;
        continue;
      }
      for (const row of batch) {
        const r = await supabase.from("people").insert(row);
        if (!r.error) inserted++;
      }
    }
    toast.success(
      `${inserted} personas importadas · ${skipped + (fresh.length - inserted)} duplicadas o sin email/LinkedIn omitidas.`,
    );
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Importar CSV</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar personas</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Columnas: name, email, linkedin, company, title. Se omiten duplicados por email o
          LinkedIn.
        </p>
        <Pick value={source} options={SOURCES} onChange={setSource} />
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewCampaign() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [copy, setCopy] = useState("");
  async function save() {
    const { error } = await supabase.from("campaigns").insert({ name, copy });
    if (error) return toast.error(errorText(error));
    setOpen(false);
    setName("");
    setCopy("");
    qc.invalidateQueries({ queryKey: ["people"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Campaña</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva campaña</DialogTitle>
        </DialogHeader>
        <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          className="min-h-32 rounded-md border bg-background p-2 text-base md:text-sm"
          placeholder="Copy"
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
        />
        <Button disabled={!name} onClick={save}>
          Crear
        </Button>
      </DialogContent>
    </Dialog>
  );
}
