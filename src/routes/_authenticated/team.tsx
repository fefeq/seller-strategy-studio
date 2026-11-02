import { NativeSelect } from "@/components/native-select";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  return (
    <Page eyebrow={me?.currentOrg?.name ?? ""} title="Equipo">
      <p className="mb-6 text-sm text-muted-foreground">El nombre, la web y la moneda de la empresa están en <Link to="/company" className="text-signal">Empresa</Link>.</p>
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
                      <NativeSelect aria-label="Rol del miembro" density="compact" className="w-full max-w-xs md:w-auto md:max-w-none" value={m.role} onChange={(e) => setMemberRole(m.id, m.user_id, e.target.value as Role)}>
                        {ROLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
                      </NativeSelect>
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
              <NativeSelect aria-label="Rol de la invitación" className="w-full" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
              </NativeSelect>
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
