// Web research cores shared by the screens (web-research.functions.ts), the agent/MCP tools and the hourly
// job. With a scope, every query filters by the company (privileged path), like src/lib/ai-core.ts.
import { ask } from "@/lib/ai-gateway";
import { accountContext, type AiScope } from "@/lib/ai-core";
import { mapSite, scrapeMarkdown } from "@/lib/firecrawl";
import { searchBoth } from "@/lib/web-search";
import { cleanDomain } from "@/lib/leads";
import { requireKey } from "@/lib/fit-key";
import { SIGNAL_KINDS, companyName, pickPages, publicUrl, signalQueries, type NewsItem, type SignalKind } from "@/lib/web-research";

type Db = any;
const inOrg = (q: any, scope: AiScope) => (scope ? q.eq("org_id", scope.orgId) : q);
const STYLE = "Español neutro (tú), sin signos de exclamación ni emoji, frases cortas, empieza por la conclusión.";

/** A company's website for onboarding/research: home page plus up to 3 key pages (pricing, customers, product, about). */
export async function readCompanySite(raw: string, maxChars = 30_000): Promise<{ text: string; pages: string[] }> {
  const url = publicUrl(raw);
  const home = await scrapeMarkdown(url, 12_000);
  let extra: string[] = [];
  try { extra = pickPages(await mapSite(url), url, 3); } catch { extra = []; }
  const pages = (await Promise.all(extra.map((u) => scrapeMarkdown(u, 6_000).then((p) => ({ u, md: p.markdown })).catch(() => null))))
    .filter((p): p is { u: string; md: string } => !!p && !!p.md.trim());
  const text = [`# ${url}\n${home.markdown}`, ...pages.map((p) => `# ${p.u}\n${p.md}`)].join("\n\n").slice(0, maxChars);
  return { text, pages: [url, ...pages.map((p) => p.u)] };
}

const RESEARCH_FIELDS = ["current_state", "pains", "initiatives", "competitors", "risks", "whitespace"] as const;
export type ResearchField = (typeof RESEARCH_FIELDS)[number];
export type AccountResearch = { summary: string; fields: Partial<Record<ResearchField, string>>; sources: { title: string; url: string }[] };

const RESEARCH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", ...RESEARCH_FIELDS, "sources"],
  properties: {
    summary: { type: "string", description: "3-4 frases: qué hace la empresa y la oportunidad para nosotros" },
    ...Object.fromEntries(RESEARCH_FIELDS.map((f) => [f, { type: "string", description: "Texto breve para ese campo del plan de cuenta; cadena vacía si las fuentes no dicen nada" }])),
    sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } } },
  },
};

