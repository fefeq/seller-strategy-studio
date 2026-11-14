// Five intent groups; Hoy stays visible. Advanced hides links, never routes or permissions.
// The shell and the full command palette share this catalogue.
export type NavItem = { to: string; label: string; leadersOnly?: boolean; advancedOnly?: boolean; keywords?: string };
export type NavGroup = {
  key: "daily" | "strategy" | "execute" | "measure" | "settings";
  title: string;
  collapsible: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  { key: "daily", title: "Hoy", collapsible: false, items: [
    { to: "/home", label: "Inicio", keywords: "hoy resumen" },
    { to: "/inbox", label: "Sugerencias", keywords: "bandeja propuestas" },
    { to: "/approvals", label: "Aprobaciones" },
    { to: "/replies", label: "Respuestas", keywords: "gmail email bandeja" },
  ] },
  { key: "strategy", title: "Diseñar", collapsible: true, items: [
    { to: "/onboarding", label: "Onboarding", keywords: "empezar lectura fuentes" },
    { to: "/setup", label: "Configuración" },
    { to: "/strategy", label: "Estrategia GTM", keywords: "icp segmentos posicionamiento" },
    { to: "/products", label: "Productos" },
    { to: "/hub", label: "Conocimiento" },
  ] },
  { key: "execute", title: "Ejecutar", collapsible: true, items: [
    { to: "/accounts", label: "Cuentas", keywords: "empresas clientes" },
    { to: "/leads", label: "Leads", keywords: "entrada prospectos" },
    { to: "/people", label: "Personas", keywords: "contactos" },
    { to: "/deals", label: "Pipeline", keywords: "deals oportunidades" },
    { to: "/plays", label: "Plays GTM", keywords: "jugadas señales automatizaciones equipos grupos" },
    { to: "/abm", label: "ABM y partners" },
    { to: "/discoveries", label: "Descubiertos" },
  ] },
  { key: "measure", title: "Medir y aprender", collapsible: true, items: [
    { to: "/metrics", label: "Métricas", keywords: "cac payback funnel" },
    { to: "/advisor", label: "Asesor GTM", leadersOnly: true },
    { to: "/cycle", label: "Ciclo GTM", advancedOnly: true },
    { to: "/debates", label: "Debates", advancedOnly: true },
    { to: "/theory-u", label: "Theory U", advancedOnly: true },
  ] },
  { key: "settings", title: "Ajustes", collapsible: true, items: [
    { to: "/company", label: "Empresa" },
    { to: "/team", label: "Equipo" },
    { to: "/integrations", label: "Conexiones" },
    { to: "/memory", label: "Memoria" },
  ] },
];

export const ASSISTANTS_NAV: NavItem = { to: "/connect", label: "Conectar asistentes" };
export const NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ASSISTANTS_NAV];
export const isActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

/** Items this person may see in a group. */
export const visibleItems = (g: NavGroup, isLeader: boolean, advanced = false) =>
  g.items.filter((i) => (!i.leadersOnly || isLeader) && (!i.advancedOnly || advanced));

/** A collapsible group opens when you are on one of its pages, or when you left it open. */
export const groupOpen = (g: NavGroup, path: string, saved: boolean | undefined) =>
  !g.collapsible || g.items.some((i) => isActive(path, i.to)) || !!saved;
