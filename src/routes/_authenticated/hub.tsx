import { createFileRoute } from "@tanstack/react-router";
import { useJob } from "@/components/background";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useOpenDocFromUrl } from "@/hooks/use-open-doc-from-url";
import { canDelete } from "@/lib/roles";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { confirmed, NOT_SAVED } from "@/lib/save";
import { missingPlays } from "@/lib/playbooks/adapt";
import { DriveImportButton, SaveToDriveButton } from "@/components/drive";
import { BattlecardFromReviews } from "@/components/linkedin";
import { DriveAccountsPanel } from "@/components/drive-overview";

export const Route = createFileRoute("/_authenticated/hub")({
  // doc: opened from a notice (an import or a battlecard made in the background).
  validateSearch: (s: Record<string, unknown>): { doc?: string } =>
    typeof s.doc === "string" ? { doc: s.doc } : {},
  head: () => ({
    meta: [
      { title: "Conocimiento — Nokko" },
      { name: "description", content: "El cerebro compartido del equipo comercial." },
      { property: "og:title", content: "Conocimiento — Nokko" },
      { property: "og:description", content: "El cerebro compartido del equipo comercial." },
    ],
  }),
  component: Hub,
});

const SECTIONS = [
  ["company", "Empresa", "Servicios, ICP, buyer personas, ofertas, precios, propuesta de valor"],
  [
    "objections",
    "Objeciones y battlecards",
    "Respuestas a objeciones y comparativas con competidores",
  ],
  ["playbooks", "Playbooks", "Prospección, discovery, demo, negociación, traspaso a CS"],
  ["methodology", "Metodología", "MEDDPICC y plantillas de cualificación"],
  ["campaigns", "Campañas", "Lista, copy y qué consiguió"],
  ["skills", "Skills", "Tareas repetibles: de equipo y personales"],
  ["rules", "Reglas", "Lo que los agentes no pueden hacer sin una persona"],
] as const;

/** Not a knowledge section: the documents saved in each account's Google Drive folder. */
const DRIVE_TAB = "drive";

// Below lg the editor sits under the list; bring it into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

type Doc = {
  id: string;
  section: string;
  title: string;
  body: string;
  scope: string;
  mandatory?: boolean;
  created_by: string | null;
  updated_at: string;
};

