// The positioning statement is assembled from fragments («Para X que Y, P es Z que W…»). The AI and
// people tend to fill each slot with a full sentence, which broke the statement («…secundario. que
// Convertir…»). These helpers turn a slot into a fragment that fits, and say which slot goes where.

export const STATEMENT_SLOTS: Record<string, { before: string; after: string }> = {
  target_customer: { before: "Para", after: "que…" },
  need: { before: "…que", after: "," },
  product_name: { before: ",", after: "es…" },
  category: { before: "…es", after: "que…" },
  key_benefit: { before: "…que", after: "." },
  competitive_alternative: { before: "A diferencia de", after: "," },
  differentiator: { before: "nosotros", after: "." },
};

/** «Convierte conocimiento en posts.» → «convierte conocimiento en posts». Keeps acronyms and names (B2B, LinkedIn). */
export function statementFragment(raw: string | null | undefined): string {
  let t = (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.;:!]+$/u, "")
    .trim();
  const first = t.split(" ")[0] ?? "";
  // Lowercase a capitalised first word («Convertir»), never one with capitals inside (LinkedIn, B2B).
  if (/^\p{Lu}\p{Ll}/u.test(first) && !/\p{Lu}/u.test(first.slice(1)))
    t = t[0].toLocaleLowerCase("es") + t.slice(1);
  return t;
}

export function positioningStatement(
  f: Record<string, string | null | undefined>,
  placeholder: (k: string) => string,
): string {
  const v = (k: string) =>
    (k === "product_name" ? (f[k] ?? "").trim() : statementFragment(f[k])) || placeholder(k);
  return `Para ${v("target_customer")} que ${v("need")}, ${v("product_name")} es ${v("category")} que ${v("key_benefit")}. A diferencia de ${v("competitive_alternative")}, nosotros ${v("differentiator")}.`;
}

/** Copy that can leave the company (web, ads, posts) and therefore needs an explicit approval. */
export const PUBLIC_COPY_FIELDS = [
  "tagline",
  "one_liner",
  "short_pitch",
  "elevator_pitch",
] as const;

export type CopyStatus = Record<string, { status: "approved"; by: string | null; at: string }>;

/** Approvals of copy whose text changed are dropped: a new text is a draft again. */
export function keepApprovals(
  status: CopyStatus | null | undefined,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): CopyStatus {
  const out: CopyStatus = {};
  for (const [k, v] of Object.entries(status ?? {}))
    if ((before[k] ?? "") === (after[k] ?? "")) out[k] = v;
  return out;
}
