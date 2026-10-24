import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { Briefing } from "@/components/briefing";
import { NextSteps } from "@/components/next-steps";
import { useAgent } from "@/components/agent";
import { PaybackCard } from "@/components/payback-card";
import { Button } from "@/components/ui/button";
import { Page, HealthDot } from "@/components/page";
import { ROLES, type Role } from "@/lib/roles";
import { stageLabel } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { homeHeadline } from "@/lib/headlines";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Inicio — Nokko" }, { name: "description", content: "Tu vista según tu rol." }, { property: "og:title", content: "Inicio — Nokko" }, { property: "og:description", content: "Tu vista según tu rol." }] }),
  component: HomePage,
});


function HomePage() {
  const { stages } = useStages();
  const { data: me } = useMe();
  const { money: fmt } = useCurrency();
  const { data: setup } = useSetup();
  const { open: openAgent } = useAgent();
  const { data } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const [deals, meetings, approvals, people, accounts] = await Promise.all([
        supabase.from("deals").select("id,name,stage,amount,probability,health,close_date,owner_id"),
        supabase.from("meetings").select("id,title,scheduled_at,account_id").gte("scheduled_at", new Date(Date.now() - 864e5).toISOString()).order("scheduled_at").limit(6),
        supabase.from("approvals").select("id").eq("status", "pending"),
        supabase.from("people").select("id,tier,crm_stage"),
        supabase.from("accounts").select("id,name,health"),
      ]);
      return { deals: deals.data ?? [], meetings: meetings.data ?? [], approvals: approvals.data ?? [], people: people.data ?? [], accounts: accounts.data ?? [] };
    },
  });
  const role = (me?.roles[0] ?? "ae") as Role;
  const open = (data?.deals ?? []).filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipeline = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const weighted = open.reduce((s, d) => s + Number(d.amount ?? 0) * (d.probability ?? 0) / 100, 0);
  const risk = open.filter((d) => d.health === "red");
  const mine = open.filter((d) => d.owner_id === me?.user.id);
  const leader = role === "sales_leader" || role === "owner";
  const scope = leader ? open : mine;
  const scopeRisk = scope.filter((d) => d.health === "red");
  const today = new Date().toISOString().slice(0, 10);
  const firstName = me?.profile?.full_name?.split(" ")[0] ?? "";
  const headline = homeHeadline({
    riskDeals: scopeRisk.length, riskAmount: scopeRisk.reduce((s, d) => s + Number(d.amount ?? 0), 0),
    pendingApprovals: leader ? (data?.approvals.length ?? 0) : 0,
    meetingsToday: (data?.meetings ?? []).filter((m) => m.scheduled_at?.slice(0, 10) === today).length,
    openDeals: scope.length, openAmount: scope.reduce((s, d) => s + Number(d.amount ?? 0), 0),
    money: fmt, fallback: `Hola, ${firstName}`,
  });

  return (
    <Page eyebrow={firstName ? `Hola, ${firstName} · ${ROLES[role]?.label ?? ""}` : ROLES[role]?.label} title={data ? headline : `Hola, ${firstName}`}>
      <p className="-mt-4 mb-8 text-muted-foreground">Tu foco: {ROLES[role]?.focus}.</p>
      {setup && setup.status.pct < 100 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="eyebrow">Tu estrategia está al {setup.status.pct}%</p>
            <div className="mt-2 h-1.5 max-w-md rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${setup.status.pct}%` }} /></div>
            {setup.status.next && <p className="mt-2 break-words text-sm">Siguiente: <strong>{setup.status.next.label}</strong> · desbloquea {setup.status.next.unlocks.toLowerCase()}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openAgent({ mode: "interview", prompt: "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte." })}>Hazme las preguntas</Button>
            <Button asChild><Link to="/setup">Completar con IA</Link></Button>
          </div>
        </div>
      )}
      <Briefing />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Pipeline abierto" value={fmt(pipeline)} />
        <Stat label="Forecast ponderado" value={fmt(weighted)} />
        <Stat label="Deals en riesgo" value={String(risk.length)} tone={risk.length ? "signal" : undefined} />
        <Stat label="Aprobaciones pendientes" value={String(data?.approvals.length ?? 0)} />
      </div>
      <div className="mt-8"><PaybackCard /></div>
      <div className="mt-8"><NextSteps /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Próximas reuniones" link={{ to: "/accounts", label: "Ver cuentas" }}>
          {(data?.meetings ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin reuniones planificadas. Planifica una desde una cuenta.</p>}
          {data?.meetings.map((m) => (
            <Link key={m.id} to="/accounts/$id" params={{ id: m.account_id ?? "" }} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-0 hover:text-signal">
              <span className="min-w-0 truncate">{m.title}</span><span className="shrink-0 font-mono text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
            </Link>
          ))}
        </Panel>
        <Panel title={role === "sales_leader" || role === "owner" ? "Deals en riesgo" : "Mis deals"} link={{ to: "/deals", label: "Ver pipeline" }}>
          {((role === "sales_leader" || role === "owner") ? risk : mine).slice(0, 6).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
              <span className="min-w-0 break-words">{d.name}</span>
              <span className="flex shrink-0 items-center gap-3"><span className="text-muted-foreground">{stageLabel(d.stage, stages)}</span><HealthDot value={d.health} /></span>
            </div>
          ))}
          {((role === "sales_leader" || role === "owner") ? risk : mine).length === 0 && <p className="text-sm text-muted-foreground">Nada por aquí todavía.</p>}
        </Panel>
        <Panel title="Base de personas" link={{ to: "/people", label: "Abrir" }}>
          <p className="text-sm">{data?.people.length ?? 0} personas · {data?.people.filter((p) => p.tier === "A").length ?? 0} tier A</p>
        </Panel>
        <Panel title="Cuentas" link={{ to: "/accounts", label: "Abrir" }}>
          <p className="text-sm">{data?.accounts.length ?? 0} cuentas · {data?.accounts.filter((a) => a.health === "red").length ?? 0} en riesgo</p>
        </Panel>
      </div>
    </Page>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "signal" }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-display text-4xl ${tone === "signal" ? "text-signal" : ""}`}>{value}</p>
    </div>
  );
}

function Panel({ title, link, children }: { title: string; link: { to: "/accounts" | "/deals" | "/people"; label: string }; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="min-w-0 text-2xl">{title}</h3><Link to={link.to} className="shrink-0 py-2 text-xs text-signal md:py-0">{link.label} →</Link></div>
      {children}
    </div>
  );
}
