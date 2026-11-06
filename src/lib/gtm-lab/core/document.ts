// From gtm-lab@44f385b packages/core/src/document.ts
import { orderBacklog, type Experiment } from "./experiments";
import { allSteps, type Framework } from "./framework";
import { formFor, type Field } from "./forms";
import { strategyDocReady } from "./progress";
import { formatToolTotal, scoreTool, toolFor, toolIsStale, type ToolRow } from "./tools";

export interface DocumentSpec {
  sections: { id: string; title: string; deliverables: string[] }[];
}

export type DocBlock =
  | { kind: "field"; label: string; text: string }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "ranking"; items: string[] }
  | { kind: "note"; text: string };

export interface DocPart {
  deliverableId: string;
  title: string;
  blocks: DocBlock[];
}

export interface StrategyDoc {
  projectName: string;
  /** ISO date-time given by the caller, so the same data always renders the same text. */
  generatedAt: string;
  complete: boolean;
  sections: { id: string; title: string; parts: DocPart[] }[];
  backlog: { open: string[]; closed: string[] };
  /** Titles of mandatory steps not done yet, in route order. */
  pending: string[];
}

type Saved = ReadonlyMap<string, { status: string; data: Record<string, unknown> }>;

const PROFILE_TITLE = "Perfil del proyecto";
const STATUS_LABEL: Record<Experiment["status"], string> = {
  idea: "Idea",
  running: "En marcha",
  done: "Terminado",
  dropped: "Descartado",
};

/** Checks the `document` section; returns a message naming the id at fault, or null. */
export function documentProblem(framework: Framework): string | null {
  const known = new Set([framework.profile.id, ...allSteps(framework).map((s) => s.deliverable)]);
  const seen = new Set<string>();
  for (const section of framework.document.sections) {
    if (section.deliverables.length === 0) return `Sección "${section.id}" sin entregables`;
    for (const id of section.deliverables) {
      if (!known.has(id))
        return `La sección "${section.id}" usa "${id}", que no es ningún entregable`;
      if (seen.has(id)) return `"${id}" aparece en dos secciones del documento`;
      seen.add(id);
    }
  }
  return null;
}

/** «ICE: 7,7 de 10» or «Sin puntuar»; one decimal, Spanish decimal comma. */
export function formatIce(ice: number | null): string {
  if (ice === null) return "Sin puntuar";
  const rounded = Math.round(ice * 10) / 10;
  return `ICE: ${String(rounded).replace(".", ",")} de 10`;
}

function titleOf(framework: Framework, deliverableId: string): string {
  if (deliverableId === framework.profile.id) return PROFILE_TITLE;
  return allSteps(framework).find((s) => s.deliverable === deliverableId)?.title ?? deliverableId;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function formBlocks(fields: Field[], data: Record<string, unknown>): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const field of fields) {
    const value = data[field.id];
    if (field.type !== "list") {
      if (text(value)) blocks.push({ kind: "field", label: field.label, text: text(value) });
      continue;
    }
    if (!Array.isArray(value)) continue;
    const single = field.fields.length === 1;
    const items = (value as Record<string, unknown>[])
      .map((item) =>
        field.fields
          .filter((sub) => text(item[sub.id]))
          .map((sub) => (single ? text(item[sub.id]) : `${sub.label}: ${text(item[sub.id])}`))
          .join(" · "),
      )
      .filter(Boolean);
    if (items.length) blocks.push({ kind: "list", label: field.label, items });
  }
  return blocks;
}

function partFor(framework: Framework, deliverableId: string, saved: Saved): DocPart | null {
  const own = saved.get(deliverableId);
  if (own?.status !== "done") return null;
  const title = titleOf(framework, deliverableId);
  const tool = toolFor(framework, deliverableId);
  if (tool) {
    if (toolIsStale(framework, deliverableId, saved)) {
      return {
        deliverableId,
        title,
        blocks: [{ kind: "note", text: "Puntuaciones desactualizadas: vuelve a puntuar." }],
      };
    }
    const rows = Array.isArray(own.data.rows) ? (own.data.rows as ToolRow[]) : [];
    if (rows.length === 0)
      return { deliverableId, title, blocks: [{ kind: "note", text: "Hecho, sin puntuaciones." }] };
    const items = scoreTool(tool.spec, rows).map(
      (r) => `${r.item} — ${formatToolTotal(tool.spec, r.total)}`,
    );
    return { deliverableId, title, blocks: [{ kind: "ranking", items }] };
  }
  return {
    deliverableId,
    title,
    blocks: formBlocks(formFor(framework, deliverableId) ?? [], own.data),
  };
}

