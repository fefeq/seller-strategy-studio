import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES, type Role } from "@/lib/roles";
import { TelegramLink } from "@/components/telegram-link";
import { NoticePrefsCard } from "@/components/notice-prefs";
import { McpConnect } from "@/components/mcp-connect";
import { confirmed } from "@/lib/save";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipo — Nokko" }, { name: "description", content: "Personas de la empresa y sus roles." }, { property: "og:title", content: "Equipo — Nokko" }, { property: "og:description", content: "Personas de la empresa y sus roles." }] }),
  component: Team,
});

const ROLE_OPTS = Object.entries(ROLES).map(([k, v]) => ({ k, label: v.label }));

function Team() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const isOwner = me?.roles.includes("owner");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ae");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const { data: org } = useQuery({
    queryKey: ["org-company-name", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("organizations").select("company_name").eq("id", orgId!).maybeSingle()).data,
  });

  const { data } = useQuery({
    queryKey: ["team", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [m, i] = await Promise.all([
        supabase.from("org_members").select("id, user_id, role").eq("org_id", orgId!),
        supabase.from("org_invites").select("*").eq("org_id", orgId!).is("accepted_at", null).order("created_at"),
      ]);
      const ids = (m.data ?? []).map((x) => x.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      return {
        members: (m.data ?? []).map((x) => ({ ...x, profile: (profiles ?? []).find((p) => p.id === x.user_id) })),
        invites: i.data ?? [],
      };
    },
  });

  async function setMemberRole(id: string, userId: string, r: Role) {
    if (userId === me?.user.id && r !== "owner") return toast.error("No puedes quitarte el rol de Owner a ti mismo.");
    const { error } = await supabase.from("org_members").update({ role: r }).eq("id", id);
    if (error) return toast.error(errorText(error));
    toast.success("Rol actualizado.");
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("org_members").delete().eq("id", id);
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["team", orgId] });
  }
  async function invite() {
    const { error } = await supabase.from("org_invites").insert({ org_id: orgId!, email: email.trim().toLowerCase(), role, invited_by: me?.user.id });
    if (error) return toast.error(error.code === "23505" ? "Ya hay una invitación pendiente para ese email." : errorText(error));
    setEmail("");
    toast.success("Invitación creada. Se unirá al entrar con ese email.");
    qc.invalidateQueries({ queryKey: ["team", orgId] });
  }
  async function cancelInvite(id: string) {
    await supabase.from("org_invites").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["team", orgId] });
  }
  async function rename() {
    if (!orgName?.trim()) return;
    const { error } = await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", orgId!);
    if (error) return toast.error(errorText(error));
    setOrgName(null);
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function saveCompanyName() {
    if (companyName === null) return;
    try {
      await confirmed(supabase.from("organizations").update({ company_name: companyName.trim() || null }).eq("id", orgId!).select("id"));
      toast.success("Guardado. Los agentes usarán este nombre en los documentos nuevos.");
      setCompanyName(null);
      qc.invalidateQueries({ queryKey: ["org-company-name", orgId] });
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <Page eyebrow={me?.currentOrg?.name ?? ""} title="Equipo">
      {isOwner && (
        <div className="mb-6 flex flex-wrap items-end gap-6">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Input className="w-full sm:w-64" value={orgName ?? me?.currentOrg?.name ?? ""} onChange={(e) => setOrgName(e.target.value)} />
            <Button variant="outline" disabled={orgName === null} onClick={rename}>Renombrar espacio</Button>
          </div>
          <div className="w-full sm:w-auto">
            <div className="flex flex-wrap gap-2">
              <Input className="w-full sm:w-64" aria-label="Nombre de la empresa en los documentos" placeholder={me?.currentOrg?.name ?? "Nombre de la empresa"} value={companyName ?? org?.company_name ?? ""} onChange={(e) => setCompanyName(e.target.value)} />
              <Button variant="outline" disabled={companyName === null} onClick={saveCompanyName}>Guardar nombre</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cómo se llama tu empresa en los documentos de los agentes (brief, plan, propuestas). Si lo dejas vacío, usan el nombre del espacio.</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="hidden border-b bg-muted/50 text-left md:table-header-group"><tr>{["Persona", "Rol en esta empresa", "Foco", ""].map((h) => <th key={h} className="eyebrow px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {data?.members.map((m) => (
                <tr key={m.id} className="flex flex-wrap items-center gap-2 border-b py-3 last:border-0 md:table-row md:py-0">
                  <td className="block basis-full md:table-cell md:px-4 md:py-3"><p className="break-words font-medium">{m.profile?.full_name}</p><p className="break-all text-xs text-muted-foreground">{m.profile?.email}</p></td>
                  <td className="block min-w-0 flex-1 md:table-cell md:px-4 md:py-3">
                    {isOwner ? (
                      <select className="h-10 w-full max-w-xs rounded border bg-background px-2 md:h-8 md:w-auto md:max-w-none" value={m.role} onChange={(e) => setMemberRole(m.id, m.user_id, e.target.value as Role)}>
                        {ROLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
                      </select>
                    ) : ROLES[m.role as Role]?.label}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{ROLES[m.role as Role]?.focus}</td>
                  <td className="block shrink-0 text-right md:table-cell md:px-4 md:py-3">{isOwner && m.user_id !== me?.user.id && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>Quitar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          {isOwner && (
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <h3 className="text-2xl">Invitar a esta empresa</h3>
              <Input type="email" placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select className="h-10 w-full rounded-md border bg-background px-2 text-sm md:h-9" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
              </select>
              <Button disabled={!email.includes("@")} onClick={invite}>Invitar</Button>
              <p className="text-xs text-muted-foreground">La persona se une al registrarse o entrar con ese email. Un consultor puede pertenecer a varias empresas con un rol distinto en cada una.</p>
            </div>
          )}
          {(data?.invites.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <p className="eyebrow mb-2">Invitaciones pendientes</p>
              {data?.invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                  <span className="min-w-0 break-all">{i.email} <span className="text-xs text-muted-foreground">· {ROLES[i.role as Role]?.label}</span></span>
                  {isOwner && <button className="-my-2 shrink-0 px-2 py-2 text-xs text-destructive md:my-0 md:px-0 md:py-0" onClick={() => cancelInvite(i.id)}>Cancelar</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div id="mcp" className="mt-8 scroll-mt-20 grid gap-6 lg:grid-cols-2"><McpConnect /><TelegramLink /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><NoticePrefsCard /></div>
    </Page>
  );
}
