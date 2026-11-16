import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useTeam, type TeamMember } from "@/hooks/use-team";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/fields";
import { ROLES, type Role } from "@/lib/roles";
import { errorText } from "@/lib/errors";
import {
  COUNTRY_CODES,
  REGIONS,
  canApproveAssignment,
  countryName,
  isEligible,
  proposeAssignment,
  ruleLabel,
  tierWeight,
  validateAssignment,
  type AssignAccount,
  type AssignRule,
  type ProposalRow,
  type Region,
  type Unassigned,
} from "@/lib/assignment";
import { explainAssignment, proposeAssignmentRules } from "@/lib/assignment.functions";

export const Route = createFileRoute("/_authenticated/accounts/assignment")({
  head: () => ({
    meta: [
      { title: "Reparto de cuentas — Nokko" },
      {
        name: "description",
        content: "Reglas, propuesta y aprobación del reparto de cuentas sin responsable.",
      },
      { property: "og:title", content: "Reparto de cuentas — Nokko" },
      {
        property: "og:description",
        content: "Reglas, propuesta y aprobación del reparto de cuentas sin responsable.",
      },
    ],
  }),
  component: Assignment,
});

type DraftRule = Omit<AssignRule, "id" | "position"> & {
  id: string | null;
  key: string;
  why?: string;
};
type Row = ProposalRow & { include: boolean; why?: string; edited?: boolean };

// One select for «where»: any place, a region or a country.
const PLACE_OPTIONS: Record<string, string> = {
  "": "Cualquier lugar",
  ...Object.fromEntries(Object.entries(REGIONS).map(([k, v]) => [`r:${k}`, `Región: ${v}`])),
  ...Object.fromEntries(COUNTRY_CODES.map((c) => [`c:${c}`, `País: ${countryName(c)}`])),
};
const placeValue = (r: Pick<DraftRule, "region" | "country">) =>
  r.country ? `c:${r.country}` : r.region ? `r:${r.region}` : "";
