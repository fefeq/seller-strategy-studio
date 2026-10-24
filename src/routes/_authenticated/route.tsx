import { useEffect, useRef, useState } from "react";
import { BackgroundJobsWatcher } from "@/components/background";
import { NotificationCenter } from "@/components/notification-center";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ROLES, type Role } from "@/lib/roles";
import { canUseAdvisor } from "@/lib/advisor";
import { NAV, NAV_GROUPS, groupOpen, isActive, visibleItems } from "@/lib/nav";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { OrgSwitcher } from "@/components/org-switcher";
import { OrgOnboarding } from "@/components/org-onboarding";
import { AgentProvider, useAgent } from "@/components/agent";
import { useSetup } from "@/hooks/use-setup";
import { useSuggestions } from "@/components/suggestions";
import { useLivePipeline } from "@/hooks/use-live-pipeline";
import { Isotipo, Lockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

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
  const [collapsed, setCollapsed] = useCollapsedSidebar();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const current = NAV.find((n) => isActive(path, n.to))?.label;
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const [openGroups, setOpenGroups] = useOpenGroups();
  const leader = canUseAdvisor(me?.roles ?? []);

  // Close the mobile menu whenever the route changes (links, back button, redirects).
  useEffect(() => setNavOpen(false), [path]);

  // Swipe left on the open drawer closes it.
  const touchX = useRef<number | null>(null);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current != null && e.changedTouches[0].clientX - touchX.current < -60) setNavOpen(false);
      touchX.current = null;
    },
  };

  // Same sidebar content on desktop (fixed column) and on mobile (drawer under the top bar).
  const sidebar = (mobile: boolean) => (
    <>
      {!mobile && (
        <div className="flex items-center justify-between gap-2 py-5 pl-5 pr-3 pt-6">
          <Lockup />
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Cerrar menú"
            title="Cerrar menú"
            className="shrink-0 text-xs text-ink-mid hover:text-ink"
          >
            ‹ Plegar
          </button>
        </div>
      )}
      {me && hasOrg && <OrgSwitcher memberships={me.memberships} archived={me.archived} current={me.currentOrg} userId={me.user.id} />}
      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2" aria-label="Secciones">
        {hasOrg && NAV_GROUPS.map((g) => {
          const items = visibleItems(g, leader);
          const open = groupOpen(g, path, openGroups[g.key]);
          return (
            <div key={g.key} className="mb-2">
              {g.collapsible && (
                <button
                  onClick={() => setOpenGroups({ ...openGroups, [g.key]: !open })}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-ink"
                >
                  {g.title} <span aria-hidden>{open ? "−" : "+"}</span>
                </button>
              )}
              {open && items.map((n) => (
                <Link
                  key={n.to}
                  to={n.to as never}
                  className="my-0.5 flex items-center rounded-lg px-3 py-2.5 text-base text-ink-mid transition-colors hover:bg-paper-sunk hover:text-ink data-[status=active]:bg-lime data-[status=active]:font-semibold data-[status=active]:text-lime-foreground md:py-1.5 md:text-sm"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      {hasOrg && <SetupMeter />}
      <div className="border-t border-hairline p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm md:pb-4">
        <p className="truncate font-medium">{me?.profile?.full_name}</p>
        <p className="eyebrow mt-1 truncate">{role ? ROLES[role]?.label : ""}</p>
        <button onClick={signOut} className="-my-2 mt-1 py-2 text-xs text-ink underline decoration-hairline-firm underline-offset-4 hover:decoration-ink">
          Cerrar sesión
        </button>
        <ThemeToggle className="mt-3 border-t border-hairline pt-3 md:pt-2" />
      </div>
    </>
  );

  return (
    <AgentProvider>
    <BackgroundJobsWatcher userId={me?.user.id} />
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar: brand + current section + menu toggle. It stays above the drawer so ☰/✕ always works. */}
      <header className={`sticky top-0 ${navOpen ? "z-[60]" : "z-30"} border-b border-hairline bg-sidebar pt-[env(safe-area-inset-top)] text-sidebar-foreground md:hidden`}>
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link to="/home" className="shrink-0" aria-label="Inicio"><Lockup /></Link>
          {current && <span className="hidden min-w-0 truncate text-sm text-ink-mid min-[420px]:inline">{current}</span>}
          <button onClick={() => setPaletteOpen(true)} aria-label="Buscar" className="ml-auto flex size-11 shrink-0 items-center justify-center text-ink-mid">Buscar</button>
          <NotificationCenter userId={me?.user.id} className="shrink-0" />
          <button
            onClick={() => setNavOpen((o) => !o)}
            aria-label={navOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center text-ink"
          >
            <span aria-hidden className="text-xl leading-none">{navOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </header>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          id="mobile-nav"
          side="left"
          {...swipe}
          // Starts under the top bar; the bar's ✕ closes it (the sheet's own X is hidden).
          className="top-[calc(3.5rem+env(safe-area-inset-top))] flex h-auto w-[85vw] max-w-xs flex-col gap-0 border-hairline bg-sidebar p-0 text-sidebar-foreground md:hidden [&>button:first-child]:sr-only [&>button:first-child]:focus:not-sr-only"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetTitle className="sr-only">Menú</SheetTitle>
          {sidebar(true)}
        </SheetContent>
      </Sheet>

      {/* Desktop/tablet: full sidebar, or a slim rail when closed (remembered per browser). */}
      {collapsed ? (
        <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center gap-4 border-r border-hairline bg-sidebar py-6 text-sidebar-foreground md:flex">
          <Link to="/home" aria-label="Inicio"><Isotipo className="size-8" /></Link>
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Abrir menú"
            title="Abrir menú"
            className="flex size-9 items-center justify-center text-lg text-ink-mid hover:text-ink"
          >
            ›
          </button>
          <ThemeToggle compact className="mt-auto" />
        </aside>
      ) : (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-sidebar text-sidebar-foreground md:flex">
          {sidebar(false)}
        </aside>
      )}
      <main className="min-w-0 flex-1">
        {hasOrg && <TopBar onSearch={() => setPaletteOpen(true)} userId={me?.user.id} />}
        {!me ? null : hasOrg ? <Outlet key={me.currentOrg?.org_id} /> : <OrgOnboarding memberships={me.memberships} archived={me.archived} />}
      </main>
      {hasOrg && <BottomBar />}
      {hasOrg && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
    </div>
    </AgentProvider>
  );
}

/** Desktop top bar: search (⌘K), the agent (⌘J) and notices, out of the way of the content. */
function TopBar({ onSearch, userId }: { onSearch: () => void; userId: string | undefined }) {
  const { open } = useAgent();
  return (
    <div className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-hairline bg-background/85 px-6 backdrop-blur md:flex lg:px-10">
      <button onClick={onSearch} className="flex h-9 w-full max-w-md items-center justify-between rounded-lg border border-hairline bg-card px-3 text-sm text-ink-faint shadow-xs hover:border-hairline-firm">
        Buscar cuentas, leads, pantallas…
        <kbd className="rounded-md bg-paper-sunk px-1.5 py-0.5 text-[11px] font-medium text-ink-mid">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-4">
        <NotificationCenter userId={userId} />
        <button onClick={() => open()} className="flex h-9 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-reverse hover:bg-ink/85" aria-label="Abrir agente GTM">
          Agente <kbd className="rounded bg-ink-reverse/15 px-1.5 text-[11px]">⌘J</kbd>
        </button>
      </div>
    </div>
  );
}

/** Which collapsible menu groups are open, remembered in this browser. */
function useOpenGroups() {
  const KEY = "nokko-nav-groups";
  const [v, set] = useState<Record<string, boolean>>({});
  useEffect(() => { try { set(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* ignore */ } }, []);
  const save = (n: Record<string, boolean>) => { set(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } };
  return [v, save] as const;
}

/** Sidebar open/closed on desktop, remembered in this browser (best effort: storage can be blocked). */
function useCollapsedSidebar() {
  const KEY = "nokko-sidebar-collapsed";
  const [collapsed, set] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    set(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };
  // ⌘/Ctrl + B toggles it, like most editors.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !(e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable=true]")) {
        e.preventDefault();
        set((c) => { const v = !c; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ } return v; });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return [collapsed, setCollapsed] as const;
}

/** Mobile bottom bar: the four places used most plus the agent, one thumb away. */
function BottomBar() {
  const { open } = useAgent();
  const { data: sugg = [] } = useSuggestions();
  const tabs = [
    { to: "/home", label: "Inicio" },
    { to: "/inbox", label: "Sugerencias", badge: sugg.length },
    { to: "/leads", label: "Leads" },
    { to: "/deals", label: "Pipeline" },
  ] as const;
  const item = "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] leading-tight text-ink-mid";
  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(3.75rem+env(safe-area-inset-bottom))] border-t border-hairline bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={`${item} border-t-2 border-transparent data-[status=active]:border-ink data-[status=active]:font-semibold data-[status=active]:text-ink`}
        >
          <span className="relative truncate">
            {t.label}
            {"badge" in t && t.badge > 0 && (
              <span className="ml-1 tabular-nums text-signal" aria-label={`${t.badge} pendientes`}>
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </span>
        </Link>
      ))}
      <button onClick={() => open()} className={`${item} border-t-2 border-transparent`} aria-label="Abrir agente GTM">
        <span>Agente</span>
      </button>
    </nav>
  );
}

function SetupMeter() {
  const { data } = useSetup();
  const { data: sugg = [] } = useSuggestions();
  const pct = data?.status.pct;
  return (
    <div className="space-y-2 px-3 pb-3">
      {pct != null && pct < 100 && (
        <Link to="/setup" className="block border-t border-hairline px-3 pt-3 text-xs hover:text-ink">
          <div className="flex justify-between"><span>Estrategia completada</span><span className="font-mono font-semibold">{pct}%</span></div>
          <div className="mt-1.5 h-0.5 bg-hairline"><div className="h-full bg-ink" style={{ width: `${pct}%` }} /></div>
          {data?.status.next && <p className="mt-1.5 text-ink-mid">Siguiente: {data.status.next.label.split(" (")[0]}</p>}
        </Link>
      )}
      {sugg.length > 0 && <Link to="/inbox" className="flex justify-between px-3 py-1.5 text-xs text-ink-mid hover:text-ink"><span>Sugerencias pendientes</span><span className="font-mono">{sugg.length}</span></Link>}
    </div>
  );
}