/** Reads the account's website and recent news and proposes plan-of-account fields, with sources. Saves nothing. */
export async function researchAccountCore(db: Db, accountId: string, scope: AiScope = null): Promise<AccountResearch> {
  const { data: acc } = await inOrg(db.from("accounts").select("id,name,domain").eq("id", accountId), scope).maybeSingle();
  if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
  requireKey("cuenta", acc, "research_account");
  const domain = cleanDomain(acc.domain)!;
  let siteError: Error | null = null;
  const [site, news] = await Promise.all([
    readCompanySite(domain, 18_000).catch((e: Error) => { siteError = e; return { text: "", pages: [] as string[] }; }),
    searchBoth(
      { query: `"${companyName(acc.name, domain)}"`, limit: 8, sources: ["news", "web"], tbs: "qdr:y" },
      { queries: [`${companyName(acc.name, domain)} estrategia noticias`, `${companyName(acc.name, domain)} "case study" OR "caso de éxito"`], maxResults: 5, recency: "year" },
      12,
    ).catch(() => [] as NewsItem[]),
  ]);
  if (!site.text && !news.length) throw siteError ?? new Error("No he podido leer la web ni encontrar noticias de esta cuenta.");
  const ctx = await accountContext(db, accountId, scope);
  const raw = await ask(
    `Eres analista de cuentas B2B. Con la web y las noticias de la cuenta, propone qué escribir en su plan de cuenta: situación actual, dolores probables, iniciativas estratégicas, competencia/proveedores actuales, riesgos y whitespace para nosotros (según nuestro posicionamiento del contexto). Usa solo hechos de las fuentes; lo que deduzcas márcalo como «(hipótesis)». En sources pon solo las URLs de la web y las noticias que hayas usado. ${STYLE}`,
    JSON.stringify({ cuenta: { nombre: acc.name, dominio: domain }, web: { paginas: site.pages, texto: site.text }, noticias: news, contexto_nokko: ctx.slice(0, 20_000) }),
    { effort: "low", schema: { name: "account_research", schema: RESEARCH_SCHEMA } },
  );
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { throw new Error("La IA no devolvió la investigación. Vuelve a probar."); }
  // Only links that were really read: the model may not invent sources.
  const known = new Map<string, string>([...site.pages.map((u) => [u, u] as [string, string]), ...news.map((n) => [n.url, n.title] as [string, string])]);
  const sources = ((parsed.sources as { title: string; url: string }[]) ?? []).filter((s) => known.has(s.url)).map((s) => ({ title: s.title || known.get(s.url)!, url: s.url }));
  if (!sources.length) sources.push(...site.pages.slice(0, 1).map((u) => ({ title: acc.name, url: u })), ...news.slice(0, 3).map((n) => ({ title: n.title, url: n.url })));
  const fields = Object.fromEntries(RESEARCH_FIELDS.map((f) => [f, String(parsed[f] ?? "").trim()]).filter(([, v]) => v)) as Partial<Record<ResearchField, string>>;
  return { summary: String(parsed.summary ?? ""), fields, sources };
}

const SIGNAL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["index", "relevant", "kind", "summary", "relevance", "published"],
        properties: {
          index: { type: "integer" },
          relevant: { type: "boolean", description: "false si la noticia no trata de esta empresa (homónimos) o no aporta nada comercial" },
          kind: { type: "string", enum: [...SIGNAL_KINDS] },
          summary: { type: "string", description: "Una frase: qué ha pasado" },
          relevance: { type: "string", description: "Una frase: por qué importa para venderles y qué haría un vendedor" },
          published: { type: ["string", "null"], description: "AAAA-MM-DD si se sabe" },
        },
      },
    },
  },
};

export type SignalRow = { id: string; title: string; url: string; kind: SignalKind; summary: string; relevance: string; source: string; published_at: string | null; found_at: string };