const placeFrom = (v: string) => ({
  region: v.startsWith("r:") ? (v.slice(2) as Region) : null,
  country: v.startsWith("c:") ? v.slice(2) : null,
});
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function Assignment() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const leader = canApproveAssignment(me?.roles ?? []);
  const isOwner = me?.roles.includes("owner") ?? false;
  const { data: team = [] } = useTeam();
  const { data } = useQuery({
    queryKey: ["assignment"],
    enabled: leader,
    queryFn: async () => {
      const [a, s, r] = await Promise.all([
        supabase.from("accounts").select("id,name,tier,segment_id,country,owner_id").order("name"),
        supabase.from("segments").select("id,name").order("acv_min"),
        supabase.from("account_assignment_rules").select("*").order("position"),
      ]);
      return {
        accounts: (a.data ?? []) as AssignAccount[],
        segments: s.data ?? [],
        rules: r.data ?? [],
      };
    },
  });
  const segNames = useMemo(
    () => new Map((data?.segments ?? []).map((s) => [s.id, s.name])),
    [data?.segments],
  );
  const eligible = team.filter((m) => isEligible(m.role));
  const accounts = data?.accounts ?? [];
  const unowned = accounts.filter((a) => !a.owner_id);

  // Rules editor: starts from the saved rules; «Proponer reglas con IA» fills it without saving.
  const [rules, setRules] = useState<DraftRule[] | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  useEffect(() => {
    if (data && rules === null)
      setRules(
        data.rules.map((r) => ({
          id: r.id,
          key: newKey(),
          segment_id: r.segment_id,
          region: (r.region as Region) ?? null,
          country: r.country,
          members: r.members ?? [],
        })),
      );
  }, [data, rules]);
  const draft = rules ?? [];
  const dirtyRules =
    JSON.stringify(
      draft.map(({ id, segment_id, region, country, members }) => ({
        id,
        segment_id,
        region,
        country,
        members,
      })),
    ) !==
    JSON.stringify(
      (data?.rules ?? []).map((r) => ({
        id: r.id,
        segment_id: r.segment_id,
        region: r.region,
        country: r.country,
        members: r.members ?? [],
      })),
    );

  const proposeRules = useServerFn(proposeAssignmentRules);
  const explain = useServerFn(explainAssignment);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unassigned, setUnassigned] = useState<Unassigned[]>([]);

  const patchRule = (key: string, p: Partial<DraftRule>) =>
    setRules(draft.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const moveRule = (i: number, d: -1 | 1) => {
    const n = [...draft];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setRules(n);
  };

  async function aiRules() {
    setBusy("rules");
    try {
      const r = await proposeRules();
      if (!r.rules.length)
        toast.message("La IA no ve reglas útiles con estos datos.", {
          description: r.notes || undefined,
        });
      else setRules(r.rules.map((x) => ({ ...x, id: null, key: newKey() })));
      setAiNotes(r.notes);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveRules() {
    if (draft.some((r) => !r.members.length))
      return toast.error("Cada regla necesita al menos una persona.");
    setBusy("save");
    try {
      const keep = new Set(draft.filter((r) => r.id).map((r) => r.id));
      const removed = (data?.rules ?? []).filter((r) => !keep.has(r.id)).map((r) => r.id);
      for (const [i, r] of draft.entries()) {
        const row = {
          position: i + 1,
          segment_id: r.segment_id,
          region: r.region,
          country: r.country,
          members: r.members,
        };
        const { error } = r.id
          ? await supabase.from("account_assignment_rules").update(row).eq("id", r.id)
          : await supabase.from("account_assignment_rules").insert(row);
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await supabase
          .from("account_assignment_rules")
          .delete()
          .in("id", removed);
        if (error) throw error;
      }
      toast.success("Reglas guardadas.");
      setRules(null);
      await qc.invalidateQueries({ queryKey: ["assignment"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveMax(m: TeamMember, raw: string) {
    const v = raw.trim() === "" ? null : Math.max(0, Math.floor(Number(raw)));
    if (raw.trim() !== "" && !Number.isFinite(Number(raw)))
      return toast.error("El máximo tiene que ser un número.");
    if (v === m.max_accounts) return;
    const { error } = await supabase.from("org_members").update({ max_accounts: v }).eq("id", m.id);
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["team-members"] });
  }

  async function propose() {
    const p = proposeAssignment({
      accounts,
      members: team.map((m) => ({
        user_id: m.user_id,
        name: m.name,
        role: m.role,
        max_accounts: m.max_accounts,
      })),
      rules: draft.map((r, i) => ({
        id: r.id ?? r.key,
        position: i + 1,
        segment_id: r.segment_id,
        region: r.region,
        country: r.country,
        members: r.members,
      })),
      segNames,
    });
    const next: Row[] = p.rows.map((r) => ({ ...r, include: true }));
    setRows(next);
    setUnassigned(p.unassigned);
    if (!next.length) return;
    // The AI puts each computed reason into a plain line; if it fails, the computed reason stays.
    setBusy("explain");
    try {
      const byAcc = new Map(accounts.map((a) => [a.id, a]));
      const res = await explain({
        data: {
          rows: next.map((r) => {
            const a = byAcc.get(r.account_id)!;
            return {
              account_id: r.account_id,
              account: r.account,
              tier: r.tier,
              segment: a.segment_id ? (segNames.get(a.segment_id) ?? null) : null,
              country: a.country,
              person: team.find((m) => m.user_id === r.user_id)?.name ?? "",
              rule: r.rule,
              before_accounts: r.before.accounts,
              before_load: r.before.weight,
              candidates: r.candidates,
            };
          }),
        },
      });
      const why = new Map(res.lines.map((l) => [l.account_id, l.why]));
      setRows((cur) => cur?.map((r) => ({ ...r, why: why.get(r.account_id) })) ?? cur);
    } catch {
      /* the computed reason is enough */
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    const chosen = (rows ?? []).filter((r) => r.include);
    if (!chosen.length) return toast.error("No hay ninguna fila marcada.");
    const errors = validateAssignment(
      chosen,
      team.map((m) => ({
        user_id: m.user_id,
        name: m.name,
        role: m.role,
        max_accounts: m.max_accounts,
      })),
      accounts,
    );
    if (errors.length)
      return toast.error(errors[0], {
        description: errors.length > 1 ? `Y ${errors.length - 1} más.` : undefined,
      });
    setBusy("approve");
    try {
      const { data: r, error } = await supabase.rpc("apply_account_assignment", {
        _rows: chosen.map((x) => ({ account_id: x.account_id, user_id: x.user_id })),
      });
      if (error) throw error;
      const res = (r ?? {}) as { accounts?: number; deals?: number; leads?: number };
      toast.success(
        `Reparto aprobado: ${res.accounts ?? 0} cuentas, ${res.deals ?? 0} deals y ${res.leads ?? 0} leads abiertos con su nuevo responsable.`,
      );
      setRows(null);
      setUnassigned([]);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!leader)
    return (
      <Page eyebrow="Cuentas" title="Reparto de cuentas">
        <Empty>Solo el Owner y el Sales Leader preparan y aprueban el reparto de cuentas.</Empty>
      </Page>
    );

  const load = (id: string) => {
    const own = accounts.filter((a) => a.owner_id === id);
    return { accounts: own.length, weight: own.reduce((s, a) => s + tierWeight(a.tier), 0) };
  };
  const noCountry = unowned.filter((a) => !a.country).length;
  const included = (rows ?? []).filter((r) => r.include).length;
  const title =
    unowned.length === 0
      ? "Todas las cuentas tienen responsable"
      : unowned.length === 1
        ? "1 cuenta sin responsable"
        : `${unowned.length} cuentas sin responsable`;

  return (
    <Page
      eyebrow="Cuentas · Reparto"
      title={title}
      actions={
        <Button variant="outline" asChild>
          <Link to="/accounts">Volver a Cuentas</Link>
        </Button>
      }
    >
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Las reglas dicen quién lleva cada segmento, región o país; gana la primera que encaja.
        Dentro de una regla, la cuenta va a quien menos carga lleva (una cuenta A pesa 3, una B 2 y
        una C 1) y nadie pasa de su máximo. Solo se reparten las cuentas sin responsable. Al
        aprobar, sus deals y leads abiertos pasan al nuevo responsable.
      </p>

      <section className="mb-8">
        <h3 className="mb-3 text-2xl">Quién lleva cuentas</h3>
        {eligible.length === 0 ? (
          <Empty>
            No hay nadie con rol de AE, SDR, CS, Sales Leader u Owner. Invítalos en Equipo.
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {["Persona", "Rol", "Cuentas", "Carga", "Máximo"].map((h) => (
                    <th key={h} className="eyebrow px-3 py-3 sm:px-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eligible.map((m) => {
                  const l = load(m.user_id);
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium sm:px-4">{m.name}</td>
                      <td className="px-3 py-3 text-muted-foreground sm:px-4">
                        {ROLES[m.role as Role]?.label ?? m.role}
                      </td>
                      <td className="px-3 py-3 font-mono sm:px-4">{l.accounts}</td>
                      <td className="px-3 py-3 font-mono sm:px-4">{l.weight}</td>
                      <td className="px-3 py-3 sm:px-4">
                        {isOwner ? (
                          <Input
                            aria-label={`Máximo de cuentas de ${m.name}`}
                            className="w-24"
                            inputMode="numeric"
                            placeholder="Sin tope"
                            defaultValue={m.max_accounts ?? ""}
                            onBlur={(e) => saveMax(m, e.target.value)}
                          />
                        ) : (
                          <span className="font-mono">{m.max_accounts ?? "Sin tope"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isOwner && (
          <p className="mt-2 text-xs text-muted-foreground">
            El máximo de cuentas lo fija el Owner.
          </p>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-2xl">Reglas</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={aiRules} disabled={!!busy || !eligible.length}>
              {busy === "rules" ? "Pensando reglas…" : "Proponer reglas con IA"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setRules([
                  ...draft,
                  {
                    id: null,
                    key: newKey(),
                    segment_id: null,
                    region: null,
                    country: null,
                    members: [],
                  },
                ])
              }
            >
              + Añadir regla
            </Button>
            <Button onClick={saveRules} disabled={!dirtyRules || !!busy}>
              {busy === "save" ? "Guardando…" : "Guardar reglas"}
            </Button>
          </div>
        </div>
        {aiNotes && <p className="mb-3 rounded-md bg-muted p-3 text-sm">{aiNotes}</p>}
        {draft.length === 0 ? (
          <Empty>
            Sin reglas: la propuesta reparte entre todo el equipo equilibrando la carga.
          </Empty>
        ) : (
          <div className="space-y-3">
            {draft.map((r, i) => (
              <div key={r.key} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow">
                    {i + 1}. {ruleLabel(r, segNames)}
                    {r.id ? "" : " · sin guardar"}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => moveRule(i, -1)}
                    >
                      <span aria-hidden>↑</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Bajar"
                      disabled={i === draft.length - 1}
                      onClick={() => moveRule(i, 1)}
                    >
                      <span aria-hidden>↓</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Quitar regla"
                      onClick={() => setRules(draft.filter((x) => x.key !== r.key))}
                    >
                      <span aria-hidden>×</span>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Pick
                    aria-label="Segmento"
                    value={r.segment_id ?? ""}
                    options={{ "": "Cualquier segmento", ...Object.fromEntries(segNames) }}
                    onChange={(v) => patchRule(r.key, { segment_id: v || null })}
                  />
                  <Pick
                    aria-label="Lugar"
                    value={placeValue(r)}
                    options={PLACE_OPTIONS}
                    onChange={(v) => patchRule(r.key, placeFrom(v))}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {eligible.map((m) => {
                    const on = r.members.includes(m.user_id);
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patchRule(r.key, {
                            members: on
                              ? r.members.filter((x) => x !== m.user_id)
                              : [...r.members, m.user_id],
                          })
                        }
                        className={`min-h-9 rounded-none border px-3 py-1.5 text-xs md:min-h-0 ${on ? "border-signal bg-signal/10" : "hover:border-foreground/30"}`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                {r.why && <p className="mt-2 text-xs text-muted-foreground">{r.why}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-2xl">Propuesta</h3>
          <Button onClick={propose} disabled={!unowned.length || !eligible.length || !!busy}>
            Proponer reparto
          </Button>
        </div>
        {noCountry > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            {noCountry === 1
              ? "1 cuenta sin responsable no tiene país"
              : `${noCountry} cuentas sin responsable no tienen país`}
            : las reglas por región o país no las alcanzan. Ponlo en la ficha de la cuenta.
          </p>
        )}
        {rows === null ? (
          <Empty>
            {unowned.length
              ? "Pulsa «Proponer reparto» para ver quién llevaría cada cuenta. No se guarda nada hasta que apruebes."
              : "No hay cuentas sin responsable."}
          </Empty>
        ) : (
          <>
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left">
                    <tr>
                      {["", "Cuenta", "Persona", "Motivo"].map((h, i) => (
                        <th key={i} className="eyebrow px-3 py-3 sm:px-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const a = accounts.find((x) => x.id === r.account_id);
                      return (
                        <tr
                          key={r.account_id}
                          className={`border-b last:border-0 ${r.include ? "" : "opacity-50"}`}
                        >
                          <td className="px-3 py-3 sm:px-4">
                            <input
                              type="checkbox"
                              aria-label={`Incluir ${r.account}`}
                              checked={r.include}
                              onChange={(e) =>
                                setRows(
                                  rows.map((x) =>
                                    x.account_id === r.account_id
                                      ? { ...x, include: e.target.checked }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            <Link
                              to="/accounts/$id"
                              params={{ id: r.account_id }}
                              className="font-medium hover:text-signal"
                            >
                              {r.account}
                            </Link>
                            <span className="block text-xs text-muted-foreground">
                              Tier {r.tier ?? "B"}
                              {a?.segment_id ? ` · ${segNames.get(a.segment_id) ?? ""}` : ""}
                              {a?.country ? ` · ${countryName(a.country)}` : ""}
                            </span>
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            <Pick
                              aria-label={`Persona para ${r.account}`}
                              value={r.user_id}
                              options={Object.fromEntries(eligible.map((m) => [m.user_id, m.name]))}
                              onChange={(v) =>
                                setRows(
                                  rows.map((x) =>
                                    x.account_id === r.account_id
                                      ? { ...x, user_id: v, edited: true }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="max-w-md px-3 py-3 text-xs text-muted-foreground sm:px-4">
                            {r.edited ? "Cambiado a mano." : (r.why ?? r.reason)}
                            {!r.edited && busy === "explain" && !r.why ? " (explicando…)" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {unassigned.length > 0 && (
              <div className="mt-4 rounded-lg border bg-card p-4">
                <p className="eyebrow mb-2">Se quedan sin responsable ({unassigned.length})</p>
                <ul className="space-y-1 text-sm">
                  {unassigned.map((u) => (
                    <li key={u.account_id}>
                      <Link
                        to="/accounts/$id"
                        params={{ id: u.account_id }}
                        className="font-medium hover:text-signal"
                      >
                        {u.account}
                      </Link>{" "}
                      <span className="text-muted-foreground">· {u.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rows.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={approve} disabled={!included || !!busy}>
                  {busy === "approve"
                    ? "Aprobando…"
                    : included === 1
                      ? "Aprobar 1 asignación"
                      : `Aprobar ${included} asignaciones`}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRows(null);
                    setUnassigned([]);
                  }}
                >
                  Descartar propuesta
                </Button>
                <p className="text-xs text-muted-foreground">
                  Cada persona recibe un aviso en Sugerencias (y por Telegram si lo tiene
                  conectado).
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </Page>
  );
}
