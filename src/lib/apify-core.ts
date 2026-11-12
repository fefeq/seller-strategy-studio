// Apify cores shared by the screens (apify.functions.ts), the agent/MCP tools (agent/tools/apify.ts), the
// signal refresh (web-research-core.ts) and stakeholder research (ai-core.ts). With a scope, every query
// filters by the company (privileged path). Every run is capped in results and spend (src/lib/apify.ts).
import { ask } from "@/lib/ai-gateway";
import type { AiScope } from "@/lib/ai-core";
import type { Json } from "@/integrations/supabase/types";
import type { Db as OrgDb } from "@/lib/org-data";
import { runActor } from "@/lib/apify-gateway";
import {
  ACTORS,
  averageRating,
  g2ReviewsUrl,
  jobItems,
  linkedinCompanyUrl,
  linkedinNews,
  linkedinProfileUrl,
  pickG2Product,
  pickLinkedinCompany,
  postItems,
  reviewItems,
  type Job,
  type Post,
  type Review,
} from "@/lib/apify";
import { companyName, type NewsItem } from "@/lib/web-research";
import { cleanDomain } from "@/lib/leads";
import { jsonObject } from "@/lib/json";
import {
  keepUnreadable,
  originOf,
  readSources,
  stampUnconfirmed,
  type OriginKind,
} from "@/lib/provenance";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

type Db = OrgDb;
const inOrg = <Q extends { eq: (column: string, value: string) => Q }>(q: Q, scope: AiScope): Q =>
  scope ? q.eq("org_id", scope.orgId) : q;
const STYLE =
  "Español neutro (tú), sin signos de exclamación ni emoji, frases cortas, empieza por la conclusión.";

type Acc = {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  linkedin_url: string | null;
};

async function loadAccount(db: Db, accountId: string, scope: AiScope): Promise<Acc> {
  const { data } = await inOrg(
    db.from("accounts").select("id,org_id,name,domain,linkedin_url").eq("id", accountId),
    scope,
  ).maybeSingle();
  if (!data) throw new Error("No encuentro esa cuenta en esta empresa.");
  return data as Acc;
}

/** A failed read or save of the LinkedIn page; it carries the page that was found, so a caller that only wants to read it can still use it. */
export class LinkedinSaveError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
  }
}

/** companyLinkedin for callers that only read the page: a failed save is logged, never hidden, and the page found is still returned. */
async function linkedinForReading(db: Db, acc: Acc): Promise<string | null> {
  try {
    return await companyLinkedin(db, acc);
  } catch (e) {
    console.error("LinkedIn page lookup failed", safeErrorLog(e));
    return e instanceof LinkedinSaveError ? e.url : null;
  }
}

/**
 * The account's LinkedIn page: the saved one, else found with a web search and saved on the account.
 * Saved only into an empty field or one a person did not write, marked web / fuente / not confirmed (never «persona»,
 * SDD field-sources-on-tracked-writers U-4); the mark is read right before writing and the page saved with the admin
 * client (decision of Fede, 2026-10-29), always filtered by the account's own org_id. «A person's value» is only the
 * `kind persona` mark: the URL is never interpreted. The client the caller passes is not used here (kept for callers).
 */
