// Sales teams inside a company (from the Postin CRM): the Owner and the Sales Leader create them; everyone can
// filter Pipeline by «Mi equipo».
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useTeam } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/fields";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";

export function useSalesTeams() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["sales-teams", me?.currentOrg?.org_id],
    enabled: !!me?.currentOrg?.org_id,
    queryFn: async () => {
      const [t, m] = await Promise.all([supabase.from("teams").select("id,name,lead_id").order("name"), supabase.from("team_members").select("id,team_id,user_id")]);
      return { teams: t.data ?? [], members: m.data ?? [] };
    },
  });
}

export function TeamsCard() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canEdit = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const { data: people = [] } = useTeam();
  const { data } = useSalesTeams();
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["sales-teams"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) toast.error(errorText(error)); refresh(); };
  const nameOf = (id: string | null) => people.find((p) => p.user_id === id)?.name ?? "—";

  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 shadow-xs">
      <h3 className="text-xl">Equipos de ventas</h3>
      <p className="mt-1 text-sm text-ink-mid">Agrupa a las personas por equipo para filtrar el Pipeline con «Mi equipo».</p>
      <ul className="mt-4 space-y-4">
        {(data?.teams ?? []).map((t) => {
          const mem = (data?.members ?? []).filter((m) => m.team_id === t.id);
          const free = people.filter((p) => !mem.some((m) => m.user_id === p.user_id));
          return (
            <li key={t.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                {canEdit && <Button size="sm" variant="ghost" onClick={async () => { if (await askConfirm(`Borrar el equipo «${t.name}»`, { confirmLabel: "Borrar" })) await run(supabase.from("teams").delete().eq("id", t.id)); }}>Borrar</Button>}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-ink-mid">Responsable{canEdit ? <Pick value={t.lead_id ?? ""} options={Object.fromEntries([["", "—"], ...people.map((p) => [p.user_id, p.name])])} onChange={(v) => run(supabase.from("teams").update({ lead_id: v || null }).eq("id", t.id))} /> : <span className="block text-sm text-ink">{nameOf(t.lead_id)}</span>}</label>
                {canEdit && free.length > 0 && <label className="text-xs text-ink-mid">Añadir persona<Pick value="" options={Object.fromEntries([["", "Elegir…"], ...free.map((p) => [p.user_id, p.name])])} onChange={(v) => v && run(supabase.from("team_members").insert({ team_id: t.id, user_id: v }))} /></label>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mem.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-paper-sunk px-2.5 py-1 text-xs">
                    {nameOf(m.user_id)}
                    {canEdit && <button aria-label={`Quitar a ${nameOf(m.user_id)}`} className="text-ink-mid hover:text-ink" onClick={() => run(supabase.from("team_members").delete().eq("id", m.id))}>×</button>}
                  </span>
                ))}
                {!mem.length && <span className="text-xs text-muted-foreground">Sin personas todavía.</span>}
              </div>
            </li>
          );
        })}
        {!data?.teams.length && <li className="text-sm text-muted-foreground">Aún no hay equipos.</li>}
      </ul>
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <Input aria-label="Nombre del equipo" placeholder="p. ej. Enterprise, SMB, Partners" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim()} onClick={async () => { await run(supabase.from("teams").insert({ name: name.trim() })); setName(""); }}>Crear</Button>
        </div>
      )}
    </section>
  );
}
