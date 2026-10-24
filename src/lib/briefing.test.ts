import { describe, expect, it } from "vitest";
import { autoWork, todayItems } from "./briefing";

const money = (n: number) => `${n.toFixed(2)} €`;
const since = "2026-10-23T00:00:00.000Z";

describe("briefing", () => {
  it("counts only what Nokko did on its own since yesterday", () => {
    const items = autoWork({
      since,
      usage: [
        { trigger: "automatic", need: "enrich_account", cost: 0.02, created_at: "2026-10-24T08:00:00Z" },
        { trigger: "manual", need: "enrich_account", cost: 0.5, created_at: "2026-10-24T08:00:00Z" },
        { trigger: "automatic", need: "enrich_account", cost: 0.02, created_at: "2026-10-20T08:00:00Z" },
      ],
      leads: [{ enriched_at: "2026-10-24T09:00:00Z" }, { enriched_at: null }],
      memories: [{ learned: true, created_at: "2026-10-24T09:00:00Z" }, { learned: false, created_at: "2026-10-24T09:00:00Z" }],
      signals: [], suggestions: [{ created_at: "2026-10-24T09:00:00Z", detector: "lead_enriched" }], jobs: [],
    }, money);
    expect(items.map((i) => i.text)).toEqual([
      "Preparé 1 lead nuevo: su cuenta, sus datos, las personas clave y una propuesta de etapa.",
      "Completé los datos de 1 cuenta (gasto automático: 0.02 €).",
      "Aprendí 1 cosa nueva sobre el negocio y el equipo.",
    ]);
  });
  it("is empty when nothing happened", () => {
    expect(autoWork({ since, usage: [], leads: [], memories: [], signals: [], suggestions: [], jobs: [] }, money)).toEqual([]);
  });
  it("shows a salesperson only their own (or unassigned) work for today", () => {
    const base = {
      today: "2026-10-24", userId: "me", meetings: [],
      tasks: [{ title: "Llamar a Ana", due_date: "2026-10-23", done: false, owner_id: "me" }, { title: "De otro", due_date: "2026-10-24", done: false, owner_id: "other" }],
      deals: [{ name: "Acme", close_date: "2026-10-24", owner_id: "other", stage: "demo", closed: false }],
      leads: [{ company: "Typeform", next_step_at: "2026-10-24", owner_id: "me", stage: "contacted" }],
    };
    expect(todayItems({ ...base, leader: false }).map((i) => i.text)).toEqual([
      "1 tarea para hoy, 1 con retraso: Llamar a Ana",
      "1 seguimiento de lead: Typeform",
    ]);
    expect(todayItems({ ...base, leader: true }).some((i) => i.text.includes("Acme"))).toBe(true);
  });
});