export async function companyLinkedin(_db: Db, acc: Acc): Promise<string | null> {
  const saved = linkedinCompanyUrl(acc.linkedin_url);
  if (saved) return saved;
  const name = companyName(acc.name, cleanDomain(acc.domain));
  if (!name) return null;
  const { searchBoth } = await import("@/lib/web-search");
  const found = await searchBoth(
    { query: `"${name}" site:linkedin.com/company`, limit: 5, sources: ["web"] },
    { queries: [`${name} LinkedIn company page`], maxResults: 5 },
    10,
  ).catch(() => [] as NewsItem[]);
  const url = pickLinkedinCompany(
    found.filter((r) => r.title.toLowerCase().includes(name.toLowerCase().split(" ")[0] ?? "")),
  );
  if (!url) return null;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: cur, error: readError } = await db
    .from("accounts")
    .select("linkedin_url,field_sources")
    .eq("org_id", acc.org_id)
    .eq("id", acc.id)
    .maybeSingle();
  // Without the marks read, nothing is written: the update would replace every mark and could overwrite a person's value.
  if (readError || !cur)
    throw new LinkedinSaveError(
      readError?.message ??
        "No he podido leer el LinkedIn guardado: la cuenta ya no está en esta empresa.",
      url,
    );
  const marks = readSources(cur.field_sources);
  // A person's value is never replaced. Read from the raw mark: readSources drops one with no `at`, and that must still protect.
  // A mark with source persona and a kind that is missing or invalid reads as persona too (originOf falls back to the source).
  const rawMark = jsonObject(jsonObject(cur.field_sources)?.linkedin_url);
  const byPerson =
    rawMark?.kind === "persona" ||
    (rawMark?.source === "persona" &&
      originOf({ source: "persona", at: "", kind: rawMark.kind as OriginKind })?.kind ===
        "persona") ||
    originOf(marks.linkedin_url)?.kind === "persona";
  if (cur.linkedin_url?.trim() && byPerson) return url;
  const { data, error } = await db
    .from("accounts")
    .update({
      linkedin_url: url,
      field_sources: keepUnreadable(
        cur.field_sources,
        stampUnconfirmed(
          marks,
          [{ field: "linkedin_url", source: "web" }],
          new Date().toISOString(),
        ),
      ) as unknown as Json, // jsonb write: the typed Json cannot express the mark records
    })
    .eq("org_id", acc.org_id)
    .eq("id", acc.id)
    .select("id");
  if (error) throw new LinkedinSaveError(error.message, url);
  if (!data?.length)
    throw new LinkedinSaveError(
      "No he podido guardar el LinkedIn: la cuenta ya no está en esta empresa.",
      url,
    );
  return url;
}

export async function companyPosts(
  url: string,
  max = 5,
  since: "week" | "month" | "3months" = "month",
): Promise<Post[]> {
  const raw = await runActor(
    ACTORS.companyPosts,
    { targetUrls: [url], maxPosts: max, postedLimit: since, includeReposts: false },
    { maxItems: max },
  );
  return postItems(raw, max);
}

export async function profilePosts(url: string, max = 3): Promise<Post[]> {
  const raw = await runActor(
    ACTORS.profilePosts,
    { targetUrls: [url], maxPosts: max, postedLimit: "3months" },
    { maxItems: max },
  );
  return postItems(raw, max);
}

export async function companyJobs(
  name: string,
  linkedinUrl: string | null,
  max = 15,
): Promise<Job[]> {
  const raw = await runActor(
    ACTORS.jobs,
    { companyName: [name], limit: max, datePosted: "r2592000" },
    { maxItems: max },
  );
  return jobItems(raw, name, linkedinUrl, max);
}

/** Posts of the last month by the account's LinkedIn page. */
export async function accountPostsCore(db: Db, accountId: string, scope: AiScope = null) {
  const acc = await loadAccount(db, accountId, scope);
  const url = await companyLinkedin(db, acc);
  if (!url)
    throw new Error(
      "No encuentro la página de LinkedIn de esta cuenta. Añádela en la ficha de la cuenta (LinkedIn de la empresa).",
    );
  return { linkedin: url, posts: await companyPosts(url, 8, "3months") };
}

/** Open job offers of the account (last 30 days on LinkedIn). */
export async function accountJobsCore(db: Db, accountId: string, scope: AiScope = null) {
  const acc = await loadAccount(db, accountId, scope);
  const name = companyName(acc.name, cleanDomain(acc.domain));
  const url = await linkedinForReading(db, acc);
  return { linkedin: url, jobs: await companyJobs(name, url, 20) };
}

/** Recent posts of a stakeholder with a LinkedIn profile. */
export async function stakeholderPostsCore(db: Db, stakeholderId: string, scope: AiScope = null) {
  const { data: s } = await inOrg(
    db.from("stakeholders").select("id,name,linkedin_url").eq("id", stakeholderId),
    scope,
  ).maybeSingle();
  if (!s) throw new Error("No encuentro esa persona en esta empresa.");
  const url = linkedinProfileUrl(s.linkedin_url);
  if (!url) throw new Error(`Añade el LinkedIn de ${s.name} para leer sus publicaciones.`);
  return { name: s.name as string, linkedin: url, posts: await profilePosts(url, 5) };
}

/**
 * LinkedIn posts and job offers for the signal refresh. Each source may fail on its own (no page, no credit):
 * the news search still answers, so failures are logged and skipped.
 */
