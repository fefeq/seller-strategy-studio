import { describe, expect, it } from "vitest";
import { filterInbox, inboxCounts, mergeInbox, taskPriority, INBOX_FILTERS } from "./today-inbox";

const today = "2026-11-15";
const src = {
  suggestions: [{ id: "1", title: "Llama a Acme", priority: 3, created_at: "2026-11-14" }],
  approvals: [{ id: "2", title: "Descuento 20 %", created_at: "2026-11-13" }],
  tasks: [
    { id: "3", title: "Enviar propuesta", due_date: "2026-11-15", created_at: "2026-11-01" },
    { id: "4", title: "Sin fecha", due_date: null, created_at: "2026-11-01" },
  ],
  actions: [{ id: "5", summary: "Buscar empresas en Clay", created_at: "2026-11-15T08:00" }],
};

describe("B3 unified inbox", () => {
  it("four kind filters plus Todo", () => {
    expect(INBOX_FILTERS.map((f) => f.id)).toEqual(["todo", "sugerencia", "aprobacion", "tarea", "agente"]);
  });
  it("merges every source, urgent first", () => {
    const m = mergeInbox(src, today);
    expect(m).toHaveLength(5);
    expect(m.slice(0, 3).every((i) => i.priority === 1)).toBe(true);
    expect(m.at(-1)!.priority).toBe(3);
  });
  it("each kind links to the screen that decides it", () => {
    const m = mergeInbox(src, today);
    expect(m.find((i) => i.kind === "aprobacion")!.href).toBe("/approvals");
    expect(m.find((i) => i.kind === "tarea")!.href).toBeNull();
  });
  it("filters and counts", () => {
    const m = mergeInbox(src, today);
    expect(filterInbox(m, "tarea")).toHaveLength(2);
    expect(filterInbox(m, "todo")).toHaveLength(5);
    expect(inboxCounts(m)).toEqual({ todo: 5, sugerencia: 1, aprobacion: 1, tarea: 2, agente: 1 });
  });
  it("task due today or overdue is urgent; no date is when you can", () => {
    expect(taskPriority("2026-11-10", today)).toBe(1);
    expect(taskPriority("2026-11-20", today)).toBe(2);
    expect(taskPriority(null, today)).toBe(3);
  });
});
