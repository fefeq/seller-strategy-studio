// What the proactive Telegram messages say and offer for a suggestion (urgent notice and daily digest). Pure: the route only fetches
// rows and sends. Nothing here talks to the database or to Telegram.
import { actionTool } from "@/lib/json";
import type { Json } from "@/integrations/supabase/types";
import { needsExecuteForm } from "@/lib/strategy-suggestions";

export type Button = { text: string; data: string };
export type UrgentRow = {
  id: string;
  title: string;
  body: string;
  action: Json | null;
  strategy: unknown;
};
export type DigestRow = { id: string; title: string; strategy: unknown };

export function urgentMessage(s: UrgentRow): { text: string; buttons: Button[][] } {
  // A test or a commercial action is accepted with its form, which only the app has (NK-0041): no way to accept it from here.
  if (needsExecuteForm(s.strategy))
    return {
      text: `${s.title}\n${s.body}\nComplétala en Sugerencias.`,
      buttons: [
        [
          { text: "En 3 días", data: `s:${s.id}:snooze` },
          { text: "Descartar", data: `s:${s.id}:dismiss` },
        ],
      ],
    };
  return {
    text: `${s.title}\n${s.body}`,
    buttons: [
      [
        { text: actionTool(s.action) ? "Aprobar y hacer" : "Hecho", data: `s:${s.id}:approve` },
        { text: "En 3 días", data: `s:${s.id}:snooze` },
        { text: "Descartar", data: `s:${s.id}:dismiss` },
      ],
    ],
  };
}

export function digestMessage(
  top: DigestRow[],
  name: string,
): { text: string; buttons: Button[][] } {
  const hello = `Buenos días${name ? `, ${name}` : ""}`;
  return {
    text: top.length
      ? `${hello}. 3 cosas para hoy:\n\n${top.map((t, i) => `${i + 1}. ${t.title}${needsExecuteForm(t.strategy) ? " (se completa en Sugerencias)" : ""}`).join("\n")}\n\nPulsa para gestionarlas o pregúntame lo que quieras.`
      : `${hello}. Nada urgente hoy. ¿En qué te ayudo?`,
    buttons: top.map((t, i) => [
      ...(needsExecuteForm(t.strategy)
        ? []
        : [{ text: `Hecho ${i + 1}`, data: `s:${t.id}:approve` }]),
      { text: `Posponer ${i + 1}`, data: `s:${t.id}:snooze` },
    ]),
  };
}
