// The base rules of a company (SDD-20261110-company-voice-and-escalation-rules, NK-0128): three Nunca, three Siempre and three
// Escalar, written by us and approved by Fede (§9). They are never applied by themselves: an Owner or a Sales Leader adds them
// with an explicit action, and each company edits them afterwards. The pattern is createLibraryCore's (insert what is missing,
// by title), but not its blind read: a failed read here inserts nothing (CA-11), and titles are compared only inside the
// company's Reglas section.
import { BINDING_WRITE_DENIED, canWriteBinding } from "@/lib/knowledge-rules";
import type { Db } from "@/lib/org-data";

export type DefaultRule = { title: string; body: string };

// Literal texts of §9. The titles starting with «Escalar» are read as escalation rules (knowledge-rules.ts, CA-7).
const RULES: readonly DefaultRule[] = [
  {
    title: "Nunca enviar ni publicar",
    body: "nunca envíes, publiques ni cambies datos sin que una persona lo confirme; todo sale como borrador o sugerencia.",
  },
  {
    title: "Nunca inventar",
    body: "nunca inventes cifras, testimonios, nombres ni fechas; si falta un dato, dilo.",
  },
  {
    title: "Nunca exponer datos de clientes",
    body: "nunca pegues textos, correos ni nombres de clientes en ejemplos, borradores ni resúmenes que vaya a leer otra persona.",
  },
  {
    title: "Siempre solo datos de la empresa",
    body: "usa solo lo que está en la empresa; si no está escrito, pregunta.",
  },
  {
    title: "Siempre fuente y fecha",
    body: "cita de dónde sale cada dato y cuándo se publicó.",
  },
  {
    title: "Siempre voz de la empresa",
    body: "redacta con la voz guardada y, ante la duda, más corto.",
  },
  {
    title: "Escalar cuando haya precio, descuento o condiciones",
    body: "si el texto necesita una cifra o condición que no está escrita, para y pregunta a una persona.",
  },
  {
    title: "Escalar ante una queja, un asunto legal o una baja",
    body: "si el contacto reclama, menciona un asunto legal o pide que no le escribas más, para y pasa el caso a una persona.",
  },
  {
    title: "Escalar cuando falte el ICP",
    body: "si no puedes saber si la cuenta encaja, para y pide a una persona que decida.",
  },
];

/** The nine base rules, in order. A fresh copy each call, so nobody changes the shared list. */
export const defaultRules = (): DefaultRule[] => RULES.map((r) => ({ ...r }));

export const DEFAULT_RULES_READ_FAILED =
  "No he podido leer las reglas de tu empresa. No he añadido ninguna regla base; reinténtalo.";
export const DEFAULT_RULES_SAVE_FAILED =
  "No he podido guardar las reglas base. No se ha añadido ninguna; reinténtalo.";

const same = (t: string) => t.trim().toLowerCase();

// Attempts before giving up: the first one can lose a race against another session (unique index of migration 0085); the next
// ones read again and add only what that session did not. Three is plenty: each lost race means somebody else wrote the titles.
const MAX_ATTEMPTS = 3;
// Postgres unique_violation, as PostgREST returns it in error.code.
const UNIQUE_VIOLATION = "23505";

/** Titles of the company's Reglas section (lowercase, trimmed). A failed read throws our text: it is never «nothing exists». */
async function readTitles(c: { db: Db; orgId: string }): Promise<Set<string>> {
  try {
    const { data, error } = await c.db
      .from("knowledge_docs")
      .select("org_id,section,title")
      .eq("org_id", c.orgId)
      .eq("section", "rules");
    if (error) {
      console.error("default rules read failed", "query error");
      throw new Error(DEFAULT_RULES_READ_FAILED);
    }
    // Again in memory: the privileged client does not filter by company.
    return new Set(
      (data ?? [])
        .filter((d) => d.org_id === c.orgId && d.section === "rules")
        .map((d) => same(d.title)),
    );
  } catch (e) {
    if (e instanceof Error && e.message === DEFAULT_RULES_READ_FAILED) throw e;
    console.error("default rules read failed", e instanceof Error ? e.name : "unknown");
    throw new Error(DEFAULT_RULES_READ_FAILED);
  }
}

/**
 * Adds the base rules the company's Reglas section does not have yet (by title), as team documents. Owner and Sales Leader only
 * (the database says the same, migration 0081; the code repeats it for the privileged clients). Safe to repeat, also from two
 * sessions at once (NK-0136): the read-then-insert is not atomic, so migration 0085 makes the database refuse a second team
 * rule with the same title in the company; the session that loses the race gets that refusal, reads again and adds only what is
 * still missing (a batch insert is all or nothing, so the loser wrote nothing). Throws our own Spanish texts, never the
 * database's, and logs no rule text. The company is the caller's active one (trusted context).
 */
export async function addDefaultRulesCore(c: {
  db: Db;
  orgId: string;
  userId: string;
  roles: readonly string[];
}): Promise<{ added: number; titles: string[] }> {
  if (!canWriteBinding(c.roles)) throw new Error(BINDING_WRITE_DENIED);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const have = await readTitles(c);
    const missing = defaultRules().filter((r) => !have.has(same(r.title)));
    if (!missing.length) return { added: 0, titles: [] };
    const { error } = await c.db.from("knowledge_docs").insert(
      missing.map((r) => ({
        org_id: c.orgId,
        section: "rules",
        title: r.title,
        body: r.body,
        scope: "team",
        created_by: c.userId,
        updated_by: c.userId,
      })),
    );
    if (!error) return { added: missing.length, titles: missing.map((r) => r.title) };
    // Not a lost race, or no attempts left: the save failed.
    if (error.code !== UNIQUE_VIOLATION || attempt === MAX_ATTEMPTS) {
      console.error("default rules insert failed", "query error");
      throw new Error(DEFAULT_RULES_SAVE_FAILED);
    }
  }
  throw new Error(DEFAULT_RULES_SAVE_FAILED);
}
