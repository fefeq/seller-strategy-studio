// «Descubiertos» weekly search (server-only). Runs with the admin client and always filters by the company.
// Per ICP (up to 3): companies that fit (Apollo → Clay, judged by the AI) and contacts with the ICP's titles,
// first in its target accounts with an empty power map, then in the best companies just found. Competitors: web search + AI reading. Everything goes through the budget (automatic work
// pauses at 100 %), every find is unique per company, and a dismissed one never returns.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  companyReason,
  dedupeKey,
  discoveryDue,
  normalizeScope,
  knownCompetitors,
  parseCompetitors,
  parseFitJudgments,
  parseIcpQuery,
  peopleTargets,
  sizeLabel,
  PER_ICP,
  COMPETITOR_SCHEMA,
  FIT_SCHEMA,
  QUERY_SCHEMA,
  type DiscoveryKind,
} from "@/lib/discoveries";
import { icpToQuery } from "@/lib/clay";

type Admin = SupabaseClient<Database>;
type Row = {
  kind: DiscoveryKind;
  name: string;
  detail: Record<string, unknown>;
  reason: string;
  source: string;
  dedupe_key: string;
};
const LOCK = (orgId: string) => `discover:${orgId}`;
const MAX = { company: 12, contact: 12, competitor: 5 };

export type DiscoveryRun = {
  skipped?: string;
  added: Record<DiscoveryKind, number>;
  notes: string[];
};

