import { useSearch, useNavigate } from "@tanstack/react-router";
import { useJob } from "@/components/background";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useOpenDocFromUrl } from "@/hooks/use-open-doc-from-url";
import { useUrlSection } from "@/hooks/use-url-section";
import {
  HUB_DEFAULT_SECTION,
  HUB_SECTIONS,
  nextSearchOnSectionChange,
  searchWithSection,
  sectionOf,
} from "@/lib/screen-sections";
import { canDelete } from "@/lib/roles";
import { Page, Empty, ScreenState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/errors";
import { confirmed, NOT_SAVED } from "@/lib/save";
import { missingPlays } from "@/lib/playbooks/adapt";
import { fetchAll } from "@/lib/fetch-all";
import { searchDocs } from "@/lib/text-search";
import {
  cleanQuery,
  emptySearchText,
  nextSearch,
  sectionCounts,
  truncatedNotice,
} from "@/lib/hub-search";
import { DriveImportButton } from "@/components/drive";
import { BattlecardFromReviews } from "@/components/linkedin";
import { DriveAccountsPanel } from "@/components/drive-overview";
import { Editor } from "@/components/hub/doc-editor";
import {
  AGENT_RULE_LIMITS,
  BINDING_SECTION_READ_ONLY,
  canWriteBinding,
  rulesCoverage,
  rulesNotice,
} from "@/lib/knowledge-rules";

export const SECTIONS = [
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
  [
    "rules",
    "Reglas",
    "Lo que los agentes no pueden hacer sin una persona. El agente lee estas reglas en cada conversación y al redactar seguimientos y briefs de reunión.",
  ],
] as const;

/** Not a knowledge section: the documents saved in each account's Google Drive folder. */
export const DRIVE_TAB = "drive";

// Below lg the editor sits under the list; bring it into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

export type Doc = {
  id: string;
  section: string;
  title: string;
  body: string;
  scope: string;
  mandatory?: boolean;
  created_by: string | null;
  updated_at: string;
};

const NO_DOCS: Doc[] = [];
/** Pause in typing before ?q= is written. */
const SEARCH_URL_DEBOUNCE_MS = 300;
type DocsCache = { rows: Doc[]; truncated: boolean };

export function HubScreen() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [selected, setSelected] = useState<Doc | null>(null);
  // Each «+ Nuevo» is a fresh editor, even when another unsaved draft was open.
  const [draftSeq, setDraftSeq] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  // Paged read (never stops silently at the backend row cap); the cache holds { rows, truncated }.
  const { data, isSuccess, isPending, error, refetch } = useQuery({
    queryKey: ["docs"],
    queryFn: (): Promise<DocsCache> =>
      fetchAll<Doc>((a, b) =>
        supabase
          .from("knowledge_docs")
          .select("*")
          .order("updated_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
  });
  const docs = data?.rows ?? NO_DOCS;
  const { doc: docParam, q: qParam, seccion } = useSearch({ from: "/_authenticated/hub" });
  const navigate = useNavigate({ from: "/hub" });
  const [section, setSection] = useUrlSection(
    sectionOf(HUB_SECTIONS, HUB_DEFAULT_SECTION, seccion),
  );
  const list = docs.filter((d) => d.section === section);
  // How many rules the agent reads, counted with the reader's own function (SDD-20261106-agent-rules-reader, CA-6).
  const rulesWarning =
    section === "rules" && data
      ? rulesNotice(rulesCoverage(data.rows, AGENT_RULE_LIMITS), data.truncated)
      : null;
  // The URL write of the search box waits for a pause in typing (NK-0067: every navigation re-checks the session).
  // `pending` holds the text not yet written; section change, Escape, «Borrar búsqueda» and unmount write it right away.
  const pending = useRef<{ value: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  /** Takes the pending text (and cancels its timer), or null when nothing waits. */
  function takePending(): string | null {
    const p = pending.current;
    if (!p) return null;
    clearTimeout(p.timer);
    pending.current = null;
    return p.value;
  }
  // A person changing section replaces the URL: seccion set (not the default), doc out (it only wins when the page opens), q kept
  // (a q still waiting for its pause is written in this same navigation).
  function goToSection(id: string) {
    setSection(id);
    setSelected(null);
    const waiting = takePending();
    navigate({
      search: (prev) =>
        nextSearchOnSectionChange(
          waiting === null ? prev : nextSearch(prev, waiting),
          id,
          HUB_DEFAULT_SECTION,
        ),
      replace: true,
    });
  }
  useEffect(
    () => () => {
      const waiting = takePending();
      if (waiting !== null)
        navigateRef.current({ search: (prev) => nextSearch(prev, waiting), replace: true });
    },
    [],
  );
  // The box is local state seeded from ?q= (typing never waits for the router, so spaces survive); the URL gets q after a typing pause (see typeQuery) and at once on clear, section change or unmount.
  const [text, setText] = useState(qParam ?? "");
  const active = cleanQuery(text);
  const results = useMemo(() => (active ? searchDocs(docs, active) : null), [docs, active]);
  const counts = sectionCounts(
    SECTIONS.map((s) => s[0]),
    docs,
    results,
  );
  const snippets = new Map((results ?? []).map((r) => [r.doc.id, r.snippet]));
  /** Typing: the list filters now, the URL after 300 ms without keys. */
  function typeQuery(value: string) {
    setText(value);
    takePending();
    const timer = setTimeout(() => {
      pending.current = null;
      navigate({ search: (prev) => nextSearch(prev, value), replace: true });
    }, SEARCH_URL_DEBOUNCE_MS);
    pending.current = { value, timer };
  }
  /** Escape and «Borrar búsqueda»: written at once, nothing left waiting. */
  function clearQuery() {
    setText("");
    takePending();
    navigate({ search: (prev) => nextSearch(prev, ""), replace: true });
  }
  // The document named by ?doc= opens once; creating, deleting or importing another never moves the person's selection.
  // The section of that document wins over ?seccion= at that moment and is written back, keeping doc.
  useOpenDocFromUrl(docParam, docs, (d) => {
    setSection(d.section);
    setSelected(d);
    if (d.section !== sectionOf(HUB_SECTIONS, HUB_DEFAULT_SECTION, seccion)) {
      navigate({
        search: (prev) => searchWithSection(prev, d.section, HUB_DEFAULT_SECTION),
        replace: true,
      });
    }
  });
  /** After an import or a generated doc: refresh and open it. */
  async function openDoc(docId: string) {
    await qc.invalidateQueries({ queryKey: ["docs"] });
    const row = qc.getQueryData<DocsCache>(["docs"])?.rows.find((d) => d.id === docId);
    if (row) {
      setSelected(row);
      revealOnMobile(editorRef.current);
    }
  }
  const isOwner = canDelete(me?.roles ?? []);
  const canLibrary = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  // Reglas: only the Owner or a Sales Leader write it (NK-0095); disabled until the role is known, the reason once it is.
  const rulesLocked = section === "rules" && !canWriteBinding(me?.roles);
  const rulesReason = rulesLocked && me ? BINDING_SECTION_READ_ONLY : undefined;
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
        <div className="min-w-0 space-y-3">
          {section !== DRIVE_TAB && (
            <div className="relative">
              <Input
                value={text}
                aria-label="Buscar en Conocimiento"
                placeholder="Buscar en Conocimiento"
                onChange={(e) => typeQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") clearQuery();
                }}
                className={text ? "pr-24" : undefined}
              />
              {text && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                  onClick={clearQuery}
                >
                  Borrar búsqueda
                </Button>
              )}
            </div>
          )}
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => goToSection(id)}
                className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm lg:block lg:w-full lg:whitespace-normal lg:border-0 ${section === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {label}{" "}
                {/* No number until the documents answer (never a 0 that looks like data). */}
                {isSuccess && (
                  <span className="ml-1 font-mono text-xs opacity-60 lg:float-right lg:ml-0">
                    {counts[id] ?? 0}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => goToSection(DRIVE_TAB)}
              className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm lg:mt-3 lg:block lg:w-full lg:whitespace-normal lg:border-0 lg:border-t ${section === DRIVE_TAB ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Drive por cuenta
            </button>
          </nav>
        </div>
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
              {rulesReason && <p className="text-xs text-muted-foreground">{rulesReason}</p>}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={rulesLocked}
                onClick={() => {
                  setDraftSeq((n) => n + 1);
                  setSelected(draft());
                  revealOnMobile(editorRef.current);
                }}
              >
                + Nuevo
              </Button>
              <DriveImportButton
                section={section}
                onImported={openDoc}
                disabled={rulesLocked}
                reason={rulesReason}
              />
              {section === "objections" && <BattlecardFromReviews onSaved={openDoc} />}
              <ScreenState isPending={isPending} error={error} refetch={refetch}>
                {data?.truncated && (
                  <p className="text-xs text-muted-foreground">{truncatedNotice(docs.length)}</p>
                )}
                {rulesWarning && <p className="text-xs text-muted-foreground">{rulesWarning}</p>}
                <div data-testid="hub-results" className="space-y-2">
                  {(results ? results.map((r) => r.doc) : list).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelected(d);
                        revealOnMobile(editorRef.current);
                      }}
                      className={`block w-full min-w-0 break-words rounded-md border p-3 text-left text-sm ${selected?.id === d.id ? "border-signal bg-card" : "bg-card/50 hover:bg-card"}`}
                    >
                      <span className="font-medium">{d.title}</span>
                      {results && (
                        <span className="ml-2 font-mono text-xs uppercase text-muted-foreground">
                          {SECTIONS.find((s) => s[0] === d.section)?.[1]}
                        </span>
                      )}
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
                      {snippets.get(d.id) && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {snippets.get(d.id)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {!results && list.length === 0 && (
                  <Empty>Sin documentos todavía. Crea el primero con «+ Nuevo».</Empty>
                )}
                {results && results.length === 0 && isSuccess && active && (
                  <Empty>{emptySearchText(active)}</Empty>
                )}
              </ScreenState>
            </div>
            <div ref={editorRef} className="min-w-0 scroll-mt-20">
              {selected ? (
                <Editor
                  key={selected.id || `draft-${draftSeq}`}
                  doc={selected}
                  roles={me?.roles}
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
