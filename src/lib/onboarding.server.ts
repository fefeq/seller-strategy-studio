// «Nokko lee» (onboarding_read background job): reads the founder's sources, writes each finding with its source to
// the onboarding session as it goes (the screen shows it as a live ticker), proposes the strategy and, in «A fondo»,
// adds market and competitors and a short C-Levels opinion per block. Respects the monthly budget.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Json } from "@/integrations/supabase/types";
import { BLOCKS, proposalFindings, type Depth, type Finding, type Opinion } from "@/lib/onboarding";
import { MAX_FILES } from "@/lib/onboarding-files-limit";
import type { SetupProposal } from "@/lib/setup-extraction";
import {
  allotBudget,
  ownsPath,
  statusOf,
  statusLabel,
  type SourceRef,
  type SourceStatus,
} from "@/lib/onboarding-source-refs";
import { MAX_SOURCES } from "@/lib/onboarding-files-limit";

type Ctx = ToolCtx & { orgName: string };
type Input = {
  depth?: Depth;
  url?: string;
  text?: string;
  files?: { filename: string; dataUrl: string }[];
  sources?: SourceRef[];
};

const OPINIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["opinions"],
  properties: {
    opinions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["block", "persona", "text"],
        properties: {
          block: { type: "string", enum: BLOCKS.map((b) => b.id) },
          persona: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
};

export async function runOnboardingRead(c: Ctx, input: Input, step: (s: string) => Promise<void>) {
  const { monthBudget, logUsage } = await import("@/lib/orchestrator/runner");
  const depth: Depth = input.depth ?? "express";
  const url = String(input.url ?? "").trim();
  const text = String(input.text ?? "").slice(0, 40_000);
  const files = (input.files ?? []).slice(0, MAX_FILES);

  const b = await monthBudget(c);
  if (b.paused)
    throw new Error(
      "Has llegado al límite mensual de gasto en fuentes. Súbelo en Conexiones o espera al mes que viene.",
    );

  // A new reading starts clean: the previous proposal and block decisions belong to the previous sources.
  await c.db
    .from("onboarding_sessions")
    .update({
      findings: [] as unknown as Json,
      proposal: null,
      opinions: null,
      block_status: {} as unknown as Json,
      source_status: [] as unknown as Json,
    })
    .eq("org_id", c.orgId)
    .eq("user_id", c.userId);
  const findings: Finding[] = [];
  const note = async (t: string, source: string | null) => {
    findings.push({ at: new Date().toISOString(), text: t.slice(0, 300), source });
    await c.db
      .from("onboarding_sessions")
      .update({ findings: findings as unknown as Json, updated_at: new Date().toISOString() })
      .eq("org_id", c.orgId)
      .eq("user_id", c.userId);
  };
  await note("Empiezo a leer tus fuentes", null);

  let site = "";
  if (url) {
    await step("Leyendo tu web");
    const host = (() => {
      try {
        return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname;
      } catch {
        return url;
      }
    })();
    const { readSite } = await import("@/lib/setup-extract.server");
    site = await readSite(url).catch(async (e) => {
      await note(`Sin acceso a la web: ${(e as Error).message}`, host);
      return "";
    });
    if (site) {
      await note(
        `Leída tu web (${Math.round(site.length / 1000)} mil caracteres)`,
        `Web · ${host}`,
      );
      await logUsage(c, "research_account", [{ service: "firecrawl", cost: 0.02 }], "manual");
    }
  }
  if (text.trim()) {
    const named = [...text.matchAll(/--- (.+?) ---/g)].map((m) => m[1]);
    await note(
      named.length ? `Leído: ${named.join(", ")}` : "Leído el texto que pegaste",
      named.length ? named.join(", ") : "Texto pegado",
    );
  }
  for (const f of files) await note(`Leyendo el documento ${f.filename}`, f.filename);

  // Documents by reference: downloaded and extracted here, then cut to a fair share of one global budget.
  const refs = (input.sources ?? []).slice(0, MAX_SOURCES);
  const statuses: SourceStatus[] = [];
  let docs = "";
  if (refs.length) {
    await step(`Leyendo ${refs.length} ${refs.length === 1 ? "documento" : "documentos"}`);
    const texts: { s: SourceRef; text: string; reason?: string }[] = [];
    for (const s of refs) {
      try {
        texts.push({ s, text: await extractSource(c, s) });
      } catch (e) {
        texts.push({ s, text: "", reason: e instanceof Error ? e.message : "no se pudo leer" });
      }
    }
    const allowed = allotBudget(texts.map((t) => t.text.length));
    texts.forEach((t, i) => {
      const st = statusOf(t.s, allowed[i], t.text.length, t.reason ?? (t.text ? undefined : "está vacío"));
      statuses.push(st);
      if (allowed[i] > 0) docs += `\n\n--- ${t.s.name} ---\n${t.text.slice(0, allowed[i])}`;
    });
    for (const st of statuses) await note(`${st.name}: ${statusLabel(st)}`.slice(0, 300), st.name);
    await c.db
      .from("onboarding_sessions")
      .update({ source_status: statuses as unknown as Json })
      .eq("org_id", c.orgId)
      .eq("user_id", c.userId);
  }

  let extra = "";
  if (depth === "deep") {
    await step("Mercado y competidores");
    const { searchBoth } = await import("@/lib/web-search");
    // The brand on the web beats the company name typed in Nokko (often a placeholder) for a market search.
    const brand =
      (() => {
        try {
          return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname
            .replace(/^www\./, "")
            .split(".")[0];
        } catch {
          return "";
        }
      })() || c.orgName;
    const items = await searchBoth(
      { query: `${brand} competidores alternativas`, limit: 8, sources: ["web"] },
      { queries: [`${brand} competitors`, `${brand} alternatives market`], maxResults: 5 },
      10,
    ).catch(async (e) => {
      await note(`No he podido buscar mercado y competidores: ${(e as Error).message}`, null);
      return [];
    });
    for (const it of items.slice(0, 6))
      await note(`Fuente de mercado: ${it.title}`, it.url ?? null);
    extra = items
      .map((it) => `${it.title}: ${it.snippet ?? ""} (${it.url ?? ""})`)
      .join("\n")
      .slice(0, 12_000);
    if (items.length)
      await logUsage(
        c,
        "competitors",
        [
          { service: "firecrawl", cost: 0.02 },
          { service: "perplexity", cost: 0.01 },
        ],
        "manual",
      );
  }

  await step("Proponiendo tu estrategia");
  const { extractSetupCore } = await import("@/lib/setup-extract.server");
  const proposal = await extractSetupCore(c, { url, site, text: (text + docs).trim(), files, extra });
  for (const f of proposalFindings(proposal)) await note(f.text, f.source);

  let opinions: Opinion[] = [];
  if (depth === "deep") {
    await step("Debate de los C-Levels");
    opinions = await cLevelOpinions(c, proposal).catch(async (e) => {
      await note(`El debate de los C-Levels no respondió: ${(e as Error).message}`, null);
      return [];
    });
    if (opinions.length)
      await note(`Los C-Levels han opinado sobre ${opinions.length} bloques`, "Debate C-Levels");
  }

  // The AI's open questions wait in Sugerencias until someone answers or drops them.
  const { questionSuggestions } = await import("@/lib/setup-questions");
  const rows = questionSuggestions(proposal.questions ?? []).map((r) => ({
    ...r,
    org_id: c.orgId,
  }));
  if (rows.length)
    await c.db
      .from("suggestions")
      .upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });

  await note("Listo: tu propuesta está preparada para revisarla bloque a bloque", null);
  await c.db
    .from("onboarding_sessions")
    .update({
      proposal: proposal as unknown as Json,
      opinions: opinions as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", c.orgId)
    .eq("user_id", c.userId);
  return {
    title: "Tu propuesta de estrategia está lista: revísala bloque a bloque",
    body: proposal.summary.slice(0, 300),
    link: "/onboarding",
    needs_decision: true,
    findings: findings.length,
  };
}

/** Text of one referenced source. Storage paths must sit in the caller's own folder; Drive keeps the company-folder rule. */
async function extractSource(c: Ctx, s: SourceRef): Promise<string> {
  if (s.kind === "drive") {
    const { readFile } = await import("@/lib/drive-core");
    const r = await readFile({ db: c.db, orgId: c.orgId, userId: c.userId }, s.ref);
    return r.text;
  }
  if (!ownsPath(s.ref, c.orgId, c.userId)) throw new Error("el archivo no es de esta empresa");
  const { data, error } = await c.db.storage.from("onboarding-sources").download(s.ref);
  if (error || !data) throw new Error("no se encontró el archivo subido");
  if (!/\.pdf$/i.test(s.ref)) return await data.text();
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const { ask } = await import("@/lib/ai-gateway");
  return ask(
    "Transcribe el documento a Markdown fiel al original: títulos, listas y tablas. No resumas, no comentes, no añadas nada. Si una página es solo imagen, describe en una línea lo que muestra.",
    `Documento: ${s.name}`,
    { effort: "low", files: [{ filename: s.name, dataUrl: `data:application/pdf;base64,${btoa(bin)}` }] },
  );
}

async function cLevelOpinions(c: Ctx, p: SetupProposal): Promise<Opinion[]> {
  const { ask } = await import("@/lib/ai-gateway");
  const { DEBATE_LEVELS } = await import("@/lib/bmad/teams");
  const { getPersona } = await import("@/lib/bmad/personas");
  const people = DEBATE_LEVELS.c_level.participants
    .map((id) => getPersona(id))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const raw = await ask(
    `Eres la mesa de C-Levels de Nokko: ${people.map((x) => `${x.name} (${x.title}; foco: ${x.focus})`).join("; ")}. Para cada bloque de esta propuesta de estrategia GTM (${BLOCKS.map((b) => `${b.id} = ${b.label}`).join(", ")}), el C-Level más indicado da su opinión en máximo 40 palabras: qué ajustaría o qué riesgo ve. persona = su nombre. Español neutro, de tú, sin exclamaciones ni emoji.`,
    JSON.stringify({ empresa: c.orgName, moneda: c.currency, propuesta: p }),
    { effort: "low", schema: { name: "c_level_opinions", schema: OPINIONS_SCHEMA } },
  );
  const out = JSON.parse(raw) as { opinions: Opinion[] };
  return (out.opinions ?? []).slice(0, 12);
}