export async function discoverForOrg(
  db: Admin,
  orgId: string,
  now = new Date(),
  opts: {
    force?: boolean;
    trigger?: "manual" | "automatic";
    userId?: string | null;
    scope?: { kinds?: unknown; icpIds?: unknown };
  } = {},
): Promise<DiscoveryRun> {
  const added = { company: 0, contact: 0, competitor: 0 };
  const scope = normalizeScope(opts.scope);
  const wants = {
    company: scope.kinds.includes("company"),
    contact: scope.kinds.includes("contact"),
    competitor: scope.kinds.includes("competitor"),
  };
  const { data: lock } = await db
    .from("job_locks")
    .select("last_run_at")
    .eq("name", LOCK(orgId))
    .maybeSingle();
  if (!opts.force && !discoveryDue(lock?.last_run_at, now))
    return { skipped: "not_due", added, notes: [] };
  // Mark the week first: a failing provider must not make the hourly job retry every hour.
  // A manual search («Buscar ahora», force) never moves the weekly clock (CA-11, Fede 2026-10-28).
  if (!opts.force)
    await db
      .from("job_locks")
      .upsert({ name: LOCK(orgId), last_run_at: now.toISOString() }, { onConflict: "name" });

  const trigger = opts.trigger ?? "automatic";
  const actor =
    opts.userId ??
    (
      await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle()
    ).data?.user_id ??
    null;
  const { data: org } = await db
    .from("organizations")
    .select("currency,name,company_name")
    .eq("id", orgId)
    .maybeSingle();
  const ctx = {
    db,
    orgId,
    userId: actor as string,
    roles: ["owner"],
    currency: org?.currency ?? "EUR",
  };
  const { data: seenRows } = await db
    .from("discoveries")
    .select("dedupe_key")
    .eq("org_id", orgId)
    .limit(5000);
  const seen = new Set((seenRows ?? []).map((r) => r.dedupe_key));
  const rows: Row[] = [];
  const notes: string[] = [];
  const push = (r: Row) => {
    if (seen.has(r.dedupe_key)) return false;
    seen.add(r.dedupe_key);
    rows.push(r);
    return true;
  };
  const { findIcpCompanies, findKeyPeople } = await import("@/lib/orchestrator/runner");

  // 1 · Per ICP: companies that fit (not already accounts), then contacts for that ICP. The company search matches
  // loosely by keywords, so the AI judges each candidate against the ICP and only real fits (≥ 60) enter.
  if (wants.company || wants.contact)
    try {
      const { data: allIcps } = await db
        .from("icp_profiles")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at")
        .limit(3);
      const icps = scope.icpIds
        ? (allIcps ?? []).filter((i) => scope.icpIds!.includes(i.id))
        : allIcps;
      // Only a manual search explains an empty ICP list; the weekly run stays quiet as before.
      if (!icps?.length && opts.force)
        notes.push(
          scope.icpIds
            ? "Empresas y contactos: no encuentro el ICP elegido."
            : "Empresas y contactos: define al menos un ICP para poder buscarlos.",
        );
      const { data: pos0 } = await db
        .from("positioning")
        .select("product_name,target_customer,best_customers")
        .eq("org_id", orgId)
        .limit(1)
        .maybeSingle();
      const { icpBrief, icpCompanyQuery, icpForSegment, icpPeopleQuery } =
        await import("@/lib/icp");
      const { pickKeyPeople } = await import("@/lib/lead-flow");
      const { data: targets } = await db
        .from("accounts")
        .select("id,name,domain,segment_id")
        .eq("org_id", orgId)
        .eq("is_target", true)
        .not("domain", "is", null)
        .limit(60);
      const tIds = (targets ?? []).map((a) => a.id);
      const { data: sh } = tIds.length
        ? await db
            .from("stakeholders")
            .select("account_id")
            .eq("org_id", orgId)
            .in("account_id", tIds)
        : { data: [] as { account_id: string }[] };
      const mapped = new Map<string, number>();
      for (const x of sh ?? []) mapped.set(x.account_id, (mapped.get(x.account_id) ?? 0) + 1);
      let blocked = false;
      for (const icp of icps ?? []) {
        if (blocked) break;
        const icpTag = { icp_id: icp.id, icp_name: icp.name };
        const found: { name: string; domain: string | null; fit: number }[] = [];
        let companies = 0;
        if (wants.company)
          try {
            const { ask } = await import("@/lib/ai-gateway");
            // Structured ICPs go straight to the databases; prose-only ones are translated to English terms first.
            const built = icpCompanyQuery(icp);
            const plain = built.query.keywords?.length ? built.query : icpToQuery(icp);
            const query = built.structured
              ? built.query
              : await ask(
                  "Conviertes un perfil de cliente ideal (ICP) en términos de búsqueda para una base de datos de empresas en inglés (como LinkedIn): hasta 6 palabras clave cortas del tipo de empresa o sector en inglés, países como código ISO de 2 letras y el rango de empleados si se deduce.",
                  icpBrief(icp),
                  { effort: "low", schema: { name: "query", schema: QUERY_SCHEMA as never } },
                )
                  .then((raw) => parseIcpQuery(raw, plain))
                  .catch(() => plain);
            const r = await findIcpCompanies(ctx, { query }, trigger);
            if (r.blocked) {
              notes.push(r.blocked);
              blocked = true;
              break;
            }
            const cands = r.rows
              .filter((c) => !c.existingId && c.name?.trim() && !seen.has(dedupeKey("company", c)))
              .slice(0, 25);
            if (cands.length) {
              const raw = await ask(
                "Eres analista de ventas B2B. Puntúa de 0 a 100 cuánto encaja cada empresa candidata con el ICP descrito (tipo de empresa, sector, tamaño, país y exclusiones). Sé estricto: una empresa grande de otro sector es 0–20 aunque comparta una palabra. La razón, en español, en una frase concreta que diga por qué encaja o no.",
                `${icpBrief(icp)}\nNuestro producto: ${pos0?.product_name ?? ""} para ${pos0?.target_customer ?? ""}\n\nCandidatas:\n${cands.map((c, i) => `${i}. ${c.name} — ${[c.industry, sizeLabel(c.size), c.country, c.domain].filter(Boolean).join(" · ")}${c.description ? ` — ${c.description.slice(0, 200)}` : ""}`).join("\n")}`,
                { effort: "low", schema: { name: "fit", schema: FIT_SCHEMA as never } },
              );
              const fits = parseFitJudgments(raw, cands.length);
              if (!fits.size)
                notes.push(
                  `Empresas: ninguna de las ${cands.length} candidatas de «${icp.name}» encaja de verdad.`,
                );
              for (const [i, f] of [...fits.entries()].sort((x, y) => y[1].fit - x[1].fit)) {
                if (companies >= PER_ICP.company || added.company >= MAX.company) break;
                const c = cands[i]!;
                if (
                  push({
                    kind: "company",
                    name: c.name.trim(),
                    detail: {
                      domain: c.domain,
                      industry: c.industry,
                      size: sizeLabel(c.size),
                      country: c.country,
                      linkedin: c.linkedin,
                      description: c.description,
                      ...icpTag,
                      fit: f.fit,
                    },
                    reason: `Encaje ${f.fit}/100 con «${icp.name}»: ${f.reason || companyReason(icp.name, c)}`,
                    source: r.sources.replace(/\s*·\s*coste.*$/, ""),
                    dedupe_key: dedupeKey("company", c),
                  })
                ) {
                  companies++;
                  added.company++;
                  found.push({ name: c.name.trim(), domain: c.domain, fit: f.fit });
                }
              }
            }
          } catch (e) {
            notes.push(`Empresas de «${icp.name}»: ${(e as Error).message}`);
          }

        // Contacts for this ICP: who its titles/levels say, in its empty target accounts and then in the companies just found.
        if (wants.contact)
          try {
            const mine = (targets ?? [])
              .filter((a) => icpForSegment(allIcps ?? [], a.segment_id)?.id === icp.id)
              .map((a) => ({ ...a, people: mapped.get(a.id) ?? 0 }));
            const who = icpPeopleQuery(icp);
            if (!wants.company && !mine.some((a) => a.people < 2))
              notes.push(
                `Contactos de «${icp.name}»: no hay cuentas objetivo con el mapa de poder casi vacío. Incluye también empresas para buscar en las nuevas.`,
              );
            let contacts = 0;
            for (const t of peopleTargets(mine, found)) {
              if (contacts >= PER_ICP.contact || added.contact >= MAX.contact) break;
              const r = await findKeyPeople(
                ctx,
                {
                  accountId: t.accountId ?? "",
                  company: t.accountId ? undefined : { name: t.name, domain: t.domain },
                  titles: who.titles,
                  levels: who.levels,
                },
                trigger,
              );
              if (r.blocked) {
                notes.push(r.blocked);
                blocked = true;
                break;
              }
              const best = pickKeyPeople(
                r.rows
                  .filter((p) => !p.existingId)
                  .map((p) => ({ name: p.name, title: p.title, linkedin: p.linkedin })),
                null,
                2,
              );
              for (const p of best) {
                if (contacts >= PER_ICP.contact) break;
                const apolloId = r.rows.find((x) => x.name === p.name)?.apolloId ?? null;
                const why = t.accountId
                  ? `cuenta objetivo con el mapa de poder casi vacío`
                  : `empresa nueva que encaja con «${icp.name}»`;
                if (
                  push({
                    kind: "contact",
                    name: p.name,
                    detail: {
                      title: p.title,
                      linkedin: p.linkedin,
                      account_id: t.accountId,
                      account_name: t.name,
                      domain: t.domain,
                      apollo_id: apolloId,
                      ...icpTag,
                    },
                    reason: `Persona clave en ${t.name}, ${why}.`,
                    source: r.sources.replace(/\s*·\s*coste.*$/, ""),
                    dedupe_key: dedupeKey("contact", {
                      name: p.name,
                      linkedin: p.linkedin,
                      account_id: t.accountId ?? `d:${t.domain}`,
                    }),
                  })
                ) {
                  contacts++;
                  added.contact++;
                }
              }
            }
          } catch (e) {
            notes.push(`Contactos de «${icp.name}»: ${(e as Error).message}`);
          }
      }
    } catch (e) {
      notes.push(`Empresas y contactos: ${(e as Error).message}`);
    }

  // 3 · Competitors from the web, read by the AI (only new names).
  if (wants.competitor)
    try {
      const { data: pos } = await db
        .from("positioning")
        .select("product_name,category,competitive_alternative,target_customer")
        .eq("org_id", orgId)
        .limit(1)
        .maybeSingle();
      const product = pos?.product_name?.trim() || org?.company_name?.trim() || org?.name || "";
      if (pos?.category?.trim() && product) {
        const { trackedRun } = await import("@/lib/orchestrator/runner");
        const { searchBoth } = await import("@/lib/web-search");
        const q = [
          `alternativas a ${product} ${pos.category}`,
          `${pos.category} competidores ${new Date().getFullYear()}`,
        ];
        const found = await trackedRun(ctx, "competitors", trigger, async () => ({
          items: await searchBoth({ query: q[0]!, limit: 8 }, { queries: q, maxResults: 6 }, 12),
        }));
        if (found.items.length) {
          const { ask } = await import("@/lib/ai-gateway");
          const known = knownCompetitors(pos.competitive_alternative);
          const text = await ask(
            "Lees resultados de búsqueda web y extraes empresas que compiten directamente con el producto descrito (misma categoría y cliente). Nunca inventes: solo nombres que aparezcan en los resultados. Responde en español.",
            `Producto: ${product}\nCategoría: ${pos.category}\nCliente: ${pos.target_customer ?? ""}\nYa conocidos: ${pos.competitive_alternative ?? "ninguno"}\n\nResultados:\n${found.items.map((i, n) => `${n + 1}. ${i.title} — ${i.url}\n${i.snippet}`).join("\n")}`,
            { effort: "low", schema: { name: "competitors", schema: COMPETITOR_SCHEMA as never } },
          );
          for (const c of parseCompetitors(text, known, product, MAX.competitor)) {
            if (
              push({
                kind: "competitor",
                name: c.name,
                detail: { url: c.url },
                reason: c.why || "Aparece como alternativa en la web.",
                source: (found.via || "Web").replace(/\s*·\s*coste.*$/, ""),
                dedupe_key: dedupeKey("competitor", c),
              })
            )
              added.competitor++;
          }
        }
      } else notes.push("Competidores: falta la categoría del producto en el posicionamiento.");
    } catch (e) {
      notes.push(`Competidores: ${(e as Error).message}`);
    }

  if (rows.length) {
    const { error } = await db.from("discoveries").upsert(
      rows.map((r) => ({ ...r, org_id: orgId, detail: r.detail as never })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    const total = rows.length;
    const parts = [
      added.company && `${added.company} ${added.company === 1 ? "empresa" : "empresas"}`,
      added.contact && `${added.contact} ${added.contact === 1 ? "contacto" : "contactos"}`,
      added.competitor &&
        `${added.competitor} ${added.competitor === 1 ? "competidor" : "competidores"}`,
    ].filter(Boolean);
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    await db.from("suggestions").upsert(
      {
        org_id: orgId,
        detector: "discoveries",
        dedupe_key: `discoveries:${monday.toISOString().slice(0, 10)}`,
        priority: 3,
        title: `Descubiertos: ${total} ${total === 1 ? "novedad" : "novedades"} esta semana`,
        body: `${parts.join(", ")}. Acepta o descarta cada una: lo que descartes no volverá.`,
        link: "/discoveries",
      },
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  if (notes.length) console.warn("discoveries notes", orgId, { count: notes.length });
  return { added, notes };
}
