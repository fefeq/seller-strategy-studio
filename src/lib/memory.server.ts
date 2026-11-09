// Memory I/O (server only): load what applies to a user, learn new facts from a chat/meeting with the AI,
// and save facts (dedupe/replace via the pure rules in memory.ts). Every query filters by org explicitly
// because Telegram and jobs run with the privileged client.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { ask } from "@/lib/ai-gateway";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { decisionMemory, memoryPrompt, mergeFacts, relevantMemories, type Fact, type Memory } from "@/lib/memory";

const COLS = "id,scope,kind,content,user_id,account_id,pinned,learned,source,updated_at";

async function activeFor(c: ToolCtx, accountIds: string[] = []) {
  const { data } = await c.db.from("memories").select(COLS).eq("org_id", c.orgId).eq("active", true).order("updated_at", { ascending: false }).limit(400);
  // RLS hides others' personal memories in the app; the privileged path filters here too.
  return ((data ?? []) as Memory[]).filter((m) => m.scope !== "user" || m.user_id === c.userId).filter((m) => m.scope !== "account" || !accountIds.length || accountIds.includes(m.account_id!));
}

/** The memory block for the agent prompt (empty when nothing is remembered). */
export async function memoryBlock(c: ToolCtx, accountIds: string[] = []) {
  try {
    const all = await activeFor(c);
    // Without a specific account in play, the most recent account memories still help.
    const ids = accountIds.length ? accountIds : [...new Set(all.filter((m) => m.scope === "account").slice(0, 8).map((m) => m.account_id!))];
    const list = relevantMemories(all, { userId: c.userId, accountIds: ids });
    const accIds = [...new Set(list.map((m) => m.account_id).filter(Boolean))] as string[];
    const { data: accs } = accIds.length ? await c.db.from("accounts").select("id,name").eq("org_id", c.orgId).in("id", accIds) : { data: [] };
    return memoryPrompt(list, Object.fromEntries((accs ?? []).map((a: { id: string; name: string }) => [a.id, a.name])));
  } catch (e) {
    console.error("memory load failed", safeErrorLog(e));
    return "";
  }
}

export async function saveFacts(c: ToolCtx, facts: Fact[], source: string, existing?: Memory[]) {
  if (!facts.length) return { added: 0, replaced: 0 };
  const current = existing ?? (await activeFor(c));
  const { insert, supersede } = mergeFacts(current, facts);
  const row = (f: Fact) => ({ org_id: c.orgId, user_id: c.userId, scope: f.scope, kind: f.kind, account_id: f.scope === "account" ? f.account_id : null, content: f.content, source, learned: true });
  if (insert.length) {
    const { error } = await c.db.from("memories").insert(insert.filter((f) => f.scope !== "account" || f.account_id).map(row));
    if (error) console.error("memory insert failed", error.message);
  }
  for (const s of supersede) {
    const { data, error } = await c.db.from("memories").insert({ ...row(s.fact), supersedes: s.oldId }).select("id").single();
    if (error || !data) { console.error("memory replace failed", error?.message); continue; }
    await c.db.from("memories").update({ active: false, updated_at: new Date().toISOString() }).eq("id", s.oldId).eq("org_id", c.orgId);
  }
  return { added: insert.length, replaced: supersede.length };
}

const SCHEMA = {
  name: "memory_facts",
  schema: {
    type: "object", additionalProperties: false, required: ["facts"],
    properties: {
      facts: {
        type: "array", maxItems: 6,
        items: {
          type: "object", additionalProperties: false, required: ["content", "scope", "kind", "account_id", "replaces"],
          properties: {
            content: { type: "string" },
            scope: { type: "string", enum: ["company", "user", "account"] },
            kind: { type: "string", enum: ["business", "preference", "account", "outcome", "task"] },
            account_id: { type: ["string", "null"] },
            replaces: { type: ["integer", "null"] },
          },
        },
      },
    },
  },
};

const SYSTEM = `Extraes recuerdos duraderos para el copiloto comercial Nokko. Español neutro, frases cortas en tercera persona, cada una autocontenida.
Guarda SOLO lo que seguirá siendo cierto y útil dentro de semanas:
- company/business: hechos del negocio (a quién vendemos, precios, competidores, reglas internas, decisiones).
- user/preference: cómo quiere trabajar ESTE usuario (tono, formato, horarios, en qué se centra).
- account/account: hechos de una cuenta concreta (stakeholders, objeciones, presupuesto, competencia, compromisos). Usa el account_id que te doy; si no hay, no uses scope account.
- company|account/outcome: lo que funcionó o no.
- company|account/task: compromisos con responsable o fecha.
NO guardes: saludos, preguntas, cifras que Nokko ya calcula (pipeline, métricas), datos de contacto, nada inventado ni deducido.
Si un hecho contradice o actualiza uno de los recuerdos numerados, pon replaces = su número. Si ya está, no lo repitas. Si no hay nada nuevo, devuelve facts vacío.`;

/** Learns from a piece of conversation or notes. Never throws: memory must not break the main flow. */
export async function learnFrom(c: ToolCtx, a: { source: "chat" | "meeting" | "decision"; text: string; accountId?: string | null; accountName?: string | null }) {
  const text = a.text.trim();
  if (text.length < 40) return { added: 0, replaced: 0 };
  try {
    const existing = (await activeFor(c, a.accountId ? [a.accountId] : [])).slice(0, 60);
    const list = existing.map((m, i) => `${i + 1}. [${m.scope}/${m.kind}] ${m.content}`).join("\n") || "(ninguno)";
    const acc = a.accountId ? `Cuenta en juego: ${a.accountName ?? "sin nombre"} (account_id ${a.accountId}).` : "No hay una cuenta concreta en juego.";
    const raw = await ask(SYSTEM, `${acc}\nRecuerdos actuales:\n${list}\n\nTexto (${a.source}):\n${text.slice(0, 8000)}`, { schema: SCHEMA, effort: "low" });
    const facts = ((JSON.parse(raw) as { facts: Fact[] }).facts ?? []).map((f) => ({ ...f, account_id: f.scope === "account" ? (a.accountId ?? null) : null }));
    return await saveFacts(c, facts.filter((f) => f.scope !== "account" || f.account_id), a.source, existing);
  } catch (e) {
    console.error("memory learn failed", safeErrorLog(e));
    return { added: 0, replaced: 0 };
  }
}

/** Remembers how a suggestion was decided (no AI). */
export async function rememberDecision(c: ToolCtx, s: { title: string; account_id?: string | null }, decision: "approve" | "dismiss") {
  try { await saveFacts(c, [decisionMemory(s, decision)], "suggestion"); } catch (e) { console.error("memory decision failed", safeErrorLog(e)); }
}