/** The strategy document, built only from the data it is given (one project), deterministically. */
export function buildStrategyDoc(
  framework: Framework,
  saved: Saved,
  experiments: readonly Experiment[],
  project: { name: string },
  generatedAt: string,
): StrategyDoc {
  const done = new Set([...saved].filter(([, d]) => d.status === "done").map(([id]) => id));
  const { open, closed } = orderBacklog(experiments);
  const mandatory = [
    { deliverable: framework.profile.id, title: PROFILE_TITLE },
    ...allSteps(framework).filter((s) => !s.optional),
  ];
  return {
    projectName: project.name,
    generatedAt,
    complete: strategyDocReady(framework, done),
    sections: framework.document.sections.map((section) => ({
      id: section.id,
      title: section.title,
      parts: section.deliverables.flatMap((id) => partFor(framework, id, saved) ?? []),
    })),
    backlog: {
      open: open.map(({ experiment, ice }) => `${experiment.title} — ${formatIce(ice)}`),
      closed: closed.map(({ experiment }) =>
        [`${experiment.title} — ${STATUS_LABEL[experiment.status]}`, text(experiment.result)]
          .filter(Boolean)
          .join(": "),
      ),
    },
    pending: mandatory.filter((s) => !done.has(s.deliverable)).map((s) => s.title),
  };
}

/**
 * Escapes what the founder wrote so it cannot turn into headings, lists, rules, code blocks, tables, HTML, links or
 * emphasis. Inline: \ ` * _ [ ] # < > | ~. At line start: - + = (lists, rules, setext headings) and the dot or
 * parenthesis after a number (ordered lists).
 */
function escapeMd(value: string): string {
  return value
    .replace(/([\\`*_[\]#<>|~])/g, "\\$1")
    .split("\n")
    .map((line) => line.replace(/^(\s*)([-+=])/, "$1\\$2").replace(/^(\s*\d+)([.)])/, "$1\\$2"))
    .join("\n");
}

/** List entries must stay on one line: a blank line inside would end the list. */
const oneLine = (value: string) => escapeMd(value.replace(/\s*\n+\s*/g, " "));

const paragraphs = (value: string) =>
  escapeMd(value)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");

const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export function renderMarkdown(doc: StrategyDoc): string {
  const out: string[] = [
    `# Documento de estrategia GTM: ${escapeMd(doc.projectName)}`,
    "",
    `_Generado el ${formatDate(doc.generatedAt)}._`,
  ];
  if (!doc.complete) out.push("", "> Borrador: faltan pasos por completar.");

  doc.sections.forEach((section, i) => {
    out.push("", `## ${i + 1}. ${section.title}`);
    if (section.parts.length === 0) out.push("", "_Sin pasos completados en esta sección._");
    for (const part of section.parts) {
      out.push("", `### ${part.title}`);
      for (const block of part.blocks) {
        if (block.kind === "field") out.push("", `**${block.label}**`, "", paragraphs(block.text));
        if (block.kind === "list")
          out.push(
            "",
            `**${block.label}**`,
            "",
            block.items.map((it, n) => `${n + 1}. ${oneLine(it)}`).join("\n"),
          );
        if (block.kind === "ranking")
          out.push("", block.items.map((it, n) => `${n + 1}. ${oneLine(it)}`).join("\n"));
        if (block.kind === "note") out.push("", `_${block.text}_`);
      }
    }
  });

  const n = doc.sections.length;
  out.push("", `## ${n + 1}. Experimentos`);
  if (doc.backlog.open.length === 0 && doc.backlog.closed.length === 0) {
    out.push("", "Todavía no hay experimentos en el backlog.");
  } else {
    out.push(
      "",
      "### Abiertos (por ICE)",
      "",
      doc.backlog.open.length
        ? doc.backlog.open.map((it, i) => `${i + 1}. ${oneLine(it)}`).join("\n")
        : "_Ninguno._",
    );
    out.push(
      "",
      "### Cerrados",
      "",
      doc.backlog.closed.length
        ? doc.backlog.closed.map((it) => `- ${oneLine(it)}`).join("\n")
        : "_Ninguno._",
    );
  }

  out.push(
    "",
    `## ${n + 2}. Pendiente`,
    "",
    doc.pending.length
      ? doc.pending.map((t) => `- ${t}`).join("\n")
      : "Nada pendiente: todos los pasos obligatorios están hechos.",
  );
  return `${out.join("\n")}\n`;
}
