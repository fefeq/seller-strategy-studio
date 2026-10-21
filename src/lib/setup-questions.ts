// The follow-up questions the AI returns with a setup proposal used to vanish when the proposal was
// saved or discarded. They become open suggestions (detector setup_question) that only the person
// closes: «Resolver» opens the agent with the question, «Descartar» drops it.

export const SETUP_QUESTION = "setup_question";

/** Stable short hash so the same question asked twice is one suggestion. */
export function questionKey(q: string): string {
  const norm = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  return `${SETUP_QUESTION}:${h.toString(36)}`;
}

export function questionSuggestions(questions: string[]) {
  const seen = new Set<string>();
  return questions
    .map((q) => q.trim())
    .filter((q) => q && !seen.has(questionKey(q)) && seen.add(questionKey(q)))
    .map((q) => ({
      detector: SETUP_QUESTION,
      dedupe_key: questionKey(q),
      priority: 2,
      title: q.length > 160 ? `${q.slice(0, 157)}…` : q,
      body: `${q}\n\nPregunta abierta de la IA al proponer tu configuración. Respóndela con «Resolver» o llévala a Debates si hay que decidir entre varias posturas.`,
      link: "/setup",
      action: null,
      user_id: null,
    }));
}
