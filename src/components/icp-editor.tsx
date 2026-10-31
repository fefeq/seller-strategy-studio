// ICP editor: the definition of a target account every Nokko flow reads (searches, key people,
// scoring, qualification, research). Structured search fields on top, prose for the AI below,
// and a live preview of what each flow will use.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { structureIcp } from "@/lib/ai.functions";
import {
  ICP_TRACKED,
  icpCompanyQuery,
  icpPeopleQuery,
  icpSaveSources,
  icpReadiness,
  icpSizeText,
  LEVEL_LABEL,
  splitList,
} from "@/lib/icp";
import { DEFAULT_LEVELS, LEVELS } from "@/lib/orchestrator/search";
import { isDirty } from "@/lib/field-actions";
import { DeleteElement } from "@/components/delete-element";
import { FieldActions } from "@/components/field-actions";
import { ConfirmBar } from "@/components/confirm-field";
import { confirmSources } from "@/lib/provenance";
import { useMe } from "@/hooks/use-me";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";

const PROSE = [
  ["industries", "Sectores o tipo de empresa", "Para el equipo y la puntuación de cuentas"],
  ["company_size", "Tamaño en palabras (facturación, etapa)", "Si no fijas empleados, se usa esto"],
  ["geography", "Geografía en palabras", "Regiones o ciudades"],
  ["tech_stack", "Stack tecnológico", "Herramientas que suelen usar"],
  ["growth_stage", "Etapa de crecimiento", ""],
  ["hiring_signals", "Señales de contratación", "Qué puestos abren cuando necesitan lo nuestro"],
  ["funding_signals", "Rondas o eventos", ""],
  ["adoption", "Adopción tecnológica", "Early adopters o tardíos"],
  [
    "pains",
    "Dolores que resolvemos",
    "La IA los usa para cualificar, investigar y preparar reuniones",
  ],
  ["why_fit", "Por qué encajan", "Cierran rápido, usan más, renuevan"],
  ["anti_icp", "Anti-ICP: a quién no venderle", "Descarta leads y resta puntuación"],
] as const;

