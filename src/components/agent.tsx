import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, Check, Loader2, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideAgentAction, sendAgentMessage } from "@/lib/agent.functions";
import { getPersona, personasFor } from "@/lib/bmad/personas";
import { getWorkflow } from "@/lib/bmad/workflows";

type Mode = "chat" | "interview";
type Action = { id: string; summary: string; status: string; result?: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; actions?: Action[] };

type OpenOpts = { mode?: Mode; prompt?: string; personaId?: string | null; workflowId?: string | null };
const Ctx = createContext<{ open: (o?: OpenOpts) => void }>({ open: () => {} });
export const useAgent = () => useContext(Ctx);

const STARTERS = ["¿Qué debería hacer hoy?", "¿Cómo va la cobertura del trimestre?", "Deals en riesgo y por qué", "Crea una tarea para llamar a…"];

export function AgentProvider({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const qc = useQueryClient();
  const send = useServerFn(sendAgentMessage);
  const decide = useServerFn(decideAgentAction);
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const persona = getPersona(personaId);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const loadedFor = useRef<string | null>(null);

  // Restore the latest app conversation of this org once.
  useEffect(() => {
    if (!isOpen || !orgId || loadedFor.current === orgId) return;
    loadedFor.current = orgId;
    (async () => {
      const { data: conv } = await supabase.from("agent_conversations").select("id,mode").eq("org_id", orgId).eq("channel", "app").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!conv) return;
      const [{ data: m }, { data: a }] = await Promise.all([
        supabase.from("agent_messages").select("id,role,content,created_at").eq("conversation_id", conv.id).order("created_at").limit(60),
        supabase.from("agent_pending_actions").select("id,summary,status,result,created_at").eq("conversation_id", conv.id).eq("status", "pending"),
      ]);
      setConvId(conv.id); setMode(conv.mode as Mode);
      const list: Msg[] = (m ?? []).map((x) => ({ id: x.id, role: x.role as Msg["role"], content: x.content }));
      if (a?.length && list.length) list[list.length - 1] = { ...list[list.length - 1], actions: a };
      setMsgs(list);
    })();
  }, [isOpen, orgId]);

  useEffect(() => { setConvId(null); setMsgs([]); loadedFor.current = null; }, [orgId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const submit = useCallback(async (value: string, m: Mode, conv: string | null, pid: string | null = personaId, wid: string | null = workflowId) => {
    const t = value.trim();
    if (!t || busy) return;
    setText(""); setBusy(true);
    setMsgs((x) => [...x, { id: `u${Date.now()}`, role: "user", content: t }]);
    try {
      const r = await send({ data: { conversationId: conv, text: t, mode: m, personaId: pid, workflowId: wid } });
      setConvId(r.conversationId);
      setMsgs((x) => [...x, { id: `a${Date.now()}`, role: "assistant", content: r.text, actions: r.pending }]);
    } catch (e) {
      toast.error((e as Error).message);
      setText(t);
      setMsgs((x) => x.slice(0, -1));
    } finally { setBusy(false); }
  }, [busy, send, personaId, workflowId]);

  const open = useCallback((o?: OpenOpts) => {
    setOpen(true);
    const switchPersona = o?.personaId !== undefined && o.personaId !== personaId;
    const reset = (o?.mode && o.mode !== mode) || switchPersona;
    if (o?.mode) setMode(o.mode);
    if (o?.personaId !== undefined) setPersonaId(o.personaId);
    if (o?.workflowId !== undefined) setWorkflowId(o.workflowId);
    if (reset) { setConvId(null); setMsgs([]); loadedFor.current = orgId ?? null; }
    if (o?.prompt) setTimeout(() => submit(o.prompt!, o.mode ?? mode, reset ? null : convId, o.personaId !== undefined ? o.personaId : personaId, o.workflowId !== undefined ? o.workflowId : workflowId), 0);
  }, [mode, convId, orgId, submit, personaId, workflowId]);

  function pickPersona(id: string | null) { setPersonaId(id); setWorkflowId(null); setConvId(null); setMsgs([]); setMode("chat"); }
  function runCode(code: string) {
    const item = persona?.menu.find((m) => m.code === code);
    if (!item) return;
    setWorkflowId(item.workflow);
    submit(`${item.code} · ${item.label}`, "chat", convId, personaId, item.workflow);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function onDecide(msgId: string, a: Action, decision: "confirm" | "cancel") {
    try {
      const r = await decide({ data: { id: a.id, decision } });
      setMsgs((x) => x.map((m) => m.id !== msgId ? m : { ...m, actions: m.actions?.map((y) => y.id === a.id ? { ...y, status: r.status, result: r.result } : y) }));
      if (r.status === "failed") toast.error(r.result || "No se pudo ejecutar");
      if (r.status === "confirmed") qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
  }

  function newChat() { setConvId(null); setMsgs([]); setMode("chat"); setWorkflowId(null); }

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {orgId && (
        <button onClick={() => setOpen(true)} aria-label="Abrir agente GTM" className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg hover:opacity-90">
          <Brain className="size-4" /> Agente <kbd className="rounded bg-primary-foreground/15 px-1.5 font-mono text-[10px]">⌘J</kbd>
        </button>
      )}
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="flex items-center gap-2 font-display text-2xl"><Brain className="size-5" /> {persona ? `${persona.name} · ${persona.title}` : "Agente GTM"} {mode === "interview" && <span className="rounded bg-accent px-2 py-0.5 font-sans text-xs">Entrevista de configuración</span>}</SheetTitle>
              <Button variant="ghost" size="sm" onClick={newChat}><Plus className="size-4" /> Nueva</Button>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => pickPersona(null)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${!personaId ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>NOKKO</button>
              {personasFor(me?.roles ?? []).map((p) => (
                <button key={p.id} title={`${p.title} · inspirado en ${p.inspiredBy}`} onClick={() => pickPersona(p.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${personaId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{p.name}</button>
              ))}
            </div>
            {persona && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {persona.menu.map((m) => (
                  <button key={m.code} onClick={() => runCode(m.code)} disabled={busy} className={`rounded border px-2 py-1 text-xs hover:bg-accent ${workflowId === m.workflow ? "border-primary" : ""}`}><span className="font-mono font-semibold">{m.code}</span> {m.label}</button>
                ))}
              </div>
            )}
            {workflowId && <p className="mt-1 text-xs text-muted-foreground">Flujo activo: {getWorkflow(workflowId)?.label}</p>}
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {msgs.length === 0 && !busy && (
              <div className="space-y-3 pt-6">
                <p className="text-sm text-muted-foreground">{persona ? `${persona.focus} Elige un código del menú o pregúntame directamente.` : null}</p>
                <p className="text-sm text-muted-foreground">Pregúntame por tu pipeline, métricas o cuentas, o pídeme que haga algo. Antes de cambiar datos te pediré confirmación.</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => <button key={s} onClick={() => s.endsWith("…") ? setText(s.replace("…", " ")) : submit(s, mode, convId)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent">{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user"
                  ? <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.content}</div>
                  : <div className="space-y-2 text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{m.content}</ReactMarkdown>
                      {m.actions?.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                          <span className="text-sm">{a.summary}</span>
                          {a.status === "pending" ? (
                            <span className="flex shrink-0 gap-1.5">
                              <Button size="sm" onClick={() => onDecide(m.id, a, "confirm")}><Check className="size-3.5" /> Confirmar</Button>
                              <Button size="sm" variant="ghost" onClick={() => onDecide(m.id, a, "cancel")}><X className="size-3.5" /></Button>
                            </span>
                          ) : <span className={`shrink-0 text-xs ${a.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{a.status === "confirmed" ? "Hecho" : a.status === "cancelled" ? "Cancelado" : a.result || "Error"}</span>}
                        </div>
                      ))}
                    </div>}
              </div>
            ))}
            {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Pensando…</p>}
            <div ref={endRef} />
          </div>
          <form className="flex items-end gap-2 border-t p-4" onSubmit={(e) => { e.preventDefault(); submit(text, mode, convId); }}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={mode === "interview" ? "Responde o di «sí» para aceptar la propuesta…" : "Pregunta o pide una acción…"} className="min-h-[44px] resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text, mode, convId); } }} />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Enviar"><Send className="size-4" /></Button>
          </form>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}

const MD = {
  p: (p: any) => <p className="mb-2 last:mb-0" {...p} />,
  ul: (p: any) => <ul className="mb-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...p} />,
  strong: (p: any) => <strong className="font-semibold" {...p} />,
  h1: (p: any) => <h3 className="mb-1 mt-3 font-display text-lg" {...p} />,
  h2: (p: any) => <h3 className="mb-1 mt-3 font-display text-lg" {...p} />,
  h3: (p: any) => <h4 className="mb-1 mt-2 font-medium" {...p} />,
  table: (p: any) => <div className="overflow-x-auto"><table className="my-2 w-full text-xs" {...p} /></div>,
  th: (p: any) => <th className="border-b px-2 py-1 text-left font-medium" {...p} />,
  td: (p: any) => <td className="border-b px-2 py-1" {...p} />,
  code: (p: any) => <code className="rounded bg-muted px-1 font-mono text-xs" {...p} />,
  a: (p: any) => <a className="underline" {...p} />,
};