export async function linkedinSignalItems(db: Db, acc: Acc): Promise<NewsItem[]> {
  if (!process.env["APIFY_API_KEY"]) return [];
  const name = companyName(acc.name, cleanDomain(acc.domain));
  const url = await linkedinForReading(db, acc);
  const [posts, jobs] = await Promise.all([
    url
      ? companyPosts(url, 5, "month").catch((e) => {
          console.error("Apify company posts failed", safeErrorLog(e));
          return [] as Post[];
        })
      : Promise.resolve([] as Post[]),
    name
      ? companyJobs(name, url, 10).catch((e) => {
          console.error("Apify jobs failed", safeErrorLog(e));
          return [] as Job[];
        })
      : Promise.resolve([] as Job[]),
  ]);
  return linkedinNews(posts, jobs.slice(0, 8));
}

/** Reviews of a competitor on G2 (by G2 link or by name). */
export async function competitorReviewsCore(
  competitor: string,
  max = 20,
): Promise<{ product: { name: string; url: string }; reviews: Review[]; average: number | null }> {
  const n = Math.min(Math.max(Math.round(max), 5), 40);
  let product: { name: string; url: string } | null = null;
  const direct = g2ReviewsUrl(competitor);
  if (direct) product = { name: direct.split("/products/")[1]!.split("/")[0]!, url: direct };
  else {
    const found = await runActor(
      { ...ACTORS.g2, maxUsd: 0.05 },
      { mode: "product_search", searchQuery: competitor.trim(), maxProducts: 5 },
      { maxItems: 5 },
    );
    product = pickG2Product(found, competitor);
  }
  if (!product)
    throw new Error(
      `No encuentro «${competitor}» en G2. Prueba con el nombre exacto del producto o pega su enlace de G2.`,
    );
  const raw = await runActor(
    ACTORS.g2,
    { mode: "product_reviews", productUrls: [product.url], maxReviews: n, sortReviews: "newest" },
    { maxItems: n, timeoutSecs: 90 },
  );
  const reviews = reviewItems(raw, n);
  if (!reviews.length)
    throw new Error(
      `G2 no devuelve reseñas de ${product.name}. Revisa el producto o prueba más tarde.`,
    );
  const realName = (raw[0] as { productName?: string } | undefined)?.productName;
  return {
    product: { name: realName || product.name, url: product.url },
    reviews,
    average: averageRating(reviews),
  };
}

/** A battlecard (Markdown) written from a competitor's G2 reviews and our positioning. Saves nothing. */
export async function battlecardCore(db: Db, competitor: string, max = 20, scope: AiScope = null) {
  const r = await competitorReviewsCore(competitor, max);
  const { data: pos } = await inOrg(
    db
      .from("positioning")
      .select("product_name,one_liner,category,differentiation,value,alternatives,target_customer"),
    scope,
  )
    .limit(1)
    .maybeSingle();
  const body = await ask(
    `Eres analista de inteligencia competitiva B2B. Con reseñas reales de G2 de un competidor y nuestro posicionamiento, escribe una battlecard en Markdown para vendedores. Secciones: «Resumen» (3 frases), «Lo que sus clientes valoran» (fortalezas que hay que neutralizar), «Lo que critican» (ángulos de ataque), «Por qué se cambian», «Objeciones y respuestas» (5, formato **Objeción:** / **Respuesta:**), «Preguntas trampa para discovery» (5) y «Cuándo no competir». Cita frases literales cortas entre comillas con su enlace markdown a la reseña. Solo hechos de las reseñas; lo que deduzcas márcalo «(hipótesis)». ${STYLE}`,
    JSON.stringify({
      competidor: r.product.name,
      nota_media: r.average,
      nosotros: pos ?? null,
      resenas: r.reviews.map((x) => ({
        url: x.url,
        titulo: x.title,
        estrellas: x.rating,
        fecha: x.date,
        texto: x.text,
        motivo_cambio: x.switchedReason || undefined,
      })),
    }),
    { effort: "low" },
  );
  const title = `Battlecard: ${r.product.name}`;
  const markdown = `${body.trim()}\n\nFuente: ${r.reviews.length} reseñas recientes de [G2](${r.product.url})${r.average !== null ? `, nota media ${r.average.toLocaleString("es-ES")}/5` : ""}, leídas el ${new Date().toLocaleDateString("es-ES")}.`;
  return { title, markdown, product: r.product, count: r.reviews.length, average: r.average };
}
