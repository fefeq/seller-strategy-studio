// «Nueva empresa»: one form for the switcher and the first screen. Name, web, currency and starting
// segments at once; warns before creating a company you already have; then opens Onboarding.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/fields";
import { CURRENCIES } from "@/lib/money";
import { similarOrg } from "@/lib/org-match";
import { errorText } from "@/lib/errors";
import { track } from "@/lib/analytics";
import type { Membership } from "@/hooks/use-me";

export type SegmentTemplate = "template" | "low_ticket" | "empty";
const SEGMENTS: Record<SegmentTemplate, string> = {
  empty: "Sin segmentos: los propone el Onboarding",
  template: "Por tamaño de contrato: SMB, Mid-market, Enterprise, Strategic",
  low_ticket: "Ticket bajo: Self-service y Venta asistida (menos de 5.000 al año)",
};

export function OrgCreateForm({ orgs, onDone, location }: { orgs: Membership[]; onDone?: () => void; location: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [segments, setSegments] = useState<SegmentTemplate>("empty");
  const [busy, setBusy] = useState(false);
  const [forced, setForced] = useState(false);
  const twin = similarOrg({ name, website }, orgs);

  async function enter(orgId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (twin?.org.archived) { const { error } = await supabase.rpc("archive_organization", { _org: orgId, _archived: false }); if (error) return toast.error(errorText(error)); }
    const { error } = await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", user!.id);
    if (error) return toast.error(errorText(error));
    onDone?.();
    await qc.resetQueries();
  }
  async function create() {
    if (twin && !forced) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_organization_full", { _name: name.trim(), _segments: segments, _website: website.trim() || undefined, _currency: currency });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    track("org_created", { location });
    onDone?.();
    await qc.resetQueries();
    navigate({ to: "/onboarding" });
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="block space-y-1"><span className="eyebrow">Nombre</span>
        <Input autoFocus placeholder="Nombre de la empresa" value={name} onChange={(e) => { setName(e.target.value); setForced(false); }} />
      </label>
      <label className="block space-y-1"><span className="eyebrow">Web (opcional)</span>
        <Input placeholder="empresa.com" value={website} onChange={(e) => { setWebsite(e.target.value); setForced(false); }} />
      </label>
      <label className="block space-y-1"><span className="eyebrow">Moneda</span>
        <Pick aria-label="Moneda" value={currency} options={CURRENCIES} onChange={setCurrency} />
      </label>
      <label className="block space-y-1"><span className="eyebrow">Segmentos para empezar</span>
        <Pick aria-label="Segmentos para empezar" value={segments} options={SEGMENTS} onChange={(v) => setSegments(v as SegmentTemplate)} />
      </label>
      {twin && !forced && (
        <div className="border-t border-signal pt-2">
          <p>Ya tienes «{twin.org.name}»{twin.org.archived ? " (archivada)" : ""}. ¿Es la misma?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => enter(twin.org.org_id)}>{twin.org.archived ? "Recuperarla y entrar" : "Entrar en ella"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setForced(true)}>Es otra, crearla</Button>
          </div>
        </div>
      )}
      <Button className="w-full" disabled={!name.trim() || busy || (!!twin && !forced)} onClick={create}>{busy ? "Creando…" : "Crear y empezar el Onboarding"}</Button>
      {website.trim() && <p className="text-xs text-muted-foreground">El Onboarding empezará leyendo esa web.</p>}
    </div>
  );
}
