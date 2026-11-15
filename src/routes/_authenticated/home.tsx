import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { useAgent } from "@/components/agent";
import { RoadmapCard } from "@/components/onboarding/home-card";
import { GuideCard } from "@/components/home/guide-card";
import { TodayInbox } from "@/components/home/today-inbox";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSuggestions } from "@/components/suggestions";
import { SuggestionDeck } from "@/components/suggestion-deck";
import { showRoadmapCard } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Page, HealthDot, Kpi, Panel } from "@/components/page";
import { ROLES, type Role } from "@/lib/roles";
import { stageLabel } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { homeHeadline } from "@/lib/headlines";
import { homeQuery, settle } from "@/hooks/screen-queries";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Inicio — Nokko" },
      { name: "description", content: "Tu vista según tu rol." },
      { property: "og:title", content: "Inicio — Nokko" },
      { property: "og:description", content: "Tu vista según tu rol." },
    ],
  }),
  loader: ({ context }) => settle(context.queryClient.ensureQueryData(homeQuery)),
  component: HomePage,
});

function HomePage() {
  const { stages } = useStages();
  const { data: me } = useMe();
  const { money: fmt } = useCurrency();
  const { data: setup } = useSetup();
  const { data: onboarding } = useOnboarding();
  const { data: suggestions = [] } = useSuggestions();
  // The strategy card already shows what is missing; don't repeat it in the deck.
  const hideSetup =
    !!me?.roles.some((r) => r === "owner" || r === "sales_leader") &&
    !!setup &&
    showRoadmapCard(onboarding, setup.status.pct);
  const nextSteps = (
    hideSetup
      ? suggestions.filter((x) => !x.dedupe_key?.startsWith("setup_incomplete:"))
      : suggestions
  ).slice(0, 5);
  const { open: openAgent } = useAgent();
  const { data } = useQuery(homeQuery);
  const role = (me?.roles[0] ?? "ae") as Role;
  const open = (data?.deals ?? []).filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipeline = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const weighted = open.reduce(
    (s, d) => s + (Number(d.amount ?? 0) * (d.probability ?? 0)) / 100,
    0,
  );
  const risk = open.filter((d) => d.health === "red");
  const mine = open.filter((d) => d.owner_id === me?.user.id);
  const leader = role === "sales_leader" || role === "owner";
  const scope = leader ? open : mine;
  const scopeRisk = scope.filter((d) => d.health === "red");
  const today = new Date().toISOString().slice(0, 10);
  const firstName = me?.profile?.full_name?.split(" ")[0] ?? "";
  const headline = homeHeadline({
    riskDeals: scopeRisk.length,
    riskAmount: scopeRisk.reduce((s, d) => s + Number(d.amount ?? 0), 0),
    pendingApprovals: leader ? (data?.approvals.length ?? 0) : 0,
    meetingsToday: (data?.meetings ?? []).filter((m) => m.scheduled_at?.slice(0, 10) === today)
      .length,
    openDeals: scope.length,
    openAmount: scope.reduce((s, d) => s + Number(d.amount ?? 0), 0),
    money: fmt,
    fallback: `Hola, ${firstName}`,
  });

  const meetingsToday = (data?.meetings ?? []).filter((m) => m.scheduled_at?.slice(0, 10) === today);

  // B3 (PLAN-UX-20261115): Hoy simplificado — titular, un siguiente mejor paso, tres KPI, reuniones de hoy,
  // respuestas y la bandeja única. El resto vive en Métricas, Pipeline y Cuentas.
  return (
    <Page
      eyebrow={firstName ? `Hola, ${firstName} · ${ROLES[role]?.label ?? ""}` : ROLES[role]?.label}
      title={data ? headline : `Hola, ${firstName}`}
    >
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">Tu foco: {ROLES[role]?.focus}.</p>
      <GuideCard />
      {leader && <RoadmapCard />}
      <section className="mb-8">
        <p className="eyebrow mb-3">Tu siguiente mejor paso</p>
        <SuggestionDeck items={nextSteps.slice(0, 1)} keyboard={false} />
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi size="hero" label="Pipeline abierto" value={fmt(pipeline)} />
        <Kpi
          size="hero"
          label="Deals en riesgo"
          value={String(risk.length)}
          tone={risk.length ? "signal" : undefined}
        />
        <Kpi
          size="hero"
          label="Aprobaciones pendientes"
          value={String(data?.approvals.length ?? 0)}
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <TodayInbox />
        <div className="space-y-6">
          <Panel
            title="Reuniones de hoy"
            action={
              <Link to="/accounts" className="shrink-0 py-2 text-xs text-signal md:py-0">
                Ver cuentas →
              </Link>
            }
          >
            {meetingsToday.length === 0 && (
              <p className="text-sm text-muted-foreground">Hoy no tienes reuniones.</p>
            )}
            {meetingsToday.map((m) => (
              <Link
                key={m.id}
                to="/accounts/$id"
                params={{ id: m.account_id ?? "" }}
                className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-0 hover:text-signal"
              >
                <span className="min-w-0 truncate">{m.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {m.scheduled_at
                    ? new Date(m.scheduled_at).toLocaleTimeString("es-ES", { timeStyle: "short" })
                    : ""}
                </span>
              </Link>
            ))}
          </Panel>
          <RepliesPanel />
        </div>
      </div>
    </Page>
  );
}

function RepliesPanel() {
  const { data: count = 0 } = useQuery({
    queryKey: ["home-replies"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { count } = await supabase
        .from("inbox_replies")
        .select("id", { count: "exact", head: true })
        .gte("received_at", since);
      return count ?? 0;
    },
  });
  return (
    <Panel
      title="Respuestas"
      action={
        <Link to="/replies" className="shrink-0 py-2 text-xs text-signal md:py-0">
          Abrir →
        </Link>
      }
    >
      <p className="text-sm">
        {count === 0
          ? "Sin respuestas nuevas en los últimos 7 días."
          : `${count} ${count === 1 ? "respuesta" : "respuestas"} en los últimos 7 días.`}
      </p>
    </Panel>
  );
}
