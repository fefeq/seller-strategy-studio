import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { track } from "@/lib/analytics";
import type { SegmentTemplate } from "@/components/org-switcher";

export function OrgOnboarding({ memberships }: { memberships: Membership[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [segments, setSegments] = useState<SegmentTemplate>("empty");

  async function create() {
    setBusy(true);
    const { error } = await supabase.rpc("create_organization", { _name: name, _segments: segments });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    track("org_created", { location: "onboarding" });
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
        <fieldset className="space-y-2 text-sm">
          <legend className="eyebrow mb-2">Segmentos para empezar</legend>
          {([
            ["template", "Plantilla por tamaño de contrato", "SMB, Mid-market, Enterprise y Strategic, con benchmarks de referencia. Para quien vende desde unos miles al año hacia arriba."],
            ["low_ticket", "Plantilla de ticket bajo", "Self-service y Venta asistida, para contratos de menos de 5.000 al año en tu moneda, con benchmarks públicos y su fuente."],
            ["empty", "Empezar sin segmentos", "Creas los tuyos en la configuración (o los propone la IA). Mejor si tus segmentos no son por tamaño de contrato."],
          ] as const).map(([v, label, help]) => (
            <label key={v} className={`flex cursor-pointer gap-3 border p-3 ${segments === v ? "border-signal" : ""}`}>
              <input type="radio" name="segments" className="mt-1" checked={segments === v} onChange={() => setSegments(v)} />
              <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{help}</span></span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Podrás eliminar o añadir segmentos después en Estrategia.</p>
        </fieldset>
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
