// Conexiones card for the LinkedIn legal pause (SDD pieza A): everyone sees the state; only a platform
// superadmin can resume or pause it again (RPC set_platform_legal_flag re-checks it server-side).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";
import { LINKEDIN_FLAG_KEY, LINKEDIN_PAUSE_TEXT } from "@/lib/linkedin-legal";
import { useLinkedinLegalPause } from "@/hooks/use-linkedin-legal";

export function LinkedinLegalCard() {
  const { paused, reason, refetch } = useLinkedinLegalPause();
  const [busy, setBusy] = useState(false);
  const { data: isSuperadmin = false } = useQuery({
    queryKey: ["am-platform-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_admins").select("user_id").maybeSingle();
      if (error) throw error;
      return !!data;
    },
    staleTime: 300_000,
  });

  async function toggle() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_platform_legal_flag", {
        _key: LINKEDIN_FLAG_KEY,
        _paused: !paused,
      });
      if (error) throw error;
      toast.success(
        paused
          ? "Extracción de LinkedIn reanudada."
          : "Extracción de LinkedIn en pausa de nuevo.",
      );
      await refetch();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words font-medium">Extracción de LinkedIn</span>
        <span
          className={`shrink-0 rounded px-1.5 font-mono text-xs uppercase ${paused ? "bg-warning/25" : "bg-success/15 text-success"}`}
        >
          {paused ? "En pausa" : "Activa"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {paused
          ? (reason ?? LINKEDIN_PAUSE_TEXT) +
            " Las reseñas de G2 siguen disponibles y las fuentes de LinkedIn ya guardadas se conservan."
          : "La extracción de LinkedIn está autorizada. Si la revisión legal lo pide, vuelve a ponerla en pausa."}
      </p>
      {isSuperadmin && (
        <Button size="sm" variant="outline" className="mt-3" onClick={toggle} disabled={busy}>
          {busy ? "Guardando…" : paused ? "Reanudar tras la revisión legal" : "Volver a pausar"}
        </Button>
      )}
    </div>
  );
}
