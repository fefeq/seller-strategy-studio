// Sends events to Inngest through the Lovable connector gateway (LOVABLE_API_KEY + INNGEST_API_KEY, read
// inside each call) and knows whether Inngest is answering (heartbeat written by the ping function).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { HEARTBEAT_LOCK, isHeartbeatFresh, type NokkoEvent } from "@/lib/inngest/events";

const GATEWAY = "https://connector-gateway.lovable.dev/inngest";
type Admin = SupabaseClient<Database>;

export const inngestConfigured = () =>
  !!(
    process.env["LOVABLE_API_KEY"] &&
    process.env["INNGEST_API_KEY"] &&
    process.env["INNGEST_SIGNING_KEY"]
  );

export async function sendEvents(events: NokkoEvent[]): Promise<void> {
  if (!events.length) return;
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["INNGEST_API_KEY"];
  if (!lovable || !key) throw new Error("Inngest no está conectado en este proyecto.");
  for (let i = 0; i < events.length; i += 100) {
    const res = await fetch(`${GATEWAY}/e/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(events.slice(i, i + 100)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Inngest send failed [${res.status}] body ${body.length} chars`);
      throw new Error(`No se ha podido encolar la tarea en segundo plano [${res.status}].`);
    }
  }
}

/** Sends and never throws: callers keep working without the background (the hourly sweep catches up). */
export async function trySend(events: NokkoEvent[]) {
  if (!inngestConfigured()) return false;
  try {
    await sendEvents(events);
    return true;
  } catch (e) {
    console.error("inngest trySend", (e as Error).message);
    return false;
  }
}

export async function inngestReady(db: Admin, now = new Date()): Promise<boolean> {
  if (!inngestConfigured()) return false;
  const { data } = await db
    .from("job_locks")
    .select("last_run_at")
    .eq("name", HEARTBEAT_LOCK)
    .maybeSingle();
  return isHeartbeatFresh(data?.last_run_at, now);
}

export async function markHeartbeat(db: Admin, now = new Date()) {
  await db
    .from("job_locks")
    .upsert({ name: HEARTBEAT_LOCK, last_run_at: now.toISOString() }, { onConflict: "name" });
}
