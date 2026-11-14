// Server side of the LinkedIn legal pause (SDD pausa-legal-linkedin-y-gasto, pieza A): reads the global flag
// with the privileged client before any robotized LinkedIn extraction. A failed read never blocks (A0: extraction active).
import {
  extractionPaused,
  LINKEDIN_FLAG_KEY,
  LINKEDIN_PAUSE_TEXT,
  type LegalFlagRow,
} from "@/lib/linkedin-legal";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

/** True only when a superadmin explicitly paused it. Read failures do not block (fail-open, A0). */
export async function linkedinExtractionPaused(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_legal_flags")
      .select("paused")
      .eq("key", LINKEDIN_FLAG_KEY)
      .maybeSingle();
    if (error) {
      console.error("platform_legal_flags read failed", safeErrorLog(error));
      return false;
    }
    return extractionPaused(data as LegalFlagRow);
  } catch (e) {
    console.error("platform_legal_flags read failed", safeErrorLog(e));
    return false;
  }
}

/** Throws the pause text when the extraction is paused; callers let it reach the person or the agent as-is. */
export async function assertLinkedinExtractionAllowed(): Promise<void> {
  if (await linkedinExtractionPaused())
    throw new Error(
      `${LINKEDIN_PAUSE_TEXT}. La extracción de LinkedIn está detenida hasta completar la revisión legal.`,
    );
}
