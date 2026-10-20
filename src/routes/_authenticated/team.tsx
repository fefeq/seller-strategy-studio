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
import { McpConnect } from "@/components/mcp-connect";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipo — NOKKO" }, { name: "description", content: "Personas de la empresa y sus roles." }, { property: "og:title", content: "Equipo — NOKKO" }, { property: "og:description", content: "Personas de la empresa y sus roles." }] }),
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
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("org_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team", orgId] });
  }
  async function invite() {
    const { error } = await supabase.from("org_invites").insert({ org_id: orgId!, email: email.trim().toLowerCase(), role, invited_by: me?.user.id });
    if (error) return toast.error(error.code === "23505" ? "Ya hay una invitación pendiente para ese email." : error.message);
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
    if (error) return toast.error(error.message);
    setOrgName(null);
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <Page eyebrow={me?.currentOrg?.name ?? ""} title="Equipo">
      {isOwner && (
        <div className="mb-6 flex flex-wrap items-end gap-6">
          <div className="flex gap-2">
            <Input className="w-64" value={orgName ?? me?.currentOrg?.name ?? ""} onChange={(e) => setOrgName(e.target.value)} />
            <Button variant="outline" disabled={orgName === null} onClick={rename}>Renombrar empresa</Button>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left"><tr>{["Persona", "Rol en esta empresa", "Foco", ""].map((h) => <th key={h} className="eyebrow px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {data?.members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-3"><p className="font-medium">{m.profile?.full_name}</p><p className="text-xs text-muted-foreground">{m.profile?.email}</p></td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <select className="h-8 rounded border bg-background px-2" value={m.role} onChange={(e) => setMemberRole(m.id, m.user_id, e.target.value as Role)}>
                        {ROLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
                      </select>
                    ) : ROLES[m.role as Role]?.label}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLES[m.role as Role]?.focus}</td>
                  <td className="px-4 py-3 text-right">{isOwner && m.user_id !== me?.user.id && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>Quitar</Button>}</td>
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
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
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
                <div key={i.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <span>{i.email} <span className="text-xs text-muted-foreground">· {ROLES[i.role as Role]?.label}</span></span>
                  {isOwner && <button className="text-xs text-destructive" onClick={() => cancelInvite(i.id)}>Cancelar</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2"><McpConnect /><TelegramLink /></div>
    </Page>
  );
}
