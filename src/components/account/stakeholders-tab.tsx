import { EntityCombobox, usePeopleOptions } from "@/components/entity-combobox";
import { duplicateOf } from "@/lib/match";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JobProgress, useJob } from "@/components/background";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pick } from "@/components/fields";
import { BUYING_ROLES, SUPPORT } from "@/lib/roles";
import { errorText } from "@/lib/errors";
import { KeyPeopleButton } from "@/components/orchestrator";
import { ApolloReveal } from "@/components/apollo";
import { RoleCheck } from "@/components/linkedin";
import { askConfirm } from "@/components/confirm-dialog";
import type { Tables } from "@/integrations/supabase/types";
import { EmailVerificationMark, useEmailVerifications } from "@/components/email-verification";

type Stakeholder = Tables<"stakeholders">;

export function StakeholdersTab({
  accountId,
  hasDomain,
  list,
  onChange,
}: {
  accountId: string;
  hasDomain: boolean;
  list: Stakeholder[];
  onChange: () => void;
}) {
  const [sel, setSel] = useState<Stakeholder | null>(null);
  const verification = useEmailVerifications([...list.map((s) => s.email), sel?.email]);
  const detailRef = useRevealOnMobile(sel?.id);
  const stakeJob = useJob("stakeholder_research", {
    targetId: sel?.id ?? null,
    onDone: async (j) => {
      const id = j.input?.stakeholderId as string | undefined;
      const { data } = id
        ? await supabase.from("stakeholders").select("research").eq("id", id).maybeSingle()
        : { data: null };
      if (data) setSel((cur) => (cur && cur.id === id ? { ...cur, research: data.research } : cur));
      onChange();
    },
  });
  async function add(person: {
    name: string;
    title?: string | null;
    email?: string | null;
    linkedin_url?: string | null;
  }) {
    const { data, error } = await supabase
      .from("stakeholders")
      .insert({
        account_id: accountId,
        name: person.name,
        title: person.title ?? null,
        email: person.email ?? null,
        linkedin_url: person.linkedin_url ?? null,
      })
      .select()
      .single();
    if (error) return toast.error(errorText(error));
    setSel(data);
    onChange();
  }
  async function save() {
    if (!sel) return;
    const {
      id,
      name,
      title,
      email,
      phone,
      linkedin_url,
      buying_role,
      support,
      priorities,
      reports_to,
    } = sel;
    const { error } = await supabase
      .from("stakeholders")
      .update({
        name,
        title,
        email,
        phone: phone || null,
        linkedin_url,
        buying_role,
        support,
        priorities,
        reports_to: reports_to || null,
      })
      .eq("id", id);
    if (error) return toast.error(errorText(error));
    toast.success("Guardado.");
    onChange();
  }
  const roots = list.filter((s) => !s.reports_to || !list.find((x) => x.id === s.reports_to));
  const children = (pid: string) => list.filter((s) => s.reports_to === pid);
  const Node = ({ s }: { s: Stakeholder }) => (
    <li className="ml-2 border-l pl-2 sm:ml-4 sm:pl-4">
      <button
        onClick={() => setSel(s)}
        className={`my-1 max-w-full break-words rounded-md border bg-card px-3 py-2 text-left text-sm ${sel?.id === s.id ? "border-signal" : ""}`}
      >
        <span className="font-medium">{s.name}</span>{" "}
        <span className="text-muted-foreground">· {s.title}</span>
        <span className="mt-1 flex flex-wrap gap-1.5 font-mono text-xs uppercase">
          <span className="rounded bg-accent px-1">
            {BUYING_ROLES[s.buying_role ?? ""] ?? s.buying_role}
          </span>
          <span
            className={`rounded px-1 ${s.support === "advocate" ? "bg-success/15 text-success" : s.support === "opponent" || s.support === "skeptic" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}
          >
            {SUPPORT[s.support ?? ""] ?? s.support}
          </span>
        </span>
      </button>
      {children(s.id).length > 0 && (
        <ul>
          {children(s.id).map((c) => (
            <Node key={c.id} s={c} />
          ))}
        </ul>
      )}
    </li>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl">Mapa de poder</h3>
          <div className="flex flex-wrap gap-2">
            <KeyPeopleButton accountId={accountId} hasDomain={hasDomain} onAdded={onChange} />
            <AddStakeholder list={list} onAdd={add} onOpen={setSel} />
          </div>
        </div>
        {list.length === 0 ? (
          <Empty>Añade a las personas involucradas en la compra.</Empty>
        ) : (
          <ul className="-ml-2 sm:-ml-4">
            {roots.map((s) => (
              <Node key={s.id} s={s} />
            ))}
          </ul>
        )}
      </div>
      {sel ? (
        <div ref={detailRef} className="scroll-mt-20 space-y-3 rounded-lg border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={sel.name ?? ""}
                onChange={(e) => setSel({ ...sel, name: e.target.value })}
              />
            </Field>
            <Field label="Cargo">
              <Input
                value={sel.title ?? ""}
                onChange={(e) => setSel({ ...sel, title: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                value={sel.email ?? ""}
                onChange={(e) => setSel({ ...sel, email: e.target.value })}
              />
              <EmailVerificationMark
                email={sel.email}
                rows={verification.data}
                error={verification.error}
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={sel.phone ?? ""}
                onChange={(e) => setSel({ ...sel, phone: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                value={sel.linkedin_url ?? ""}
                onChange={(e) => setSel({ ...sel, linkedin_url: e.target.value })}
              />
            </Field>
            <Field label="Rol en la compra">
              <Pick
                value={sel.buying_role ?? ""}
                options={BUYING_ROLES}
                onChange={(v) => setSel({ ...sel, buying_role: v })}
              />
            </Field>
            <Field label="Nivel de apoyo">
              <Pick
                value={sel.support ?? ""}
                options={SUPPORT}
                onChange={(v) => setSel({ ...sel, support: v })}
              />
            </Field>
            <Field label="Reporta a">
              <Pick
                value={sel.reports_to ?? ""}
                options={Object.fromEntries([
                  ["", "—"],
                  ...list.filter((x) => x.id !== sel.id).map((x) => [x.id, x.name]),
                ])}
                onChange={(v) => setSel({ ...sel, reports_to: v })}
              />
            </Field>
          </div>
          <RoleCheck
            key={sel.id}
            stakeholderId={sel.id}
            hasLinkedin={!!sel.linkedin_url?.trim()}
            onUseTitle={(title) =>
              setSel((cur) => (cur && cur.id === sel.id ? { ...cur, title } : cur))
            }
          />
          <ApolloReveal
            stakeholderId={sel.id}
            hasEmail={!!sel.email?.trim()}
            onChange={async () => {
              const { data: fresh } = await supabase
                .from("stakeholders")
                .select("email,phone,linkedin_url,title")
                .eq("id", sel.id)
                .single();
              if (fresh)
                setSel((cur) =>
                  cur && cur.id === sel.id
                    ? {
                        ...cur,
                        ...Object.fromEntries(
                          Object.entries(fresh).filter(([k]) => !cur[k as keyof Stakeholder]),
                        ),
                      }
                    : cur,
                );
              onChange();
            }}
          />
          <Field label="Prioridades y notas">
            <Textarea
              rows={3}
              value={sel.priorities ?? ""}
              onChange={(e) => setSel({ ...sel, priorities: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Guardar</Button>
            {stakeJob.running ? (
              <JobProgress job={stakeJob.job} onCancel={stakeJob.cancel} />
            ) : (
              <Button
                variant="outline"
                onClick={() => stakeJob.start({ stakeholderId: sel.id }, `Research de ${sel.name}`)}
              >
                Research con IA
              </Button>
            )}
          </div>
          {sel.research && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-sans text-sm">
              {sel.research}
            </pre>
          )}
        </div>
      ) : (
        <Empty>Selecciona una persona del mapa.</Empty>
      )}
    </div>
  );
}

export function useRevealOnMobile(key: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!key || !ref.current || !window.matchMedia("(max-width: 1023px)").matches) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key]);
  return ref;
}

/** «+ Persona» in the power map: asks for the name first and suggests people already in Personas or in this map. */
export function AddStakeholder({
  list,
  onAdd,
  onOpen,
}: {
  list: Stakeholder[];
  onAdd: (p: {
    name: string;
    title?: string | null;
    email?: string | null;
    linkedin_url?: string | null;
  }) => Promise<unknown>;
  onOpen: (s: Stakeholder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { data: people = [] } = usePeopleOptions(open);
  const inMap = list.map((s) => ({
    id: `s:${s.id}`,
    name: s.name,
    sub: `Ya en este mapa${s.title ? ` · ${s.title}` : ""}`,
    email: s.email,
  }));
  const items = [...inMap, ...people.map((p) => ({ ...p, id: `p:${p.id}` }))];
  async function save() {
    const n = name.trim();
    if (!n) return;
    if (pickedId?.startsWith("s:")) {
      const hit = list.find((s) => `s:${s.id}` === pickedId);
      if (hit) onOpen(hit);
      setOpen(false);
      return;
    }
    const sameInMap = duplicateOf({ name: n }, inMap);
    if (
      !pickedId &&
      sameInMap?.kind === "same" &&
      !(await askConfirm(`«${sameInMap.item.name}» ya está en este mapa`, {
        body: "¿Añadirla otra vez como stakeholder?",
        confirmLabel: "Añadir igualmente",
      }))
    )
      return;
    const person = pickedId ? people.find((p) => `p:${p.id}` === pickedId) : null;
    await onAdd(
      person
        ? {
            name: person.name,
            title: person.title,
            email: person.email,
            linkedin_url: person.linkedin_url,
          }
        : { name: n },
    );
    setName("");
    setPickedId(null);
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Persona</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir persona al mapa</DialogTitle>
        </DialogHeader>
        <EntityCombobox
          items={items}
          value={name}
          selectedId={pickedId}
          onChange={(t, p) => {
            setName(t);
            setPickedId(p?.id ?? null);
          }}
          placeholder="Nombre (busca en Personas)"
          noun="persona nueva"
          autoFocus
          ariaLabel="Nombre"
        />
        <Button disabled={!name.trim()} onClick={save}>
          {pickedId?.startsWith("s:") ? "Abrir la existente" : "Añadir"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
