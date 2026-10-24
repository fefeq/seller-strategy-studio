// App menu (UX audit 24 oct 2026): the daily places stay visible; everything else sits in two
// collapsible groups, «Más herramientas» and «Ajustes», which open by themselves when you are inside.
// Pure and tested: the shell and the ⌘K palette read the same list.
export type NavItem = { to: string; label: string; leadersOnly?: boolean; keywords?: string };
export type NavGroup = { key: "daily" | "more" | "settings"; title: string; collapsible: boolean; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "daily", title: "", collapsible: false, items: [
      { to: "/home", label: "Inicio", keywords: "hoy resumen" },
      { to: "/inbox", label: "Sugerencias", keywords: "bandeja tareas" },
      { to: "/accounts", label: "Cuentas", keywords: "empresas clientes" },
      { to: "/leads", label: "Leads", keywords: "entrada prospectos" },
      { to: "/deals", label: "Pipeline", keywords: "deals oportunidades" },
      { to: "/people", label: "Personas", keywords: "contactos" },
      { to: "/strategy", label: "Estrategia GTM", keywords: "icp segmentos posicionamiento" },
      { to: "/metrics", label: "Métricas", keywords: "cac payback funnel" },
    ],
  },
  {
    key: "more", title: "Más herramientas", collapsible: true, items: [
      { to: "/discoveries", label: "Descubiertos" },
      { to: "/approvals", label: "Aprobaciones" },
      { to: "/advisor", label: "Asesor GTM", leadersOnly: true },
      { to: "/cycle", label: "Ciclo GTM" },
      { to: "/debates", label: "Debates" },
      { to: "/abm", label: "ABM y partners" },
      { to: "/theory-u", label: "Theory U" },
      { to: "/products", label: "Productos" },
      { to: "/hub", label: "Conocimiento" },
      { to: "/memory", label: "Memoria" },
    ],
  },
  {
    key: "settings", title: "Ajustes", collapsible: true, items: [
      { to: "/company", label: "Empresa" },
      { to: "/team", label: "Equipo" },
      { to: "/integrations", label: "Conexiones" },
      { to: "/setup", label: "Configuración" },
      { to: "/connect", label: "Conectar asistentes" },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const isActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

/** Items this person may see in a group. */
export const visibleItems = (g: NavGroup, isLeader: boolean) => g.items.filter((i) => !i.leadersOnly || isLeader);

/** A collapsible group opens when you are on one of its pages, or when you left it open. */
export const groupOpen = (g: NavGroup, path: string, saved: boolean | undefined) =>
  !g.collapsible || g.items.some((i) => isActive(path, i.to)) || !!saved;