/** Looks for the account's news of the last month, keeps the ones about it with a commercial angle, saves new ones. */
export async function refreshSignalsCore(db: Db, accountId: string, scope: AiScope = null): Promise<{ checked: number; added: SignalRow[] }> {
  const { data: acc } = await inOrg(db.from("accounts").select("id,org_id,name,domain,linkedin_url").eq("id", accountId), scope).maybeSingle();
  if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
  const now = new Date().toISOString();
  const name = companyName(acc.name, cleanDomain(acc.domain));
  if (!name) throw new Error("La cuenta no tiene nombre ni dominio para buscar sus noticias.");
  // News (Firecrawl + Perplexity) and LinkedIn (Apify: the company's posts and job offers) in parallel; LinkedIn never blocks the news.
  const { linkedinSignalItems } = await import("@/lib/apify-core");
  const [news, linkedin] = await Promise.all([
    searchBoth({ query: `"${name}"`, limit: 10, sources: ["news"], tbs: "qdr:m" }, { queries: signalQueries(name), maxResults: 5, recency: "month" }, 18),
    linkedinSignalItems(db, acc).catch((e) => { console.error("LinkedIn signals failed", (e as Error).message); return [] as NewsItem[]; }),
  ]);
  const items = [...news, ...linkedin];
  const { data: existing } = await db.from("account_signals").select("url").eq("org_id", acc.org_id).eq("account_id", acc.id);
  const seen = new Set((existing ?? []).map((r: { url: string }) => r.url));
  const fresh = items.filter((n) => !seen.has(n.url));
  let added: SignalRow[] = [];
  if (fresh.length) {
    const { data: pos } = await db.from("positioning").select("one_liner,category,target_customer").eq("org_id", acc.org_id).limit(1).maybeSingle();
    const raw = await ask(
      `Clasificas noticias sobre una cuenta B2B para un equipo comercial. Marca relevant=false si no trata de esta empresa (fíjate en el dominio; un caso de éxito de un competidor que solo la menciona no cuenta) o no tiene ángulo comercial. leadership = nombramientos y cambios de dirección; case_study = caso de éxito publicado por la empresa o sobre ella (qué proveedor usa y qué resultados obtuvo). Fuente «LinkedIn» = publicación de la propia empresa: relevante solo si anuncia algo (lanzamiento, cliente, alianza, resultados, evento propio, expansión), no si es contenido genérico. Fuente «LinkedIn Empleo» = oferta de empleo abierta: kind hiring, relevante solo si el puesto revela una prioridad o un presupuesto que nos toca (por ejemplo un Head of Sales o RevOps = están montando o cambiando el equipo comercial); el resto, relevant=false. ${STYLE}`,
      JSON.stringify({ cuenta: { nombre: acc.name, dominio: acc.domain }, nosotros: pos ?? null, noticias: fresh.map((n, index) => ({ index, titulo: n.title, fuente: n.source, fecha: n.date, extracto: n.snippet })) }),
      { effort: "low", schema: { name: "account_signals", schema: SIGNAL_SCHEMA } },
    );
    let parsed: { items: { index: number; relevant: boolean; kind: SignalKind; summary: string; relevance: string; published: string | null }[] };
    try { parsed = JSON.parse(raw); } catch { throw new Error("La IA no devolvió la clasificación de noticias. Vuelve a probar."); }
    const rows = parsed.items.filter((x) => x.relevant && fresh[x.index]).map((x) => {
      const n = fresh[x.index]!;
      const published = x.published && /^\d{4}-\d{2}-\d{2}/.test(x.published) ? `${x.published.slice(0, 10)}T12:00:00Z` : null;
      return { org_id: acc.org_id, account_id: acc.id, url: n.url, title: n.title, summary: x.summary.slice(0, 600), relevance: x.relevance.slice(0, 600), kind: SIGNAL_KINDS.includes(x.kind) ? x.kind : "other", source: n.source, published_at: published };
    });
    if (rows.length) {
      const { data, error } = await db.from("account_signals").upsert(rows, { onConflict: "org_id,account_id,url", ignoreDuplicates: true }).select("id,title,url,kind,summary,relevance,source,published_at,found_at");
      if (error) throw new Error(error.message);
      added = (data ?? []) as SignalRow[];
    }
  }
  await db.from("accounts").update({ signals_checked_at: now }).eq("org_id", acc.org_id).eq("id", acc.id);
  return { checked: items.length, added };
}

/** Hourly job: refreshes signals for a few ABM target accounts per run (each account at most weekly). */
export async function runSignalRefresh(db: Db, now: Date, maxPerRun = 12, perOrg = 3) {
  if (!process.env["FIRECRAWL_API_KEY"]) return { skipped: "no_firecrawl" };
  const { accountsToRefresh } = await import("@/lib/web-research");
  const { data } = await db.from("accounts").select("id,org_id,domain,is_target,signals_checked_at").eq("is_target", true).not("domain", "is", null).limit(2000);
  const byOrg = new Map<string, typeof data>();
  for (const a of data ?? []) byOrg.set(a.org_id, [...(byOrg.get(a.org_id) ?? []), a]);
  const queue = [...byOrg.entries()].flatMap(([orgId, list]) => accountsToRefresh(list ?? [], now, perOrg).map((a) => ({ ...a, org_id: orgId }))).slice(0, maxPerRun);
  let added = 0, failed = 0;
  for (const a of queue) {
    try { added += (await refreshSignalsCore(db, a.id, { orgId: a.org_id, userId: "" })).added.length; }
    catch (e) {
      failed++;
      console.error("signal refresh failed", a.id, (e as Error).message);
      if (/créditos/.test((e as Error).message)) break; // no credits: stop spending calls this run
    }
  }
  return { accounts: queue.length, added, failed };
}
