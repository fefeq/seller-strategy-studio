import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";
import { Lockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { track } from "@/lib/analytics";
import { homeJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nokko — una sola fuente de verdad para ventas" },
      { name: "description", content: "Planes de cuenta, planificador de reuniones, investigación de stakeholders, pipeline y base única de personas para todo tu equipo comercial." },
      { property: "og:title", content: "Nokko — una sola fuente de verdad para ventas" },
      { property: "og:description", content: "Cada rol del ciclo de venta trabajando desde el mismo contexto." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    scripts: [{ type: "application/ld+json", children: homeJsonLd() }],
  }),
  component: Landing,
});

const PILLARS = [
  ["01", "Cerebro compartido", "Empresa, ICP, ofertas, objeciones, playbooks, llamadas y reglas. Todo el equipo trabaja con el mismo contexto."],
  ["02", "Un responsable", "El GTM Owner entrena el sistema, aprueba cambios y promueve las skills que funcionan."],
  ["03", "Capa estratégica", "Plan de cuenta, mapa de stakeholders, planificador de reuniones, MEDDPICC y plan de acción conjunto por cuenta."],
  ["04", "Base única de personas", "Una fila por persona, sin duplicados por email o LinkedIn. Cada fuente y resultado de campaña registrado."],
  ["05", "El CRM se actualiza con evidencia", "Los cambios importantes llegan a una bandeja con su evidencia: aplicar u omitir."],
  ["06", "Varias empresas, un solo lugar", "Gestiona la estrategia de varias empresas y cambia entre ellas. Cada una con su equipo, sus roles y sus datos aislados."],
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-hairline-firm bg-paper-edge">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Lockup />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Button variant="outline" asChild><Link to="/auth" onClick={() => track("cta_click", { location: "header_entrar" })}>Entrar</Link></Button>
        </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
        <div className="rule-major mb-6 w-24" />
        <p className="kicker">Sistema operativo comercial</p>
        <h1 className="lede-m mt-5 max-w-[14ch] md:lede-xl">
          Una sola fuente de verdad para <span className="text-red">todo</span> el equipo de ventas.
        </h1>
        <p className="mt-8 measure-body text-lg text-ink-mid">
          Antes de cada llamada, cada persona tiene las últimas conversaciones, ofertas, notas de cuenta y el plan de la cuenta.
        </p>
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
          <Button size="lg" asChild><Link to="/auth" onClick={() => track("cta_click", { location: "hero_empezar" })}>Empezar</Link></Button>
          <p className="note sm:self-center">Cuentas, personas, llamadas y planes en un mismo documento.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6">
        <div className="rule-section grid gap-x-12 md:grid-cols-3">
          {PILLARS.map(([n, t, d]) => (
            <div key={n} className="border-t border-hairline py-8 first:border-t-0 md:[&:nth-child(-n+3)]:border-t-0">
              <span className="note text-red">{n}</span>
              <h3 className="head mt-3">{t}</h3>
              <p className="mt-3 text-sm text-ink-mid">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="kicker">Cada rol, su vista</p>
        <h2 className="lede-m mt-4 measure-lede">Todo el ciclo de venta, conectado.</h2>
        <div className="mt-10 grid gap-x-12 md:grid-cols-3">
          {Object.entries(ROLES).map(([k, r]) => (
            <div key={k} className="border-t border-hairline py-5">
              <p className="font-medium">{r.label}</p>
              <p className="mt-1 text-sm text-ink-mid">{r.focus}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t-2 border-hairline-firm bg-paper-edge py-8 text-center note">Primero el sistema, luego el equipo, luego los agentes.</footer>
    </div>
  );
}
