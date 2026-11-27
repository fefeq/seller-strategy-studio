import { createClient } from "@supabase/supabase-js";
import { parseConfirmedAssistantAction, toRecordActivityArgs } from "./assistant-activity";

// Llamar solo desde el servidor, despues de ejecutar una accion ya confirmada.
// Nunca pasar datos que vengan de la pantalla: la accion debe leerse de la base.
export async function recordConfirmedAssistantAction(input: unknown): Promise<string> {
  const parsed = parseConfirmedAssistantAction(input);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("No se pudo guardar el registro de actividad");
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.rpc("record_assistant_activity", toRecordActivityArgs(parsed.value));
  if (error || typeof data !== "string") {
    throw new Error("No se pudo guardar el registro de actividad");
  }
  return data;
}
