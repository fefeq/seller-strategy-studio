import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nokko — una sola fuente de verdad para ventas" },
      { name: "description", content: "Account Plans, Meeting Planner, Stakeholder Research, pipeline y base única de personas para todo tu equipo comercial." },
      { property: "og:title", content: "Nokko — una sola fuente de verdad para ventas" },
      { property: "og:description", content: "Cada rol del ciclo de venta trabajando desde el mismo contexto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  ["01", "Cerebro compartido", "Empresa, ICP, ofertas, objeciones, playbooks, llamadas y reglas. Todo el equipo trabaja con el mismo contexto."],
  ["02", "Un responsable", "El GTM Owner entrena el sistema, aprueba cambios y promueve las skills que funcionan."],
  ["03", "Capa estratégica", "Account Plan, mapa de stakeholders, Meeting Planner, MEDDPICC y Mutual Action Plan por cuenta."],
  ["04", "Base única de personas", "Una fila por persona, sin duplicados por email o LinkedIn. Cada fuente y resultado de campaña registrado."],
  ["05", "CRM que se mantiene solo", "Los cambios importantes llegan a una bandeja con evidencia: aplicar u omitir."],
  ["06", "Varias empresas, un solo lugar", "Gestiona la estrategia de varias empresas y cambia entre ellas. Cada una con su equipo, sus roles y sus datos aislados."],
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl">Nokko</span>
        <Button asChild><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <p className="eyebrow">Sistema operativo comercial</p>
        <h1 className="mt-4 max-w-4xl text-6xl leading-[1.02] md:text-8xl">
          Una sola fuente de verdad para <em className="text-signal">todo</em> el equipo de ventas.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground">
          Antes de cada llamada, cada persona tiene las últimas conversaciones, ofertas, notas de cuenta y el plan para ganar.
        </p>
        <div className="mt-10 flex gap-3">
          <Button size="lg" asChild><Link to="/auth">Empezar</Link></Button>
        </div>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl md:grid-cols-3">
          {PILLARS.map(([n, t, d]) => (
            <div key={n} className="border-b p-8 md:border-r">
              <span className="font-mono text-xs text-signal">{n}</span>
              <h3 className="mt-3 text-3xl">{t}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">Cada rol, su vista</p>
        <h2 className="mt-3 text-5xl">Todo el ciclo de venta, conectado.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {Object.entries(ROLES).map(([k, r]) => (
            <div key={k} className="bg-background p-6">
              <p className="font-medium">{r.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.focus}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">Primero el sistema, luego el equipo, luego los agentes.</footer>
    </div>
  );
}
