import { z } from "zod";

// Accion del asistente ya confirmada por una persona. Llega del ejecutor del servidor,
// nunca de la pantalla: la empresa sale de la accion confirmada.
export const confirmedAssistantActionSchema = z.object({
  actionId: z.uuid(),
  orgId: z.uuid(),
  action: z.string().trim().min(1).max(200),
  status: z.literal("confirmed"),
  confirmedBy: z.uuid(),
  confirmedAt: z.iso.datetime({ offset: true }),
  summary: z.string().max(2000).default(""),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type ConfirmedAssistantAction = z.infer<typeof confirmedAssistantActionSchema>;

export type ParseResult =
  | { ok: true; value: ConfirmedAssistantAction }
  | { ok: false; reason: string };

export function parseConfirmedAssistantAction(input: unknown): ParseResult {
  const result = confirmedAssistantActionSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, reason: "La acción no está confirmada o le faltan datos" };
  }
  return { ok: true, value: result.data };
}

export type RecordActivityArgs = {
  _action_id: string;
  _org_id: string;
  _action: string;
  _confirmed_by: string;
  _confirmed_at: string;
  _summary: string;
  _details: Record<string, unknown>;
};

export function toRecordActivityArgs(action: ConfirmedAssistantAction): RecordActivityArgs {
  return {
    _action_id: action.actionId,
    _org_id: action.orgId,
    _action: action.action,
    _confirmed_by: action.confirmedBy,
    _confirmed_at: action.confirmedAt,
    _summary: action.summary,
    _details: action.details,
  };
}
