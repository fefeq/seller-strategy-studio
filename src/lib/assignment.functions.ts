// AI around the account assignment. The assignment itself is computed (src/lib/assignment.ts); the AI
// only proposes rules from the company's data and puts each computed assignment into one plain line.
// Neither writes anything: the person reviews and saves.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import {
  COUNTRY_CODES,
  ELIGIBLE_ROLES,
  REGIONS,
  canApproveAssignment,
  countryName,
  isEligible,
  regionOf,
} from "@/lib/assignment";

async function leaderCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: me } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!me || !canApproveAssignment([me.role]))
    throw new Error("Solo el Owner y el Sales Leader pueden preparar el reparto de cuentas");
  return { orgId };
}

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const RULES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules", "notes"],
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["segment_id", "region", "country", "members", "why"],
        properties: {
          segment_id: nullableStr,
          region: { type: ["string", "null"], enum: [...Object.keys(REGIONS), null] },
          country: nullableStr,
          members: { type: "array", items: str },
          why: str,
        },
      },
    },
    notes: str,
  },
};

/** Rules proposed from segments, where the accounts are and who is on the team. Validated before returning. */
export const proposeAssignmentRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { orgId } = await leaderCtx(supabase, userId);
    const [segs, accs, mems] = await Promise.all([
      supabase.from("segments").select("id,name,acv_min,acv_max,motion").eq("org_id", orgId),
      supabase.from("accounts").select("segment_id,country,tier,owner_id").eq("org_id", orgId),
      supabase.from("org_members").select("user_id,role,max_accounts").eq("org_id", orgId),
    ]);
    const ids = (mems.data ?? []).map((m: any) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,full_name").in("id", ids)
      : { data: [] };
    const team = (mems.data ?? [])
      .filter((m: any) => isEligible(m.role))
      .map((m: any) => ({
        user_id: m.user_id,
        nombre: (profiles ?? []).find((p: any) => p.id === m.user_id)?.full_name || "Sin nombre",
        rol: m.role,
        maximo: m.max_accounts,
      }));
    if (!team.length)
      throw new Error(
        "No hay nadie en el equipo con un rol que pueda llevar cuentas (AE, SDR, CS, Sales Leader u Owner)",
      );
    const counts = new Map<string, number>();
    for (const a of accs.data ?? []) {
      const k = `${a.segment_id ?? "-"}|${a.country ? regionOf(a.country) : "-"}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const distribucion = [...counts].map(([k, n]) => {
      const [seg, reg] = k.split("|");
      return {
        segmento_id: seg === "-" ? null : seg,
        region: reg === "-" ? null : reg,
        cuentas: n,
      };
    });
    const raw = await ask(
      [
        "Eres RevOps de un equipo comercial pequeño. Propón reglas de reparto de cuentas en español neutro (tú), sin signos de exclamación.",
        `Una regla dice qué personas llevan las cuentas de un segmento y/o una región o país. Regiones válidas: ${Object.entries(
          REGIONS,
        )
          .map(([k, v]) => `${k} (${v})`)
          .join(", ")}. Países: código ISO de dos letras.`,
        "La primera regla que encaja gana, así que pon las específicas antes que las generales. Usa solo segment_id y user_id de los datos. Menos reglas es mejor: si el equipo es de 2-3 personas, quizá baste con una regla por región o ninguna.",
        "Pon el AE y el Sales Leader en cuentas de venta, el SDR en prospección y el CS solo si hay clientes. No inventes personas ni segmentos. En why explica la regla en una frase; en notes, lo que falta en los datos (cuentas sin país o sin segmento).",
      ].join(" "),
      JSON.stringify({
        segmentos: segs.data ?? [],
        distribucion_de_cuentas: distribucion,
        equipo: team,
        roles_que_pueden_llevar_cuentas: ELIGIBLE_ROLES,
      }),
      { effort: "medium", schema: { name: "assignment_rules", schema: RULES_SCHEMA } },
    );
    let parsed: {
      rules: {
        segment_id: string | null;
        region: string | null;
        country: string | null;
        members: string[];
        why: string;
      }[];
      notes: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("La IA no devolvió reglas válidas. Inténtalo de nuevo.");
    }
    const segIds = new Set((segs.data ?? []).map((s: any) => s.id));
    const teamIds = new Set(team.map((t) => t.user_id));
    // Keep only what exists: unknown segments, countries or people are dropped, never saved.
    const rules = (parsed.rules ?? [])
      .map((r) => ({
        segment_id: r.segment_id && segIds.has(r.segment_id) ? r.segment_id : null,
        region: r.region && r.region in REGIONS ? (r.region as keyof typeof REGIONS) : null,
        country:
          r.country && COUNTRY_CODES.includes(r.country.toUpperCase())
            ? r.country.toUpperCase()
            : null,
        members: [...new Set((r.members ?? []).filter((m) => teamIds.has(m)))],
        why: String(r.why ?? "").slice(0, 300),
      }))
      .filter((r) => r.members.length);
    return { rules, notes: String(parsed.notes ?? "").slice(0, 600) };
  });

const EXPLAIN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["account_id", "why"],
        properties: { account_id: str, why: str },
      },
    },
  },
};

type ExplainRow = {
  account_id: string;
  account: string;
  tier: string | null;
  segment: string | null;
  country: string | null;
  person: string;
  rule: string;
  before_accounts: number;
  before_load: number;
  candidates: number;
};

/** One plain line per computed assignment, using only the facts of the calculation. */
export const explainAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: ExplainRow[] }) => ({
    rows: Array.isArray(d?.rows) ? d.rows.slice(0, 200) : [],
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await leaderCtx(supabase, userId);
    if (!data.rows.length) return { lines: [] as { account_id: string; why: string }[] };
    const facts = data.rows.map((r) => ({
      ...r,
      country: r.country ? countryName(r.country) : null,
    }));
    const raw = await ask(
      "Explica en una línea (máximo 20 palabras, español neutro, sin signos de exclamación) por qué cada cuenta va a esa persona. Usa solo los hechos dados: la regla que encaja, el tier y la carga que la persona llevaba (cuentas y carga ponderada por tier: A=3, B=2, C=1) frente al resto de candidatos. No añadas motivos que no estén en los datos.",
      JSON.stringify(facts),
      { schema: { name: "assignment_explain", schema: EXPLAIN_SCHEMA } },
    );
    let parsed: { lines: { account_id: string; why: string }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("La IA no devolvió explicaciones válidas.");
    }
    const ids = new Set(data.rows.map((r) => r.account_id));
    return {
      lines: (parsed.lines ?? [])
        .filter((l) => ids.has(l.account_id))
        .map((l) => ({ account_id: l.account_id, why: String(l.why).slice(0, 200) })),
    };
  });
