// Business memory: pure rules (tested in memory.test.ts). What Nokko remembers about the company, each user and
// each account; how new facts merge with old ones; which memories enter a prompt.

export type MemScope = "company" | "user" | "account";
export type MemKind = "business" | "preference" | "account" | "outcome" | "task";
export type Memory = {
  id: string;
  scope: MemScope;
  kind: MemKind;
  content: string;
  user_id: string | null;
  account_id: string | null;
  pinned: boolean;
  learned: boolean;
  source: string;
  updated_at: string;
};
export type Fact = {
  content: string;
  scope: MemScope;
  kind: MemKind;
  account_id: string | null;
  replaces: number | null;
};

export const KIND_LABEL: Record<MemKind, string> = {
  business: "Negocio",
  preference: "Preferencia",
  account: "Cuenta",
  outcome: "Resultado",
  task: "Tarea",
};
export const SOURCE_LABEL: Record<string, string> = {
  chat: "chat",
  meeting: "reunión",
  decision: "decisión",
  suggestion: "sugerencia",
  manual: "escrito a mano",
};

const STOP = new Set(
  "el la los las un una unos unas de del al y o a en por para con sin que se su sus es son lo le les nos mi tu the of and to in".split(
    " ",
  ),
);
function words(s: string) {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** Same fact said differently: word overlap (Jaccard) of at least 0.6. */
export function sameFact(a: string, b: string) {
  const A = words(a),
    B = words(b);
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter) >= 0.6;
}

/** Decides what to do with extracted facts: replace the numbered old one, skip duplicates, insert the rest. */
export function mergeFacts(
  existing: Pick<Memory, "id" | "content" | "scope" | "account_id">[],
  facts: Fact[],
) {
  const insert: Fact[] = [];
  const supersede: { oldId: string; fact: Fact }[] = [];
  const seen: string[] = [];
  for (const f of facts) {
    const content = f.content.trim().replace(/\s+/g, " ").slice(0, 600);
    if (content.length < 3) continue;
    const fact = { ...f, content };
    const old = f.replaces != null ? existing[f.replaces - 1] : undefined;
    if (old) {
      if (!supersede.some((x) => x.oldId === old.id)) supersede.push({ oldId: old.id, fact });
      seen.push(content);
      continue;
    }
    if (seen.some((s) => sameFact(s, content))) continue;
    seen.push(content);
    if (
      existing.some(
        (e) => sameFact(e.content, content) && (e.account_id ?? null) === (fact.account_id ?? null),
      )
    )
      continue;
    insert.push(fact);
  }
  return { insert, supersede };
}

/** Memories that apply to this user (and accounts in play): pinned first, then company, own, accounts; newest first; capped. */
export function relevantMemories(
  all: Memory[],
  who: { userId: string; accountIds?: string[] },
  maxChars = 3500,
) {
  const accounts = new Set(who.accountIds ?? []);
  const fits = (m: Memory) =>
    m.scope === "company" ||
    (m.scope === "user" && m.user_id === who.userId) ||
    (m.scope === "account" && !!m.account_id && accounts.has(m.account_id));
  const rank = (m: Memory) =>
    m.pinned ? 0 : m.scope === "user" ? 1 : m.scope === "account" ? 2 : 3;
  const out: Memory[] = [];
  let size = 0;
  for (const m of all
    .filter(fits)
    .sort((a, b) => rank(a) - rank(b) || b.updated_at.localeCompare(a.updated_at))) {
    if (size + m.content.length > maxChars) continue;
    out.push(m);
    size += m.content.length;
  }
  return out;
}

/** The block the agent reads before answering. */
export function memoryPrompt(list: Memory[], accountNames: Record<string, string> = {}) {
  if (!list.length) return "";
  const line = (m: Memory) =>
    `- ${m.scope === "account" && m.account_id ? `[${accountNames[m.account_id] ?? "cuenta"}] ` : ""}${m.content}`;
  const group = (title: string, xs: Memory[]) =>
    xs.length ? `${title}:\n${xs.map(line).join("\n")}` : "";
  return [
    "MEMORIA (lo que Nokko sabe; respétalo, no repitas lo descartado, no lo cites como fuente):",
    group(
      "Siempre tener en cuenta",
      list.filter((m) => m.pinned),
    ),
    group(
      "Preferencias de este usuario",
      list.filter((m) => !m.pinned && m.scope === "user"),
    ),
    group(
      "Empresa",
      list.filter((m) => !m.pinned && m.scope === "company"),
    ),
    group(
      "Cuentas",
      list.filter((m) => !m.pinned && m.scope === "account"),
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Outcome of a suggestion decision, remembered without AI. Snoozes are not remembered. */
export function decisionMemory(
  s: { title: string; account_id?: string | null },
  decision: "approve" | "dismiss",
): Fact {
  const verb = decision === "dismiss" ? "Descartado por el equipo" : "Aprobado y hecho";
  return {
    content: `${verb}: ${s.title}`.slice(0, 600),
    scope: s.account_id ? "account" : "company",
    kind: "outcome",
    account_id: s.account_id ?? null,
    replaces: null,
  };
}

/** Who may edit a memory: its author, or Owner/Sales Leader for shared (non-personal) ones. */
export function canEditMemory(
  m: Pick<Memory, "scope" | "user_id">,
  userId: string,
  roles: string[],
) {
  if (m.user_id === userId) return true;
  return m.scope !== "user" && roles.some((r) => r === "owner" || r === "sales_leader");
}
