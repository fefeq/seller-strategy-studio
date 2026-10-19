import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Rocket, BarChart3, BookOpen, Building2, CheckSquare, Compass, Crosshair, Home, KanbanSquare, LogOut, Plug, Sparkles, Sprout, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ROLES, type Role } from "@/lib/roles";
import { canUseAdvisor } from "@/lib/advisor";
import { OrgSwitcher } from "@/components/org-switcher";
import { OrgOnboarding } from "@/components/org-onboarding";
import { AgentProvider } from "@/components/agent";
import { useSetup } from "@/hooks/use-setup";
import { useSuggestions } from "@/components/suggestions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const NAV = [
  { to: "/home", label: "Inicio", icon: Home },
  { to: "/inbox", label: "Sugerencias", icon: Inbox },
  { to: "/setup", label: "Configuración", icon: Rocket },
  { to: "/strategy", label: "Estrategia GTM", icon: Compass },
  { to: "/theory-u", label: "Theory U", icon: Sprout },
  { to: "/hub", label: "Conocimiento", icon: BookOpen },
  { to: "/accounts", label: "Cuentas", icon: Building2 },
  { to: "/deals", label: "Pipeline", icon: KanbanSquare },
  { to: "/metrics", label: "Métricas", icon: BarChart3 },
  { to: "/advisor", label: "Asesor GTM", icon: Sparkles, leadersOnly: true },
  { to: "/abm", label: "ABM y partners", icon: Crosshair },
  { to: "/people", label: "Personas", icon: Users },
  { to: "/approvals", label: "Aprobaciones", icon: CheckSquare },
  { to: "/integrations", label: "Integraciones", icon: Plug },
  { to: "/team", label: "Equipo", icon: UserCog },
] as const;

function Shell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const role = me?.roles[0] as Role | undefined;
  const hasOrg = !!me?.currentOrg;
  return (
    <AgentProvider>
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 pb-4 pt-6 font-display text-2xl">GTM Brain</div>
        {me && hasOrg && <OrgSwitcher memberships={me.memberships} current={me.currentOrg} userId={me.user.id} />}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {hasOrg && NAV.filter((n) => !("leadersOnly" in n) || canUseAdvisor(me?.roles ?? [])).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
        {hasOrg && <SetupMeter />}
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="truncate font-medium">{me?.profile?.full_name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{role ? ROLES[role]?.label : ""}</p>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="size-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {!me ? null : hasOrg ? <Outlet key={me.currentOrg?.org_id} /> : <OrgOnboarding memberships={me.memberships} />}
      </main>
    </div>
    </AgentProvider>
  );
}

function SetupMeter() {
  const { data } = useSetup();
  const { data: sugg = [] } = useSuggestions();
  const pct = data?.status.pct;
  return (
    <div className="space-y-2 px-3 pb-3">
      {pct != null && pct < 100 && (
        <Link to="/setup" className="block rounded-md bg-sidebar-accent/60 p-3 text-xs hover:bg-sidebar-accent">
          <div className="flex justify-between"><span>Estrategia completada</span><span className="font-mono">{pct}%</span></div>
          <div className="mt-1.5 h-1 rounded bg-sidebar-border"><div className="h-full rounded bg-sidebar-primary" style={{ width: `${pct}%` }} /></div>
          {data?.status.next && <p className="mt-1.5 text-sidebar-foreground/60">Siguiente: {data.status.next.label.split(" (")[0]}</p>}
        </Link>
      )}
      {sugg.length > 0 && <Link to="/inbox" className="flex justify-between rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent"><span>Sugerencias pendientes</span><span className="font-mono">{sugg.length}</span></Link>}
    </div>
  );
}
