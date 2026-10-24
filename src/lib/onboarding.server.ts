// «Nokko lee» (onboarding_read background job): reads the founder's sources, writes each finding with its source to
// the onboarding session as it goes (the screen shows it as a live ticker), proposes the strategy and, in «A fondo»,
// adds market and competitors and a short C-Levels opinion per block. Respects the monthly budget.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Json } from "@/integrations/supabase/types";
import { BLOCKS, proposalFindings, type Depth, type Finding, type Opinion } from "@/lib/onboarding";
import type { SetupProposal } from "@/lib/setup-extraction";

type Ctx = ToolCtx & { orgName: string };
type Input = { depth?: Depth; url?: string; text?: string; files?: { filename: string; dataUrl: string }[] };

const OPINIONS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["opinions"],
  properties: { opinions: { type: "array", items: { type: "object", additionalProperties: false, required: ["block", "persona", "text"], properties: { block: { type: "string", enum: BLOCKS.map((b) => b.id) }, persona: { type: "string" }, text: { type: "string" } } } } },
};

export async function runOnboardingRead(c: Ctx, input: Input, step: (s: string) => Promise<void>) {
  const { monthBudget, logUsage } = await import("@/lib/orchestrator/runner");
  const depth: Depth = input.depth ?? "express";
  const url = String(input.url ?? "").trim();
  const text = String(input.text ?? "").slice(0, 40_000);
  const files = (input.files ?? []).slice(0, 3);

  const b = await monthBudget(c);
  if (b.paused) throw new Error("Has llegado al límite mensual de gasto en fuentes. Súbelo en Conexiones o espera al mes que viene.");

  const findings: Finding[] = [];
  const note = async (t: string, source: string | null) => {
    findings.push({ at: new Date().toISOString(), text: t.slice(0, 300), source });
    await c.db.from("onboarding_sessions").update({ findings: findings as unknown as Json, updated_at: new Date().toISOString() }).eq("org_id", c.orgId).eq("user_id", c.userId);
  };
  await note("Empiezo a leer tus fuentes", null);

  let site = "";
  if (url) {
    await step("Leyendo tu web");
    const host = (() => { try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname; } catch { return url; } })();
    const { readSite } = await import("@/lib/setup-extract.server");
    site = await readSite(url).catch(async (e) => { await note(`Sin acceso a la web: ${(e as Error).message}`, host); return ""; });
    if (site) { await note(`Leída tu web (${Math.round(site.length / 1000)} mil caracteres)`, `Web · ${host}`); await logUsage(c, "research_account", [{ service: "firecrawl", cost: 0.02 }], "manual"); }
  }
  if (text.trim()) {
    const named = [...text.matchAll(/--- (.+?) ---/g)].map((m) => m[1]);
    await note(named.length ? `Leído: ${named.join(", ")}` : "Leído el texto que pegaste", named.length ? named.join(", ") : "Texto pegado");
  }
  for (const f of files) await note(`Leyendo el documento ${f.filename}`, f.filename);

  let extra = "";
  if (depth === "deep") {
    await step("Mercado y competidores");
    const { searchBoth } = await import("@/lib/web-search");
    const items = await searchBoth(
      { query: `${c.orgName} competidores alternativas mercado`, limit: 8, sources: ["web"] },
      { queries: [`${c.orgName} competitors`, `${c.orgName} market alternatives`], maxResults: 5 },
      10,
    ).catch(async (e) => { await note(`No he podido buscar mercado y competidores: ${(e as Error).message}`, null); return []; });
    for (const it of items.slice(0, 6)) await note(`Fuente de mercado: ${it.title}`, it.url ?? null);
    extra = items.map((it) => `${it.title}: ${it.snippet ?? ""} (${it.url ?? ""})`).join("\n").slice(0, 12_000);
    if (items.length) await logUsage(c, "competitors", [{ service: "firecrawl", cost: 0.02 }, { service: "perplexity", cost: 0.01 }], "manual");
  }

  await step("Proponiendo tu estrategia");
  const { extractSetupCore } = await import("@/lib/setup-extract.server");
  const proposal = await extractSetupCore(c, { url, site, text, files, extra });
  for (const f of proposalFindings(proposal)) await note(f.text, f.source);

  let opinions: Opinion[] = [];
  if (depth === "deep") {
    await step("Debate de los C-Levels");
    opinions = await cLevelOpinions(c, proposal).catch(async (e) => { await note(`El debate de los C-Levels no respondió: ${(e as Error).message}`, null); return []; });
    if (opinions.length) await note(`Los C-Levels han opinado sobre ${opinions.length} bloques`, "Debate C-Levels");
  }

  // The AI's open questions wait in Sugerencias until someone answers or drops them.
  const { questionSuggestions } = await import("@/lib/setup-questions");
  const rows = questionSuggestions(proposal.questions ?? []).map((r) => ({ ...r, org_id: c.orgId }));
  if (rows.length) await c.db.from("suggestions").upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });

  await note("Listo: tu propuesta está preparada para revisarla bloque a bloque", null);
  await c.db.from("onboarding_sessions").update({ proposal: proposal as unknown as Json, opinions: opinions as unknown as Json, updated_at: new Date().toISOString() }).eq("org_id", c.orgId).eq("user_id", c.userId);
  return { title: "Tu propuesta de estrategia está lista: revísala bloque a bloque", body: proposal.summary.slice(0, 300), link: "/onboarding", needs_decision: true, findings: findings.length };
}

async function cLevelOpinions(c: Ctx, p: SetupProposal): Promise<Opinion[]> {
  const { ask } = await import("@/lib/ai-gateway");
  const { DEBATE_LEVELS } = await import("@/lib/bmad/teams");
  const { getPersona } = await import("@/lib/bmad/personas");
  const people = DEBATE_LEVELS.c_level.participants.map((id) => getPersona(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const raw = await ask(
    `Eres la mesa de C-Levels de Nokko: ${people.map((x) => `${x.name} (${x.title}; foco: ${x.focus})`).join("; ")}. Para cada bloque de esta propuesta de estrategia GTM (${BLOCKS.map((b) => `${b.id} = ${b.label}`).join(", ")}), el C-Level más indicado da su opinión en máximo 40 palabras: qué ajustaría o qué riesgo ve. persona = su nombre. Español neutro, de tú, sin exclamaciones ni emoji.`,
    JSON.stringify({ empresa: c.orgName, moneda: c.currency, propuesta: p }),
    { effort: "low", schema: { name: "c_level_opinions", schema: OPINIONS_SCHEMA } },
  );
  const out = JSON.parse(raw) as { opinions: Opinion[] };
  return (out.opinions ?? []).slice(0, 12);
}
