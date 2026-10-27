// Loads what the strategic review reads (SDD-20261027 F4, CA-40) as anonymised sources. Takes the client and the company
// explicitly, like the agent tools. Free-text notes are cut short and names are masked later by buildReviewInput (CA-48).
import type { Db } from "@/lib/org-data";
import type { ReviewSource } from "@/lib/strategy-review";

const cut = (v: string | null | undefined, n = 400) =>
  (v ?? "").replace(/\s+/g, " ").trim().slice(0, n) || null;
const MAX_NAMES = 500;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows of dynamic tables
type Row = Record<string, any>;

export async function loadReviewSources(db: Db, orgId: string): Promise<ReviewSource[]> {
  const q = async (t: string, cols: string, limit: number, order?: string): Promise<Row[]> => {
    let r = (db as any).from(t).select(cols).eq("org_id", orgId); // eslint-disable-line @typescript-eslint/no-explicit-any -- table name is dynamic
    if (order) r = r.order(order, { ascending: false });
    const { data } = await r.limit(limit);
    return (data ?? []) as Row[];
  };
  const [
    icps,
    segments,
    positioning,
    pillars,
    products,
    deals,
    leads,
    meetings,
    signals,
    sensing,
    experiments,
    accounts,
  ] = await Promise.all([
    q("icp_profiles", "id,name,industries,company_size,geography,anti_icp,why_fit,pains", 20),
    q(
      "segments",
      "id,name,acv_min,acv_max,motion,cycle_days,win_rate_target,cac_target,payback_months,acquisition_motion",
      20,
    ),
    q(
      "positioning",
      "id,target_customer,need,category,key_benefit,competitive_alternative,differentiator,one_liner",
      1,
    ),
    q("messaging_pillars", "id,title,pain,message", 12),
    q("products", "id,name,active,price,cost", 40),
    q(
      "deals",
      "id,name,stage,amount,account_id,segment_id,created_at,closed_at,lost_reason,lost_competitor,slip_count",
      150,
      "updated_at",
    ),
    q(
      "leads",
      "id,company,stage,source,segment_id,disqualified_reason,created_at",
      100,
      "created_at",
    ),
    q(
      "meetings",
      "id,title,account_id,scheduled_at,objections,next_steps,call_notes",
      40,
      "scheduled_at",
    ),
    q("account_signals", "id,account_id,kind,summary,published_at", 40, "found_at"),
    q("sensing_notes", "id,kind,context,heard,surprised,emerging,interviewee", 40, "occurred_on"),
    q(
      "gtm_experiments",
      "id,title,hypothesis,status,result,learning,decision,metric,target",
      30,
      "created_at",
    ),
    q("accounts", "id,name,industry,size,country", 400),
  ]);
  const acc = new Map<string, Row>(accounts.map((a) => [a.id, a]));
  const names = [
    ...accounts.map((a) => a.name),
    ...leads.map((l) => l.company),
    ...sensing.map((n) => n.interviewee),
  ].filter((n): n is string => typeof n === "string" && n.trim().length >= 2);
  const all = [...new Set(names)].slice(0, MAX_NAMES);
  const accName = (id: string | null) =>
    id ? ((acc.get(id)?.name as string | undefined) ?? "cuenta") : "sin cuenta";
  const S = (
    table: string,
    id: string,
    label: string,
    facts: ReviewSource["facts"],
    link?: string,
  ): ReviewSource => ({ table, id, label, facts, names: all, ...(link ? { link } : {}) });

  return [
    ...icps.map((r) =>
      S("icp_profiles", r.id, `ICP ${r.name}`, {
        industrias: r.industries,
        tamano: r.company_size,
        geografia: r.geography,
        anti_icp: cut(r.anti_icp, 200),
        por_que_encaja: cut(r.why_fit, 200),
        dolores: cut(Array.isArray(r.pains) ? r.pains.join("; ") : r.pains, 200),
      }),
    ),
    ...segments.map((r) =>
      S("segments", r.id, `Segmento ${r.name}`, {
        acv_min: r.acv_min,
        acv_max: r.acv_max,
        motion: r.motion,
        ciclo_dias: r.cycle_days,
        win_rate_objetivo: r.win_rate_target,
        cac_objetivo: r.cac_target,
        payback_meses: r.payback_months,
        motion_adquisicion: r.acquisition_motion,
      }),
    ),
    ...positioning.map((r) =>
      S("positioning", r.id, "Posicionamiento", {
        cliente_objetivo: cut(r.target_customer, 200),
        necesidad: cut(r.need, 200),
        categoria: r.category,
        beneficio: cut(r.key_benefit, 200),
        alternativa: cut(r.competitive_alternative, 200),
        diferenciador: cut(r.differentiator, 200),
        frase: cut(r.one_liner, 200),
      }),
    ),
    ...pillars.map((r) =>
      S("messaging_pillars", r.id, `Pilar ${r.title}`, {
        titulo: r.title,
        dolor: cut(r.pain, 200),
        mensaje: cut(r.message, 200),
      }),
    ),
    ...products.map((r) =>
      S("products", r.id, `Producto ${r.name}`, {
        activo: r.active,
        precio: r.price,
        coste: r.cost,
      }),
    ),
    ...deals.map((r) =>
      S("deals", r.id, r.name, {
        etapa: r.stage,
        importe: r.amount,
        sector: acc.get(r.account_id)?.industry ?? null,
        pais: acc.get(r.account_id)?.country ?? null,
        segmento: r.segment_id,
        creado: r.created_at?.slice(0, 10) ?? null,
        cerrado: r.closed_at?.slice(0, 10) ?? null,
        motivo_perdida: r.lost_reason,
        competidor_perdida: r.lost_competitor,
        aplazamientos: r.slip_count,
      }),
    ),
    ...leads.map((r) =>
      S("leads", r.id, `Lead ${r.company ?? ""}`.trim(), {
        etapa: r.stage,
        origen: r.source,
        segmento: r.segment_id,
        descalificado: r.disqualified_reason,
        creado: r.created_at?.slice(0, 10) ?? null,
      }),
    ),
    ...meetings
      .filter((r) => r.account_id)
      .map((r) =>
        S(
          "meetings",
          r.id,
          `${r.title} (${accName(r.account_id)})`,
          {
            fecha: r.scheduled_at?.slice(0, 10) ?? null,
            objeciones: cut(r.objections, 300),
            siguientes_pasos: cut(r.next_steps, 200),
            notas: cut(r.call_notes, 400),
          },
          `/accounts/${r.account_id}?tab=meetings&meeting=${r.id}`,
        ),
      ),
    ...signals
      .filter((r) => r.account_id)
      .map((r) =>
        S(
          "account_signals",
          r.id,
          `Señal de ${accName(r.account_id)}`,
          {
            tipo: r.kind,
            resumen: cut(r.summary, 300),
            fecha: r.published_at?.slice(0, 10) ?? null,
          },
          `/accounts/${r.account_id}`,
        ),
      ),
    ...sensing.map((r) =>
      S(
        "sensing_notes",
        r.id,
        `Nota de escucha (${r.kind})`,
        {
          tipo: r.kind,
          contexto: cut(r.context, 200),
          escuchado: cut(r.heard, 300),
          sorpresa: cut(r.surprised, 200),
          emergente: cut(r.emerging, 200),
        },
        "/theory-u",
      ),
    ),
    ...experiments.map((r) =>
      S("gtm_experiments", r.id, r.title, {
        hipotesis: cut(r.hypothesis, 300),
        estado: r.status,
        resultado: cut(r.result, 300),
        aprendizaje: cut(r.learning, 300),
        decision: r.decision,
        metrica: r.metric,
        objetivo: r.target,
      }),
    ),
  ];
}
