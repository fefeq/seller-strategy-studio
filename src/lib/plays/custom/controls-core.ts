import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { activationPatch, checkCustomControl, resultPatch } from "./controls";

export type ControlAction =
  { kind: "toggle"; enabled: boolean } | { kind: "result"; sample: number; successes: number };
export type ControlPorts = {
  load(): Promise<Tables<"custom_plays"> | null>;
  activationCheck(row: Tables<"custom_plays">): Promise<void>;
  save(row: Tables<"custom_plays">, patch: TablesUpdate<"custom_plays">): Promise<void>;
};

export async function controlCustomPlay(
  ports: ControlPorts,
  roles: string[],
  action: ControlAction,
  now: string,
) {
  const access = checkCustomControl(roles, "aprobado", null, false);
  if (!access.ok) throw new Error(access.reason);
  const row = await ports.load();
  if (!row) throw new Error("El play no existe en esta empresa. Actualiza la pantalla.");
  const check = checkCustomControl(
    roles,
    row.status,
    row.execution_pause,
    action.kind === "toggle" && action.enabled,
  );
  if (!check.ok) throw new Error(check.reason);
  if (action.kind === "toggle" && action.enabled) await ports.activationCheck(row);
  const patch =
    action.kind === "toggle"
      ? activationPatch(action.enabled, row.first_activated_at, now)
      : resultPatch(action.sample, action.successes, now);
  await ports.save(row, patch);
  return {
    mensaje:
      action.kind === "result"
        ? "Resultado de prueba guardado."
        : action.enabled
          ? "Play activado para las próximas búsquedas automáticas."
          : "Play pausado. Conserva sus pruebas y resultados.",
  };
}
