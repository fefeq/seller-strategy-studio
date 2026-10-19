import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BookOpen, Building2, CheckSquare, Compass, Crosshair, Home, KanbanSquare, LogOut, Plug, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ROLES, type Role } from "@/lib/roles";

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
  { to: "/strategy", label: "Estrategia GTM", icon: Compass },
  { to: "/hub", label: "Conocimiento", icon: BookOpen },
  { to: "/accounts", label: "Cuentas", icon: Building2 },
  { to: "/deals", label: "Pipeline", icon: KanbanSquare },
  { to: "/metrics", label: "Métricas", icon: BarChart3 },
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
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-6 font-display text-2xl">GTM Brain</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
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
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="truncate font-medium">{me?.profile?.full_name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{role ? ROLES[role]?.label : ""}</p>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="size-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
