import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { ROLES, type Role } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipo — GTM Brain" }, { name: "description", content: "Personas del equipo y sus roles." }, { property: "og:title", content: "Equipo — GTM Brain" }, { property: "og:description", content: "Personas del equipo y sus roles." }] }),
  component: Team,
});

function Team() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), supabase.from("user_roles").select("*")]);
      return { profiles: p.data ?? [], roles: r.data ?? [] };
    },
  });
  async function setRole(userId: string, role: Role) {
    if (userId === me?.user.id && role !== "owner") return toast.error("No puedes quitarte el rol de Owner a ti mismo.");
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) return toast.error(del.error.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    qc.invalidateQueries();
  }
  return (
    <Page eyebrow="Quién hace qué" title="Equipo">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left"><tr>{["Persona", "Email", "Rol", "Foco"].map((h) => <th key={h} className="eyebrow px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {data?.profiles.map((p) => {
              const role = (data.roles.find((r) => r.user_id === p.id)?.role ?? "ae") as Role;
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <select className="h-8 rounded border bg-background px-2" value={role} onChange={(e) => setRole(p.id, e.target.value as Role)}>
                        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    ) : ROLES[role]?.label}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLES[role]?.focus}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Las personas nuevas entran como Account Executive. Solo el Owner puede cambiar roles y borrar registros; cada cambio guarda quién lo hizo.</p>
    </Page>
  );
}
