import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { canDelete } from "@/lib/roles";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({ meta: [{ title: "Conocimiento — Nokko" }, { name: "description", content: "El cerebro compartido del equipo comercial." }, { property: "og:title", content: "Conocimiento — Nokko" }, { property: "og:description", content: "El cerebro compartido del equipo comercial." }] }),
  component: Hub,
});

const SECTIONS = [
  ["company", "Empresa", "Servicios, ICP, buyer personas, ofertas, precios, propuesta de valor"],
  ["objections", "Objeciones y battlecards", "Respuestas a objeciones y comparativas con competidores"],
  ["playbooks", "Playbooks", "Prospección, discovery, demo, negociación, traspaso a CS"],
  ["methodology", "Metodología", "MEDDPICC y plantillas de cualificación"],
  ["campaigns", "Campañas", "Lista, copy y qué consiguió"],
  ["skills", "Skills", "Tareas repetibles: de equipo y personales"],
  ["rules", "Reglas", "Lo que los agentes no pueden hacer sin una persona"],
] as const;

// Below lg the editor sits under the list; bring it into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

type Doc = { id: string; section: string; title: string; body: string; scope: string; created_by: string | null; updated_at: string };

function Hub() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [section, setSection] = useState<string>("company");
  const [selected, setSelected] = useState<Doc | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { data: docs = [] } = useQuery({
    queryKey: ["docs"],
    queryFn: async () => ((await supabase.from("knowledge_docs").select("*").order("updated_at", { ascending: false })).data ?? []) as Doc[],
  });
  const list = docs.filter((d) => d.section === section);
  const isOwner = canDelete(me?.roles ?? []);

  const save = useMutation({
    mutationFn: async (d: Partial<Doc>) => {
      if (d.id) {
        const { error } = await supabase.from("knowledge_docs").update({ title: d.title, body: d.body, scope: d.scope }).eq("id", d.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("knowledge_docs").insert({ section, title: d.title ?? "Nuevo documento", body: d.body ?? "", scope: d.scope ?? (section === "skills" ? "personal" : "team") }).select().single();
        if (error) throw error;
        setSelected(data as Doc);
        revealOnMobile(editorRef.current);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs"] }); toast.success("Guardado."); },
    onError: (e: Error) => toast.error(errorText(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("knowledge_docs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["docs"] }); },
  });

  return (
    <Page eyebrow="Una sola fuente de verdad" title="Conocimiento">
      <div className="grid gap-6 lg:grid-cols-[220px_280px_1fr]">
        {/* Phones: sections as a horizontal chip row; a column from lg. */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => { setSection(id); setSelected(null); }} className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm lg:block lg:w-full lg:whitespace-normal lg:border-0 ${section === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {label} <span className="ml-1 font-mono text-xs opacity-60 lg:float-right lg:ml-0">{docs.filter((d) => d.section === id).length}</span>
            </button>
          ))}
        </nav>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{SECTIONS.find((s) => s[0] === section)?.[2]}</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => save.mutate({})}>+ Nuevo</Button>
          {list.map((d) => (
            <button key={d.id} onClick={() => { setSelected(d); revealOnMobile(editorRef.current); }} className={`block w-full min-w-0 break-words rounded-md border p-3 text-left text-sm ${selected?.id === d.id ? "border-signal bg-card" : "bg-card/50 hover:bg-card"}`}>
              <span className="font-medium">{d.title}</span>
              {d.scope === "personal" && <span className="ml-2 rounded bg-accent px-1.5 font-mono text-[10px] uppercase">personal</span>}
            </button>
          ))}
          {list.length === 0 && <Empty>Sin documentos todavía. Crea el primero con «+ Nuevo».</Empty>}
        </div>
        <div ref={editorRef} className="min-w-0 scroll-mt-20">
          {selected ? (
            <Editor key={selected.id} doc={selected} isOwner={isOwner} onSave={(d) => save.mutate(d)} onDelete={() => del.mutate(selected.id)} />
          ) : (
            <Empty>Selecciona o crea un documento.</Empty>
          )}
        </div>
      </div>
    </Page>
  );
}

function Editor({ doc, isOwner, onSave, onDelete }: { doc: Doc; isOwner: boolean; onSave: (d: Partial<Doc>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-display text-2xl" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} className="font-mono text-base md:text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onSave({ id: doc.id, title, body, scope: doc.scope })}>Guardar</Button>
        {doc.section === "skills" && doc.scope === "personal" && isOwner && (
          <Button variant="outline" onClick={() => onSave({ id: doc.id, title, body, scope: "team" })}>Promover a equipo</Button>
        )}
        {isOwner && <Button variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>Eliminar</Button>}
      </div>
    </div>
  );
}
