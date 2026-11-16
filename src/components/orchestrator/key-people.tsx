import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { JobProgress, useJob, type BgJob } from "@/components/background";
import { freshResult } from "@/lib/jobs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/fields";
import { orchestrateRevealPeople, type orchestrateKeyPeople } from "@/lib/orchestrator.functions";
import { DEFAULT_LEVELS, LEVELS, LEVEL_LABEL, type Level } from "@/lib/orchestrator/search";
import { MAX_REVEAL } from "@/lib/apollo";
import { errorText } from "@/lib/errors";

// ---------------- «Buscar personas clave» (account map) ----------------

export type PeopleRes = Awaited<ReturnType<typeof orchestrateKeyPeople>>;
export type PeopleJob = { search?: PeopleRes; criteria?: { titles: string[]; levels: Level[] } };
export const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function KeyPeopleButton({
  accountId,
  hasDomain,
  onAdded,
}: {
  accountId: string;
  hasDomain: boolean;
  onAdded: () => void;
}) {
  const search = useSearch({ strict: false }) as { people?: string };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // From the notice («Encontré 4 personas clave…»): the link opens the results straight away.
  useEffect(() => {
    if (search.people) {
      setOpen(true);
      void navigate({
        to: ".",
        search: ((s: Record<string, unknown>) => ({ ...s, people: undefined })) as never,
        replace: true,
      });
    }
  }, [search.people]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasDomain}
          title={hasDomain ? undefined : "Añade el dominio de la cuenta para buscar personas"}
        >
          Buscar personas clave
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar personas clave</DialogTitle>
        </DialogHeader>
        {open && <KeyPeople accountId={accountId} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

export function KeyPeople({ accountId, onAdded }: { accountId: string; onAdded: () => void }) {
  const reveal = useServerFn(orchestrateRevealPeople);
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob<"key_people", PeopleJob>("key_people", {
    targetId: accountId,
    onDone: () => {
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
    },
  });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const done = freshResult<BgJob<PeopleJob>>(job, dismissed);
  const res = done?.result?.search ?? null;
  const [titles, setTitles] = useState("");
  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Map<string, string>>(new Map());
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  // The last search's criteria come back with its results.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!done || loaded.current === done.id) return;
    loaded.current = done.id;
    const c = done.result?.criteria;
    if (c) {
      setTitles(c.titles.join(", "));
      if (c.levels.length) setLevels(c.levels);
    }
  }, [done?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function run(more: boolean) {
    if (more && (!res?.cursor || !job)) return;
    void start({
      accountId,
      titles: splitList(titles),
      levels,
      cursor: more ? res!.cursor : null,
      ...(more ? { prevJobId: job!.id } : {}),
    });
  }

  async function add() {
    if (!res) return;
    const chosen = res.rows.filter((p) => picked.has(p.key));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const next = new Map(added);
      if (res.masked) {
        const r = await reveal({
          data: { accountId, apolloIds: chosen.map((p) => p.apolloId!), phone },
        });
        for (const x of r.people)
          next.set(
            x.contact.apolloId,
            x.contact.email
              ? `${x.contact.name} · ${x.contact.email}`
              : `${x.contact.name} · sin email`,
          );
        toast.success(
          `${r.people.length} ${r.people.length === 1 ? "persona añadida" : "personas añadidas"} al mapa. ${r.sources}.${phone ? " Los móviles llegan en unos minutos." : ""}`,
        );
      } else {
        const { error } = await supabase.from("stakeholders").insert(
          chosen.map((p) => ({
            account_id: accountId,
            name: p.name,
            title: p.title,
            linkedin_url: p.linkedin,
          })),
        );
        if (error) throw error;
        for (const p of chosen) next.set(p.key, `${p.name} · añadida`);
        toast.success(
          `${chosen.length} ${chosen.length === 1 ? "persona añadida" : "personas añadidas"} al mapa de poder.`,
        );
      }
      setAdded(next);
      setPicked(new Set());
      onAdded();
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const max = res?.masked ? MAX_REVEAL : 50;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Dime qué cargos buscas y Nokko elige la fuente: primero la gratuita y, si no encuentra a
        nadie, otra. Trabaja en segundo plano: puedes cerrar esta ventana y te aviso al terminar.
      </p>
      <Field label="Cargos">
        <Input
          value={titles}
          placeholder="Head of Sales, CFO, Operations"
          onChange={(e) => setTitles(e.target.value)}
        />
      </Field>
      <div>
        <p className="eyebrow mb-2">Nivel</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEVELS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={levels.includes(s)}
                onCheckedChange={(v) =>
                  setLevels(v ? [...levels, s] : levels.filter((x) => x !== s))
                }
              />
              {LEVEL_LABEL[s]}
            </label>
          ))}
        </div>
      </div>
      {running ? (
        <JobProgress job={job} onCancel={cancel} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)}>{res ? "Buscar de nuevo" : "Buscar personas"}</Button>
          {res && (
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setDismissed(done!.id)}
            >
              Limpiar resultados
            </button>
          )}
        </div>
      )}
      {!running && job?.status === "failed" && (
        <p className="text-sm text-muted-foreground">La última búsqueda falló: {job.error}</p>
      )}
      {res?.blocked && <p className="text-sm text-muted-foreground">{res.blocked}</p>}
      {res && !res.blocked && res.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay personas con esos criterios en esta empresa. Prueba con otros cargos.
        </p>
      )}
      {res && res.rows.length > 0 && (
        <div className="space-y-3">
          {res.masked && (
            <p className="text-xs text-muted-foreground">
              Esta fuente oculta el apellido y el contacto hasta añadir a la persona; añadirla
              cuesta unos 0,02 € por persona (máximo {MAX_REVEAL} a la vez).
            </p>
          )}
          <ul className="divide-y border-t">
            {res.rows.map((p) => {
              const done = added.get(p.key) ?? (p.existingId ? "Ya está en el mapa" : null);
              return (
                <li key={p.key} className="flex items-start gap-3 py-2 text-sm">
                  {!done ? (
                    <Checkbox
                      aria-label={`Elegir ${p.name}`}
                      className="mt-0.5"
                      disabled={!picked.has(p.key) && picked.size >= max}
                      checked={picked.has(p.key)}
                      onCheckedChange={(v) => {
                        const n = new Set(picked);
                        v ? n.add(p.key) : n.delete(p.key);
                        setPicked(n);
                      }}
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{done && added.has(p.key) ? done : p.name}</span>
                    {p.title && <span className="text-muted-foreground"> · {p.title}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {done ??
                        (res.masked ? (
                          [
                            p.hasEmail ? "tiene email" : "sin email conocido",
                            p.hasPhone ? "tiene teléfono" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        ) : (
                          <>
                            {p.location}
                            {p.linkedin && (
                              <>
                                {" "}
                                ·{" "}
                                <a
                                  href={p.linkedin}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  LinkedIn
                                </a>
                              </>
                            )}
                          </>
                        ))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="font-mono text-xs text-muted-foreground">{res.sources}</p>
          <div className="flex flex-wrap items-center gap-3">
            {res.cursor && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || running}
                onClick={() => run(true)}
              >
                Traer más
              </Button>
            )}
            {res.masked && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={phone} onCheckedChange={(v) => setPhone(!!v)} />
                Pedir también el móvil (cuesta más)
              </label>
            )}
            <Button disabled={busy || !picked.size} onClick={add}>
              Añadir {picked.size || ""} al mapa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
