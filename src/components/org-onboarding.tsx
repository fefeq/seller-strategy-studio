import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { OrgCreateForm } from "@/components/org-create";

export function OrgOnboarding({ memberships, archived = [] }: { memberships: Membership[]; archived?: Membership[] }) {
  const qc = useQueryClient();
  async function pick(orgId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", user!.id);
    if (error) return toast.error(errorText(error));
    await qc.resetQueries();
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="eyebrow">Primer paso</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Crea una empresa</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cada empresa tiene su propia estrategia, cuentas, pipeline y equipo. Podrás crear más y cambiar entre ellas.</p>
        </div>
        <OrgCreateForm orgs={[...memberships, ...archived]} location="onboarding" />
        {memberships.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">O entra en una existente</p>
            {memberships.map((m) => (
              <button key={m.org_id} onClick={() => pick(m.org_id)} className="block w-full break-words border-t py-3 text-left text-sm hover:text-signal">{m.name}</button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Si te han invitado a una empresa, entra con el mismo email de la invitación y aparecerá aquí.</p>
      </div>
    </div>
  );
}
