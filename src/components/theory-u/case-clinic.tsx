import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty, ScreenState } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CASE_CLINIC_STEPS } from "@/lib/theory-u";
import { errorText } from "@/lib/errors";
import { DateField } from "@/components/date-field";
import { ExplanationFold } from "@/components/explanation-fold";

// Below lg the list/editor stack, so bring the editor into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

export function CaseClinics() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<any | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isSuccess, error, refetch } = useQuery({
    queryKey: ["case_clinics"],
    queryFn: async () => {
      const [c, d] = await Promise.all([
        supabase
          .from("case_clinics")
          .select("*, deals(name)")
          .order("held_on", { ascending: false }),
        supabase
          .from("deals")
          .select("id,name,stage")
          .not("stage", "in", "(won,lost)")
          .order("name"),
      ]);
      const failed = c.error ?? d.error;
      if (failed) throw failed;
      return { clinics: c.data ?? [], deals: d.data ?? [] };
    },
  });
  const list = data?.clinics ?? [];

  async function add() {
    const { data: row, error } = await supabase
      .from("case_clinics")
      .insert({ title: "Nueva clínica de casos" })
      .select("*, deals(name)")
      .single();
    if (error) return toast.error(errorText(error));
    setSel(row);
    qc.invalidateQueries({ queryKey: ["case_clinics"] });
    revealOnMobile(editorRef.current);
  }
  async function save(extra: Record<string, unknown> = {}) {
    const {
      id,
      deals: _d,
      org_id: _o,
      created_at: _c,
      updated_at: _u,
      created_by: _cb,
      updated_by: _ub,
      ...rest
    } = sel;
    const payload = { ...rest, deal_id: rest.deal_id || null, ...extra };
    const { error } = await supabase.from("case_clinics").update(payload).eq("id", id);
    if (error) return toast.error(errorText(error));
    setSel({ ...sel, ...extra });
    toast.success("Clínica de casos guardada.");
    qc.invalidateQueries({ queryKey: ["case_clinics"] });
  }

  return (
    <div className="space-y-4">
      <ExplanationFold kind="metodo" className="max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Coaching entre pares de Theory U (~45 min). Un vendedor (case giver) trae un deal atascado
          o un reto propio; 3–4 compañeros escuchan, guardan silencio y devuelven espejos antes de
          dialogar. No se dan consejos de manual: se buscan nuevas formas de ver la situación.
        </p>
      </ExplanationFold>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <Button size="sm" className="w-full" onClick={add}>
            + Nueva clínica de casos
          </Button>
          <ScreenState isPending={isPending} error={error} refetch={refetch}>
            {isSuccess && list.length === 0 && (
              <Empty>
                Aún no hay clínicas de casos. Crea la primera con «+ Nueva clínica de casos».
              </Empty>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSel(c);
                  revealOnMobile(editorRef.current);
                }}
                className={`block w-full min-w-0 break-words rounded-md border bg-card p-3 text-left text-sm ${sel?.id === c.id ? "border-signal" : ""}`}
              >
                <span className="font-medium">{c.title}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {new Date(c.held_on).toLocaleDateString("es-ES")} ·{" "}
                  {c.status === "closed" ? "Cerrado" : "Abierto"}
                  {c.deals?.name ? ` · ${c.deals.name}` : ""}
                </span>
              </button>
            ))}
          </ScreenState>
        </div>
        <div ref={editorRef} className="min-w-0 scroll-mt-20">
          {sel ? (
            <div className="space-y-4 rounded-lg border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Título">
                  <Input
                    value={sel.title}
                    onChange={(e) => setSel({ ...sel, title: e.target.value })}
                  />
                </Field>
                <Field label="Fecha">
                  <DateField
                    value={sel.held_on}
                    onChange={(iso) => iso && setSel({ ...sel, held_on: iso })}
                  />
                </Field>
                <Field label="Deal">
                  <Pick
                    value={sel.deal_id ?? ""}
                    options={Object.fromEntries([
                      ["", "—"],
                      ...(data?.deals ?? []).map((d) => [d.id, d.name]),
                    ])}
                    onChange={(v) => setSel({ ...sel, deal_id: v })}
                  />
                </Field>
                <Field label="Estado">
                  <Pick
                    value={sel.status}
                    options={{ open: "Abierto", closed: "Cerrado" }}
                    onChange={(v) => setSel({ ...sel, status: v })}
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Case giver">
                  <Input
                    value={sel.case_giver}
                    onChange={(e) => setSel({ ...sel, case_giver: e.target.value })}
                  />
                </Field>
                <Field label="Coaches">
                  <Input
                    value={sel.coaches}
                    placeholder="Nombres separados por comas"
                    onChange={(e) => setSel({ ...sel, coaches: e.target.value })}
                  />
                </Field>
              </div>
              {CASE_CLINIC_STEPS.map((s) => (
                <Field key={s.key} label={`${s.label}${s.minutes ? ` · ${s.minutes} min` : ""}`}>
                  <p className="-mt-0.5 mb-1 text-xs text-muted-foreground">{s.help}</p>
                  <Textarea
                    rows={s.key === "dialogue" ? 5 : 2}
                    value={sel[s.key] ?? ""}
                    onChange={(e) => setSel({ ...sel, [s.key]: e.target.value })}
                  />
                </Field>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save()}>Guardar</Button>
                {sel.status !== "closed" && (
                  <Button variant="outline" onClick={() => save({ status: "closed" })}>
                    Guardar y cerrar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Empty>Selecciona o crea una clínica de casos.</Empty>
          )}
        </div>
      </div>
    </div>
  );
}
