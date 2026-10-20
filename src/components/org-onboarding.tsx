import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";

export function OrgOnboarding({ memberships }: { memberships: Membership[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const { error } = await supabase.rpc("create_organization", { _name: name });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    await qc.resetQueries();
  }
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
        <div className="flex gap-2">
          <Input placeholder="Nombre de la empresa" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || busy} onClick={create}>Crear</Button>
        </div>
        {memberships.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">O entra en una existente</p>
            {memberships.map((m) => (
              <button key={m.org_id} onClick={() => pick(m.org_id)} className="block w-full break-words rounded-md border bg-card p-3 text-left text-sm hover:border-signal">{m.name}</button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Si te han invitado a una empresa, entra con el mismo email de la invitación y aparecerá aquí.</p>
      </div>
    </div>
  );
}
