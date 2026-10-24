import type { Json } from "@/integrations/supabase/types";

/** A jsonb value as a plain object, or null when it is anything else (string, array, number, null). */
export function jsonObject(v: Json | null | undefined): { [key: string]: Json | undefined } | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/** The tool name of a stored suggestion action ({ tool, args }), or null when it has none. */
export function actionTool(action: Json | null | undefined): string | null {
  const t = jsonObject(action)?.tool;
  return typeof t === "string" && t ? t : null;
}
