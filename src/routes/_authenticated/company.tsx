import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/fields";
import { askConfirm, askText } from "@/components/confirm-dialog";
import { CURRENCIES } from "@/lib/money";
import { errorText } from "@/lib/errors";

const META = "Nombre, web y moneda de tu empresa en Nokko; archivar o borrar.";
export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({ meta: [{ title: "Empresa — Nokko" }, { name: "description", content: META }, { property: "og:title", content: "Empresa — Nokko" }, { property: "og:description", content: META }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Company,
});

type Form = { name: string; company_name: string; website: string; currency: string };

function Company() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const isOwner = me?.roles.includes("owner");
  const { data: org } = useQuery({
    queryKey: ["org-settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("name,company_name,website,currency").eq("id", orgId!).single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => { if (org) setForm({ name: org.name, company_name: org.company_name ?? "", website: org.website ?? "", currency: org.currency }); }, [org]);
  const dirty = !!org && !!form && (form.name !== org.name || form.company_name !== (org.company_name ?? "") || form.website !== (org.website ?? "") || form.currency !== org.currency);
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form || !org) return;
    if (!form.name.trim()) return toast.error("La empresa necesita un nombre.");
    if (form.currency !== org.currency && !(await askConfirm(`Cambiar la moneda a ${form.currency}`, { body: "Las cifras guardadas no se convierten: solo cambia el símbolo con el que se muestran.", confirmLabel: "Cambiar moneda" }))) return;
    const { error } = await supabase.from("organizations").update({ name: form.name.trim(), company_name: form.company_name.trim() || null, website: form.website.trim() || null, currency: form.currency }).eq("id", orgId!).select("id").single();
    if (error) return toast.error(errorText(error));
    toast.success("Empresa guardada.");
    await Promise.all([qc.invalidateQueries({ queryKey: ["org-settings", orgId] }), qc.invalidateQueries({ queryKey: ["me"] })]);
  }

  async function counts() {
    const n = async (t: "accounts" | "leads" | "deals") => (await supabase.from(t).select("id", { count: "exact", head: true })).count ?? 0;
    const [a, l, d] = await Promise.all([n("accounts"), n("leads"), n("deals")]);
    return `${a} cuentas, ${l} leads y ${d} deals`;
  }
  async function archive() {
    if (!(await askConfirm(`Archivar «${org?.name}»`, { body: "Desaparece del selector y Nokko deja de trabajar en ella (búsquedas, emails, piloto automático). No se borra nada y puedes recuperarla desde el selector, en «Archivadas».", confirmLabel: "Archivar" }))) return;
    const { error } = await supabase.rpc("archive_organization", { _org: orgId!, _archived: true });
    if (error) return toast.error(errorText(error));
    toast.success("Empresa archivada.");
    await qc.resetQueries();
  }
  async function remove() {
    const what = await counts();
    const typed = await askText(`Borrar «${org?.name}» para siempre`, { body: `Se borran ${what}, la estrategia, el equipo y todo lo demás de esta empresa. No se puede deshacer. Escribe el nombre exacto para confirmar.`, placeholder: org?.name ?? "", confirmLabel: "Borrar para siempre" });
    if (typed === null) return;
    const { error } = await supabase.rpc("delete_organization", { _org: orgId!, _confirm_name: typed });
    if (error) return toast.error(errorText(error));
    toast.success("Empresa borrada.");
    await qc.resetQueries();
  }

  return (
    <Page eyebrow="Ajustes" title={org?.name ?? "Empresa"}>
      {!form ? null : (
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-4">
            <label className="block space-y-1"><span className="eyebrow">Nombre en Nokko</span>
              <Input value={form.name} disabled={!isOwner} onChange={(e) => set("name")(e.target.value)} />
            </label>
            <label className="block space-y-1"><span className="eyebrow">Nombre en los documentos</span>
              <Input value={form.company_name} disabled={!isOwner} placeholder={form.name} onChange={(e) => set("company_name")(e.target.value)} />
              <span className="block text-xs text-muted-foreground">Cómo firman los agentes el brief, el plan y las propuestas. Vacío = el nombre en Nokko.</span>
            </label>
            <label className="block space-y-1"><span className="eyebrow">Web</span>
              <Input value={form.website} disabled={!isOwner} placeholder="empresa.com" onChange={(e) => set("website")(e.target.value)} />
              <span className="block text-xs text-muted-foreground">El Onboarding la usa para leer tu empresa.</span>
            </label>
            <label className="block space-y-1"><span className="eyebrow">Moneda</span>
              <Pick aria-label="Moneda" value={form.currency} disabled={!isOwner} options={CURRENCIES} onChange={set("currency")} />
              <span className="block text-xs text-muted-foreground">Cambiarla cambia el símbolo, no convierte las cifras.</span>
            </label>
            {isOwner ? (
              <Button disabled={!dirty} onClick={save}>Guardar</Button>
            ) : (
              <p className="text-xs text-muted-foreground">Solo el Owner puede cambiar estos datos.</p>
            )}
          </section>
          <aside className="space-y-6 text-sm">
            <div>
              <p className="eyebrow mb-2">También de esta empresa</p>
              <ul className="space-y-2">
                <li><Link to="/strategy" className="text-signal">Segmentos e ICP</Link> — en Estrategia GTM</li>
                <li><Link to="/team" className="text-signal">Equipo</Link> — personas, roles e invitaciones</li>
                <li><Link to="/onboarding" className="text-signal">Onboarding</Link> — que Nokko vuelva a leer tu empresa</li>
              </ul>
            </div>
            {isOwner && (
              <div className="space-y-3 border-t pt-4">
                <p className="eyebrow">Archivar o borrar</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={archive}>Archivar empresa</Button>
                  <Button variant="ghost" className="text-destructive" onClick={remove}>Borrar para siempre</Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </Page>
  );
}
