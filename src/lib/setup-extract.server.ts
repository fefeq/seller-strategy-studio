// The AI proposal of a GTM setup from a company's web, texts and documents. Shared by «Proponer mi estrategia»
// (Configuración) and the onboarding background reading, so both ask the same thing.
import { ask } from "@/lib/ai-gateway";
import { SETUP_EXTRACTION_SCHEMA, type SetupProposal } from "@/lib/setup-extraction";

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/i;

async function fetchSite(raw: string) {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new Error("La web no es válida"); }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) throw new Error("La web no es válida");
  const res = await fetch(url, { headers: { "User-Agent": "NokkoBot/1.0", Accept: "text/html" }, redirect: "follow" }).catch(() => null);
  if (!res || !res.ok) throw new Error("No he podido leer esa web. Prueba a pegar el texto.");
  const html = (await res.text()).slice(0, 400_000);
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15_000);
}

/** Firecrawl reads the home page plus pricing/customers/product/about (also JavaScript sites); the plain fetch is the fallback. */
export async function readSite(url: string): Promise<string> {
  const { readCompanySite } = await import("@/lib/web-research-core");
  return readCompanySite(url).then((r) => r.text).catch((e) => { console.error("Firecrawl site read failed", (e as Error).message); return fetchSite(url); });
}

const PROMPT = "Eres un estratega GTM B2B senior. A partir de la web, textos y documentos de una empresa, propones su configuración go-to-market: posicionamiento (marco de April Dunford), segmentos con rango de ACV y motion (plg <5K, inside 5K–50K, field 50K–250K, strategic >250K), ICPs con anti-ICP, 3 pilares de mensaje y hasta 5 cuentas objetivo de ejemplo si se mencionan clientes o el tipo de cliente es claro. Español neutro (tú), sin signos de exclamación ni emoji. Sé concreto y basado en las fuentes; usa null cuando no haya base razonable (no inventes cifras de win rate o cuota si no aparecen: déjalas null). En segmentos, name es solo el nombre (sin prioridad, notas ni cifras): la prioridad va en priority (1 = el primero) y cualquier aclaración en notes; acv_min no puede ser mayor que acv_max: deriva la horquilla del pricing (plan más barato × 12 hasta el más caro × 12 por el número de perfiles o usuarios típico) y explícalo en notes; si el segmento tiene un único precio y no hay base para una horquilla, pon ese precio anual en acv_min y en acv_max y dilo en notes (nunca los dejes null teniendo un precio). Los pagos únicos (puesta en marcha, formación) no cuentan en el ACV. gross_margin_pct de cada segmento solo si las fuentes dan un margen (si dan uno general, ponlo en los segmentos que propones); si no, null. quarter_quota: el ACV nuevo a cerrar en el trimestre actual si las fuentes dan un objetivo trimestral (si dan uno anual, divídelo entre 4 y dilo en summary); si no, null. En positioning rellena también los cinco campos de Dunford (best_customers, alternatives, differentiation, value, trend). target_customer, need, category, key_benefit, competitive_alternative y differentiator son trozos de la frase «Para [target_customer] que [need], [product_name] es [category] que [key_benefit]. A diferencia de [competitive_alternative], nosotros [differentiator].»: escríbelos en minúscula, sin punto final y sin repetir las palabras de la plantilla. Rellena los cuatro textos de la jerarquía: tagline, one_liner, short_pitch (problema, solución y prueba en 2-3 frases) y elevator_pitch. En questions pon 2-4 preguntas clave que faltan para afinar." + " En basis pon, para cada bloque (company = empresa y moneda, icp, segments, positioning, messages = pilares, goals = cuota), su nivel: confirmed si la fuente lo dice tal cual, inferred si lo deduces de las fuentes, assumed si es un supuesto tuyo sin base directa; y en source de dónde sale en pocas palabras (por ejemplo «Web · precios», «Business plan», «Texto pegado» o null si es un supuesto).";

export async function extractSetupCore(
  ctx: { orgName: string; currency: string },
  data: { url: string; site: string; text: string; files?: { filename: string; dataUrl: string }[]; extra?: string },
): Promise<SetupProposal> {
  const raw = await ask(
    PROMPT,
    JSON.stringify({ empresa: ctx.orgName, moneda_actual: ctx.currency, web: data.url ? { url: data.url, texto: data.site } : null, notas: data.text || null, mercado_y_competidores: data.extra || null }),
    // "low": the proposal is reviewed block by block anyway, and a long call gets cut by mobile browsers (~60 s).
    { effort: "low", schema: { name: "gtm_setup", schema: SETUP_EXTRACTION_SCHEMA }, files: data.files },
  );
  try { return JSON.parse(raw) as SetupProposal; } catch (e) {
    console.error("extractSetup invalid JSON", { name: e instanceof Error ? e.name : typeof e, outputLength: raw.length });
    throw new Error("La IA no devolvió una propuesta válida. Inténtalo de nuevo.");
  }
}

/** «Rehacer con IA» one block: the whole proposal goes back with the person's hint; only that block is kept (mergeBlock). */
export async function redoBlockCore(ctx: { orgName: string; currency: string }, proposal: SetupProposal, block: string, hint: string): Promise<SetupProposal> {
  const raw = await ask(
    PROMPT + ` Ahora rehaces SOLO el bloque «${block}» de una propuesta ya hecha siguiendo la indicación de la persona; devuelve la propuesta completa con el resto igual.`,
    JSON.stringify({ empresa: ctx.orgName, moneda_actual: ctx.currency, propuesta_actual: proposal, bloque: block, indicacion: hint }),
    { effort: "low", schema: { name: "gtm_setup", schema: SETUP_EXTRACTION_SCHEMA } },
  );
  try { return JSON.parse(raw) as SetupProposal; } catch { throw new Error("La IA no devolvió una propuesta válida. Inténtalo de nuevo."); }
}
