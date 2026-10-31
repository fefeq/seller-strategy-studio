import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";

/** Signed in without a current company: joins the first one they belong to, or explains how to get invited. */
export function OrgOnboarding({ memberships }: { memberships: Membership[] }) {
  const qc = useQueryClient();
  const tried = useRef(false);
  const first = memberships[0];

  useEffect(() => {
    if (!first || tried.current) return;
    tried.current = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({ current_org_id: first.org_id }).eq("id", user!.id);
      if (error) return toast.error(errorText(error));
      await qc.resetQueries();
    })();
  }, [first, qc]);

  if (first) return null;
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md space-y-3">
        <p className="eyebrow">Sin acceso</p>
        <h1 className="text-4xl sm:text-5xl">Aún no tienes empresa</h1>
        <p className="text-sm text-muted-foreground">Nokko es una herramienta interna. Pide a un owner que te invite desde Equipo y entra con el mismo email de la invitación.</p>
      </div>
    </div>
  );
}