const LIST_FIELDS = ["search_keywords", "countries", "target_titles"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the draft mixes DB row fields and comma text for lists; typing it is NK-0034 debt
type Draft = Record<string, any>;

export function IcpEditor() {
  const qc = useQueryClient();
  const structure = useServerFn(structureIcp);
  const [sel, setSel] = useState<Draft | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // What the AI offered in this edit (tracked fields only): saved as «ia», not confirmed, unless the person changes it (NK-0024).
  const proposedRef = useRef<Draft>({});
  const { data: me } = useMe();
  const [toDelete, setToDelete] = useState<{
    id: string;
    name: string;
    segment_id: string | null;
  } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const selId = sel?.id;
  useEffect(() => {
    proposedRef.current = {};
  }, [selId]);
  useEffect(() => {
    if (selId && typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches)
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selId]);
  const { data } = useQuery({
    queryKey: ["icp"],
    queryFn: async () => {
      const [i, s] = await Promise.all([
        supabase.from("icp_profiles").select("*").order("created_at"),
        supabase.from("segments").select("id,name"),
      ]);
      return { icps: i.data ?? [], segs: s.data ?? [] };
    },
  });

  // Lists are edited as comma text and saved as arrays.
  const pick = (row: Draft): Draft => ({
    ...row,
    ...Object.fromEntries(LIST_FIELDS.map((k) => [k, (row[k] ?? []).join(", ")])),
  });
  const asIcp = (d: Draft): Draft => ({
    ...d,
    ...Object.fromEntries(LIST_FIELDS.map((k) => [k, splitList(d[k] ?? "")])),
    min_employees: Number(d.min_employees) || null,
    max_employees: Number(d.max_employees) || null,
  });
  const set = (k: string, v: unknown) => setSel((s) => (s ? { ...s, [k]: v } : s));

  async function add() {
    const { data: r, error } = await supabase
      .from("icp_profiles")
      .insert({ name: "Nuevo ICP" })
      .select()
      .single();
    if (error) return toast.error(errorText(error));
    setSel(pick(r));
    qc.invalidateQueries({ queryKey: ["icp"] });
  }
  // CA-3: the draft lives in this screen until «Guardar ICP»; leaving with changes asks to save or discard.
  const cmp = (d: Draft | null) =>
    d &&
    Object.fromEntries(
      Object.entries(d)
        .filter(
          ([k]) =>
            ![
              "created_at",
              "updated_at",
              "created_by",
              "updated_by",
              "org_id",
              "field_sources",
            ].includes(k),
        )
        .map(([k, v]) => [
          k,
          (LIST_FIELDS as readonly string[]).includes(k)
            ? typeof v === "string"
              ? splitList(v)
              : (v ?? [])
            : typeof v === "number"
              ? String(v)
              : v,
        ]),
    );
  const savedRow = data?.icps.find((i: Draft) => i.id === sel?.id) as Draft | undefined;
  useUnsavedGuard(isDirty(cmp(savedRow ? pick(savedRow) : null), cmp(sel)), () => save());

  // CA-8 to CA-10: confirmation lives in field_sources (migration 0058, not applied yet): offered only once the row has it.
  const hasMarks = !!savedRow && "field_sources" in savedRow;
  const CONFIRMABLE = ["countries", "geography", "min_employees", "max_employees", "company_size"];
  const present = CONFIRMABLE.filter((k) => {
    const v = savedRow?.[k];
    return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "";
  });
  async function confirmFields(fields: string[]) {
    if (!savedRow || !me?.user.id) return;
    const field_sources = confirmSources(
      savedRow.field_sources,
      fields,
      me.user.id,
      new Date().toISOString(),
    );
    const { error } = await supabase
      .from("icp_profiles")
      .update({ field_sources: field_sources as unknown as Json })
      .eq("id", savedRow.id);
    if (error) return void toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["icp"] });
  }

  /** Returns false when the save failed, so leaving keeps the draft. */
  async function save(): Promise<boolean> {
    if (!sel) return true;
    const {
      id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      org_id,
      field_sources: _fs,
      ...rest
    } = asIcp(sel);
    try {
      // The marks are built from the row as it is now, so a confirmation made since opening it survives.
      const fresh = await confirmed(
        supabase
          .from("icp_profiles")
          .select(["field_sources", ...ICP_TRACKED].join(","))
          .eq("id", id)
          .single(),
      );
      const field_sources =
        "field_sources" in fresh
          ? icpSaveSources(
              fresh.field_sources,
              fresh as unknown as Draft,
              rest,
              proposedRef.current,
              me?.user.id,
              new Date().toISOString(),
            )
          : null;
      await confirmed(
        supabase
          .from("icp_profiles")
          .update({
            ...rest,
            segment_id: rest.segment_id || null,
            ...(field_sources ? { field_sources: field_sources as unknown as Json } : {}),
          })
          .eq("id", id)
          .select("id"),
      );
    } catch (e) {
      toast.error(errorText(e));
      return false;
    }
    proposedRef.current = {};
    toast.success("ICP guardado. Búsquedas, puntuación e IA ya lo usan.");
    qc.invalidateQueries({ queryKey: ["icp"] });
    qc.invalidateQueries({ queryKey: ["setup"] });
    qc.invalidateQueries({ queryKey: ["clay-icps"] });
    qc.invalidateQueries({ queryKey: ["recent-changes"] });
    return true;
  }
  async function refine() {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await structure({ data: { icp: asIcp(sel), note } });
      const filled = Object.entries(r).filter(([, v]) => (Array.isArray(v) ? v.length : v != null));
      if (!filled.length) {
        toast.message(
          "No hay base suficiente. Describe el cliente ideal en las notas o rellena sectores y geografía.",
        );
        return;
      }
      proposedRef.current = {
        ...proposedRef.current,
        ...Object.fromEntries(
          filled.filter(([k]) => (ICP_TRACKED as readonly string[]).includes(k)),
        ),
      };
      setSel((s) => s && pick({ ...asIcp(s), ...Object.fromEntries(filled) }));
      toast.success("Criterios propuestos. Revísalos y pulsa Guardar ICP.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const current = sel ? asIcp(sel) : null;
  const q = current ? icpCompanyQuery(current).query : null;
  const people = current ? icpPeopleQuery(current) : null;
  const levels: string[] = sel?.seniorities ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>
          + ICP
        </Button>
        {data?.icps.map((i) => (
          <button
            key={i.id}
            onClick={() => setSel(pick(i))}
            className={`block w-full break-words rounded-md border bg-card p-3 text-left text-sm ${sel?.id === i.id ? "border-signal" : ""}`}
          >
            {i.name}
            <span className="mt-1 block text-xs text-muted-foreground">
              {icpReadiness(i).filter((c) => c.ready).length} de 4 usos listos
            </span>
          </button>
        ))}
      </div>
      {sel && current && q && people ? (
        <div
          ref={detailRef}
          className="min-w-0 scroll-mt-20 space-y-6 rounded-lg border bg-card p-5"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre">
              <Input value={sel.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Segmento">
              <Pick
                value={sel.segment_id ?? ""}
                options={Object.fromEntries([
                  ["", "—"],
                  ...(data?.segs ?? []).map((s) => [s.id, s.name]),
                ])}
                onChange={(v) => set("segment_id", v)}
              />
            </Field>
          </div>

          <section className="space-y-3">
            <p className="eyebrow">Afinar con IA</p>
            <Textarea
              rows={2}
              placeholder="Opcional: describe tu cliente ideal o pega notas de tus mejores clientes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={refine} disabled={busy}>
              {busy ? "Proponiendo…" : "Proponer criterios de búsqueda"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Rellena palabras clave, países, empleados, cargos, niveles y dolores a partir de lo
              escrito. Nada se guarda hasta que pulses Guardar ICP.
            </p>
          </section>

          <section>
            <p className="eyebrow mb-2">
              Criterios de búsqueda · para Apollo, Clay, Parallel y Descubiertos
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Palabras clave en inglés (como en LinkedIn)">
                <Input
                  placeholder="saas, b2b software, marketing agency"
                  value={sel.search_keywords}
                  onChange={(e) => set("search_keywords", e.target.value)}
                />
              </Field>
              <Field label="Países (código de 2 letras)">
                <Input
                  placeholder="ES, MX, CO"
                  value={sel.countries}
                  onChange={(e) => set("countries", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Empleados desde">
                <Input
                  inputMode="numeric"
                  value={sel.min_employees ?? ""}
                  onChange={(e) => set("min_employees", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Empleados hasta">
                <Input
                  inputMode="numeric"
                  value={sel.max_employees ?? ""}
                  onChange={(e) => set("max_employees", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
            </div>
          </section>

          <section>
            <p className="eyebrow mb-2">A quién buscar dentro · personas clave</p>
            <Field label="Cargos en inglés">
              <Input
                placeholder="VP Sales, Head of RevOps, CRO"
                value={sel.target_titles}
                onChange={(e) => set("target_titles", e.target.value)}
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Niveles">
              {LEVELS.map((l) => {
                const on = levels.includes(l);
                return (
                  <Button
                    key={l}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() =>
                      set("seniorities", on ? levels.filter((x) => x !== l) : [...levels, l])
                    }
                  >
                    {LEVEL_LABEL[l]}
                  </Button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="eyebrow mb-2">Contexto para la puntuación y la IA</p>
            <div className="grid gap-3 md:grid-cols-2">
              {PROSE.map(([k, label, hint]) => (
                <Field key={k} label={label}>
                  <Textarea
                    rows={2}
                    value={sel[k] ?? ""}
                    onChange={(e) => set(k, e.target.value)}
                  />
                  {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
                </Field>
              ))}
            </div>
          </section>

          <section className="border-t pt-4">
            <p className="eyebrow mb-3">Qué usará cada flujo</p>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Búsqueda de empresas</dt>
                <dd className="font-mono text-xs">
                  {[
                    q.keywords?.join(", ") || "sin palabras clave",
                    q.countries?.join(", ") || "todos los países",
                    icpSizeText({ min_employees: q.minEmployees, max_employees: q.maxEmployees }) ??
                      "cualquier tamaño",
                  ].join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Personas clave</dt>
                <dd className="font-mono text-xs">
                  {(people.titles ?? ["cualquier cargo"]).join(", ")} ·{" "}
                  {(people.levels ?? DEFAULT_LEVELS).map((l) => LEVEL_LABEL[l]).join(", ")}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1 text-sm">
              {icpReadiness(current).map((c) => (
                <li key={c.id}>
                  <span className={c.ready ? "" : "text-muted-foreground"}>
                    {c.ready ? "Listo" : "Incompleto"}
                  </span>{" "}
                  · {c.label}
                  {c.missing && (
                    <span className="text-muted-foreground"> — falta: {c.missing}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save}>Guardar ICP</Button>
            <FieldActions
              kind="icp"
              roles={me?.roles ?? []}
              handlers={{
                delete: () =>
                  setToDelete({
                    id: sel.id,
                    name: sel.name || "Sin nombre",
                    segment_id: sel.segment_id || null,
                  }),
              }}
            />
            <ConfirmBar
              fields={present}
              marks={savedRow?.field_sources}
              enabled={hasMarks}
              onConfirm={confirmFields}
            />
          </div>
          <DeleteElement
            kind="icp"
            target={toDelete}
            onClose={() => setToDelete(null)}
            onDone={() => {
              setSel(null);
              qc.invalidateQueries({ queryKey: ["icp"] });
            }}
          />
        </div>
      ) : (
        <Empty>
          Define tu ICP analizando a tus mejores clientes: quién cierra más rápido, usa más el
          producto y renueva. Nokko lo usa para buscar empresas y personas, puntuar cuentas y leads,
          y preparar cada investigación.
        </Empty>
      )}
    </div>
  );
}
