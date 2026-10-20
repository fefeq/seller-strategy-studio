import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ROLES, type Role } from "@/lib/roles";
import { canUseAdvisor } from "@/lib/advisor";
import { OrgSwitcher } from "@/components/org-switcher";
import { OrgOnboarding } from "@/components/org-onboarding";
import { AgentProvider } from "@/components/agent";
import { useSetup } from "@/hooks/use-setup";
import { useSuggestions } from "@/components/suggestions";
import { useLivePipeline } from "@/hooks/use-live-pipeline";
import { Lockup } from "@/components/brand";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const NAV = [
  { to: "/home", label: "Inicio" },
  { to: "/inbox", label: "Sugerencias" },
  { to: "/setup", label: "Configuración" },
  { to: "/cycle", label: "Ciclo GTM" },
  { to: "/debates", label: "Debates" },
  { to: "/strategy", label: "Estrategia GTM" },
  { to: "/theory-u", label: "Theory U" },
  { to: "/hub", label: "Conocimiento" },
  { to: "/accounts", label: "Cuentas" },
  { to: "/leads", label: "Leads" },
  { to: "/deals", label: "Pipeline" },
  { to: "/metrics", label: "Métricas" },
  { to: "/advisor", label: "Asesor GTM", leadersOnly: true },
  { to: "/abm", label: "ABM y partners" },
  { to: "/people", label: "Personas" },
  { to: "/approvals", label: "Aprobaciones" },
  { to: "/integrations", label: "Integraciones" },
  { to: "/team", label: "Equipo" },
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
  useLivePipeline(me?.currentOrg?.org_id);
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const current = NAV.find((n) => path === n.to || path.startsWith(`${n.to}/`))?.label;

  // Same sidebar content on desktop (fixed column) and on mobile (left drawer).
  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="border-b-2 border-hairline-firm px-5 pb-5 pt-6"><Lockup /></div>
      {me && hasOrg && <OrgSwitcher memberships={me.memberships} current={me.currentOrg} userId={me.user.id} />}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {hasOrg && NAV.filter((n) => !("leadersOnly" in n) || canUseAdvisor(me?.roles ?? [])).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className="flex items-center border-l-2 border-transparent px-3 py-2.5 text-base text-ink-mid hover:text-ink data-[status=active]:border-red data-[status=active]:font-semibold data-[status=active]:text-ink md:py-1.5 md:text-sm"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {hasOrg && <SetupMeter onNavigate={onNavigate} />}
      <div className="border-t border-hairline p-4 text-sm">
        <p className="truncate font-medium">{me?.profile?.full_name}</p>
        <p className="eyebrow mt-1 truncate">{role ? ROLES[role]?.label : ""}</p>
        <button onClick={signOut} className="-my-2 mt-1 py-2 text-xs text-ink underline decoration-hairline-firm underline-offset-4 hover:decoration-ink">
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <AgentProvider>
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar: brand + current section + menu. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-hairline bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Link to="/home" className="shrink-0" aria-label="Inicio"><Lockup className="[&_span]:text-[22px]" /></Link>
        {current && <span className="min-w-0 truncate text-sm text-ink-mid">{current}</span>}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Abrir menú"
          className="-mr-2 flex size-10 shrink-0 items-center justify-center text-ink"
        >
          <Menu className="size-5" />
        </button>
      </header>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="flex w-[82vw] max-w-xs flex-col gap-0 border-hairline bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          {sidebar(() => setNavOpen(false))}
        </SheetContent>
      </Sheet>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-sidebar text-sidebar-foreground md:flex">
        {sidebar()}
      </aside>
      <main className="min-w-0 flex-1">
        {!me ? null : hasOrg ? <Outlet key={me.currentOrg?.org_id} /> : <OrgOnboarding memberships={me.memberships} />}
      </main>
    </div>
    </AgentProvider>
  );
}

function SetupMeter({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useSetup();
  const { data: sugg = [] } = useSuggestions();
  const pct = data?.status.pct;
  return (
    <div className="space-y-2 px-3 pb-3">
      {pct != null && pct < 100 && (
        <Link to="/setup" onClick={onNavigate} className="block border-t border-hairline px-3 pt-3 text-xs hover:text-ink">
          <div className="flex justify-between"><span>Estrategia completada</span><span className="font-mono font-semibold">{pct}%</span></div>
          <div className="mt-1.5 h-0.5 bg-hairline"><div className="h-full bg-ink" style={{ width: `${pct}%` }} /></div>
          {data?.status.next && <p className="mt-1.5 text-ink-mid">Siguiente: {data.status.next.label.split(" (")[0]}</p>}
        </Link>
      )}
      {sugg.length > 0 && <Link to="/inbox" onClick={onNavigate} className="flex justify-between px-3 py-1.5 text-xs text-ink-mid hover:text-ink"><span>Sugerencias pendientes</span><span className="font-mono">{sugg.length}</span></Link>}
    </div>
  );
}