function Hub() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [section, setSection] = useState<string>("company");
  const [selected, setSelected] = useState<Doc | null>(null);
  // Each «+ Nuevo» is a fresh editor, even when another unsaved draft was open.
  const [draftSeq, setDraftSeq] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const { data: docs = [] } = useQuery({
    queryKey: ["docs"],
    queryFn: async () =>
      ((await supabase.from("knowledge_docs").select("*").order("updated_at", { ascending: false }))
        .data ?? []) as Doc[],
  });
  const list = docs.filter((d) => d.section === section);
  const { doc: docParam } = Route.useSearch();
  // The document named by ?doc= opens once; creating, deleting or importing another never moves the person's selection.
  useOpenDocFromUrl(docParam, docs, (d) => {
    setSection(d.section);
    setSelected(d);
  });
  /** After an import or a generated doc: refresh and open it. */
  async function openDoc(docId: string) {
    await qc.invalidateQueries({ queryKey: ["docs"] });
    const row = (qc.getQueryData<Doc[]>(["docs"]) ?? []).find((d) => d.id === docId);
    if (row) {
      setSelected(row);
      revealOnMobile(editorRef.current);
    }
  }
  const isOwner = canDelete(me?.roles ?? []);
  const canLibrary = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  const missing = missingPlays(docs);
  const library = useJob("playbook_library", {
    onDone: () => qc.invalidateQueries({ queryKey: ["docs"] }),
  });

  // «+ Nuevo» opens an unsaved draft; nothing reaches the database until the person saves a title and a body.
  const draft = (): Doc => ({
    id: "",
    section,
    title: "",
    body: "",
    scope: section === "skills" ? "personal" : "team",
    mandatory: false,
    created_by: null,
    updated_at: "",
  });
  const save = useMutation({
    mutationFn: async (d: Partial<Doc>) => {
      const title = (d.title ?? "").trim();
      const body = d.body ?? "";
      if (!title || !body.trim())
        throw new Error("Escribe un título y el contenido antes de guardar.");
      const row = d.id
        ? await confirmed(
            supabase
              .from("knowledge_docs")
              .update({ title, body, scope: d.scope, mandatory: !!d.mandatory })
              .eq("id", d.id)
              .select("*"),
          )
        : await confirmed(
            supabase
              .from("knowledge_docs")
              .insert({
                section,
                title,
                body,
                scope: d.scope ?? (section === "skills" ? "personal" : "team"),
                mandatory: !!d.mandatory,
              })
              .select("*"),
          );
      // The toast reflects what the server stored, not what the form holds.
      if ((row as Doc).body !== body || (row as Doc).title !== title) throw new Error(NOT_SAVED);
      return row as Doc;
    },
    onSuccess: (row) => {
      setSelected(row);
      qc.invalidateQueries({ queryKey: ["docs"] });
      toast.success("Guardado.");
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_docs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
  });

  return (
    <Page
      eyebrow="Una sola fuente de verdad"
      title="Conocimiento"
      actions={
        canLibrary && missing.length > 0 ? (
          <Button variant="outline" disabled={library.running} onClick={() => library.start({})}>
            {library.running
              ? `Adaptando en segundo plano · ${library.job?.step ?? "en cola"}`
              : `Biblioteca de jugadas de Nokko (${missing.length})`}
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-[220px_280px_1fr]">
        {/* Phones: sections as a horizontal chip row; a column from lg. */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setSelected(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm lg:block lg:w-full lg:whitespace-normal lg:border-0 ${section === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {label}{" "}
              <span className="ml-1 font-mono text-xs opacity-60 lg:float-right lg:ml-0">
                {docs.filter((d) => d.section === id).length}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
              setSection(DRIVE_TAB);
              setSelected(null);
            }}
            className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm lg:mt-3 lg:block lg:w-full lg:whitespace-normal lg:border-0 lg:border-t ${section === DRIVE_TAB ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Drive por cuenta
          </button>
        </nav>
        {section === DRIVE_TAB ? (
          <div className="min-w-0 lg:col-span-2">
            <DriveAccountsPanel />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {SECTIONS.find((s) => s[0] === section)?.[2]}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setDraftSeq((n) => n + 1);
                  setSelected(draft());
                  revealOnMobile(editorRef.current);
                }}
              >
                + Nuevo
              </Button>
              <DriveImportButton section={section} onImported={openDoc} />
              {section === "objections" && <BattlecardFromReviews onSaved={openDoc} />}
              {list.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelected(d);
                    revealOnMobile(editorRef.current);
                  }}
                  className={`block w-full min-w-0 break-words rounded-md border p-3 text-left text-sm ${selected?.id === d.id ? "border-signal bg-card" : "bg-card/50 hover:bg-card"}`}
                >
                  <span className="font-medium">{d.title}</span>
                  {d.scope === "personal" && (
                    <span className="ml-2 rounded bg-accent px-1.5 font-mono text-xs uppercase">
                      personal
                    </span>
                  )}
                  {d.scope === "team" && (d.mandatory || d.section === "rules") && (
                    <span className="ml-2 rounded bg-signal/15 px-1.5 font-mono text-xs uppercase text-signal">
                      obligatorio
                    </span>
                  )}
                </button>
              ))}
              {list.length === 0 && (
                <Empty>Sin documentos todavía. Crea el primero con «+ Nuevo».</Empty>
              )}
            </div>
            <div ref={editorRef} className="min-w-0 scroll-mt-20">
              {selected ? (
                <Editor
                  key={selected.id || `draft-${draftSeq}`}
                  doc={selected}
                  isOwner={isOwner}
                  saving={save.isPending}
                  onSave={(d) => save.mutate(d)}
                  onDelete={() => del.mutate(selected.id)}
                />
              ) : (
                <Empty>Selecciona o crea un documento.</Empty>
              )}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

function Editor({
  doc,
  isOwner,
  saving,
  onSave,
  onDelete,
}: {
  doc: Doc;
  isOwner: boolean;
  saving: boolean;
  onSave: (d: Partial<Doc>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [mandatory, setMandatory] = useState(!!doc.mandatory);
  const isDraft = !doc.id;
  const isRules = doc.section === "rules";
  const empty = !title.trim() || !body.trim();
  const id = doc.id || undefined;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      {isDraft && <p className="eyebrow">Documento nuevo · sin guardar</p>}
      <Input
        value={title}
        placeholder="Título"
        onChange={(e) => setTitle(e.target.value)}
        className="font-display text-2xl"
      />
      <Textarea
        value={body}
        placeholder="Contenido"
        onChange={(e) => setBody(e.target.value)}
        rows={18}
        className="font-mono text-base md:text-sm"
      />
      {doc.scope === "team" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={isRules || mandatory}
            disabled={isRules}
            onChange={(e) => setMandatory(e.target.checked)}
          />
          <span>
            De obligado cumplimiento
            <span className="block text-xs text-muted-foreground">
              {isRules ? "Todo lo de Reglas lo es: " : ""}los agentes lo leen siempre al redactar el
              brief, el plan y los demás documentos del Ciclo GTM, y aparece en sus fuentes.
            </span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={empty || saving}
          onClick={() => onSave({ id, title, body, scope: doc.scope, mandatory })}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {doc.section === "skills" && doc.scope === "personal" && isOwner && !isDraft && (
          <Button
            variant="outline"
            disabled={empty || saving}
            onClick={() => onSave({ id, title, body, scope: "team", mandatory })}
          >
            Promover a equipo
          </Button>
        )}
        {empty && (
          <span className="text-xs text-muted-foreground">
            Escribe un título y el contenido para poder guardar.
          </span>
        )}
        {!isDraft && (
          <SaveToDriveButton title={title || doc.title} markdown={`# ${title}\n\n${body}`} />
        )}
        {isOwner && !isDraft && (
          <Button variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
