import { createFileRoute } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/company-logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { latestOf, scoreAccount } from "@/lib/scoring";
import { ScoreDetail } from "@/components/score";
import { SignalsTab } from "@/components/web-research";
import { AccountDriveTab } from "@/components/drive";
import { AccountJobs } from "@/components/linkedin";
import { ProductUsageCard } from "@/components/posthog-panel";
import { AccountReportTab } from "@/components/parallel";
import { FitFields } from "@/components/account/fit-fields";
import { PlanTab } from "@/components/account/plan-tab";
import { StakeholdersTab } from "@/components/account/stakeholders-tab";
import { MeetingsTab } from "@/components/account/meetings-tab";
import { CallsTab, DealsTab } from "@/components/account/calls-deals-tabs";

const ACCOUNT_TABS = ["plan", "report", "signals", "stakeholders", "meetings", "calls", "deals", "drive"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

export const Route = createFileRoute("/_authenticated/accounts/$id")({
  // tab + meeting: deep link from a suggestion straight to one meeting («Apunta las notas…»).
  // people / research: deep links from a notice that reopen the results of a background search.
  validateSearch: (s: Record<string, unknown>): { tab?: AccountTab; meeting?: string; people?: string; research?: string } => ({
    ...(ACCOUNT_TABS.includes(s.tab as AccountTab) ? { tab: s.tab as AccountTab } : {}),
    ...(typeof s.meeting === "string" ? { meeting: s.meeting } : {}),
    ...(s.people ? { people: String(s.people) } : {}),
    ...(s.research ? { research: String(s.research) } : {}),
  }),
  head: () => ({ meta: [{ title: "Cuenta — Nokko" }, { name: "description", content: "Plan de cuenta, stakeholders y reuniones." }, { property: "og:title", content: "Cuenta — Nokko" }, { property: "og:description", content: "Plan de cuenta, stakeholders y reuniones." }] }),
  component: AccountPage,
});

function AccountPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["account", id],
    queryFn: async () => {
      const [a, plan, sh, mt, calls, deals, touches, icps, segs] = await Promise.all([
        supabase.from("accounts").select("*").eq("id", id).single(),
        supabase.from("account_plans").select("*").eq("account_id", id).maybeSingle(),
        supabase.from("stakeholders").select("*").eq("account_id", id).order("created_at"),
        supabase.from("meetings").select("*").eq("account_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("calls").select("*").eq("account_id", id).order("occurred_at", { ascending: false }),
        supabase.from("deals").select("*").eq("account_id", id),
        supabase.from("account_touches").select("occurred_at").eq("account_id", id),
        supabase.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords"),
        supabase.from("segments").select("id,name"),
      ]);
      return { account: a.data, plan: plan.data, stakeholders: sh.data ?? [], meetings: mt.data ?? [], calls: calls.data ?? [], deals: deals.data ?? [], touches: touches.data ?? [], icps: icps.data ?? [], segNames: new Map((segs.data ?? []).map((s) => [s.id, s.name])) };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["account", id] });
  if (!data?.account) return <Page title="Cargando…"><div /></Page>;
  const a = data.account;
  const now = new Date();
  const score = scoreAccount({
    ...a,
    lastActivityAt: latestOf(...data.touches.map((t) => t.occurred_at), ...data.meetings.map((m) => m.scheduled_at).filter((d): d is string => !!d && d <= now.toISOString()), ...data.calls.map((c) => c.occurred_at), ...data.deals.map((d) => d.updated_at)),
    openDeals: data.deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
  }, data.icps, now, data.segNames);

  return (
    <Page eyebrow="Cuenta" title={a.name} titleAside={a.domain ? <CompanyLogo domain={a.domain} size={40} /> : undefined} actions={
      <div className="flex flex-wrap items-center gap-2">
        <Select value={a.health ?? "green"} onValueChange={async (v) => { await supabase.from("accounts").update({ health: v }).eq("id", id); refresh(); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="green">Sana</SelectItem><SelectItem value="yellow">Atención</SelectItem><SelectItem value="red">En riesgo</SelectItem></SelectContent>
        </Select>
        <Select value={a.tier ?? "B"} onValueChange={async (v) => { await supabase.from("accounts").update({ tier: v }).eq("id", id); refresh(); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{["A", "B", "C"].map((t) => <SelectItem key={t} value={t}>Tier {t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    }>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="space-y-4"><ScoreDetail score={score} /><ProductUsageCard accountId={id} /></div>
        <FitFields account={a} segNames={data.segNames} onSaved={refresh} />
      </div>
      <Tabs key={`${id}-${search.tab ?? "plan"}-${search.meeting ?? ""}`} defaultValue={search.tab ?? "plan"}>
        <TabsList className="mb-6">
          <TabsTrigger value="plan">Plan de cuenta</TabsTrigger>
          <TabsTrigger value="report">Informe</TabsTrigger>
          <TabsTrigger value="signals">Señales</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders ({data.stakeholders.length})</TabsTrigger>
          <TabsTrigger value="meetings">Planificador de reuniones ({data.meetings.length})</TabsTrigger>
          <TabsTrigger value="calls">Llamadas ({data.calls.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({data.deals.length})</TabsTrigger>
          <TabsTrigger value="drive">Drive</TabsTrigger>
        </TabsList>
        <TabsContent value="plan"><PlanTab accountId={id} accountName={a.name} hasDomain={!!a.domain} plan={data.plan} onSaved={refresh} /></TabsContent>
        <TabsContent value="report"><AccountReportTab accountId={id} accountName={a.name} /></TabsContent>
        <TabsContent value="signals"><SignalsTab accountId={id} hasDomain={!!a.domain} /><div className="mt-6"><AccountJobs accountId={id} /></div></TabsContent>
        <TabsContent value="stakeholders"><StakeholdersTab accountId={id} hasDomain={!!a.domain} list={data.stakeholders} onChange={refresh} /></TabsContent>
        <TabsContent value="meetings"><MeetingsTab accountId={id} openMeetingId={search.meeting} list={data.meetings} stakeholders={data.stakeholders} deals={data.deals} onChange={refresh} /></TabsContent>
        <TabsContent value="calls"><CallsTab accountId={id} list={data.calls} onChange={refresh} /></TabsContent>
        <TabsContent value="deals"><DealsTab accountId={id} list={data.deals} onChange={refresh} /></TabsContent>
        <TabsContent value="drive"><AccountDriveTab accountId={id} /></TabsContent>
      </Tabs>
    </Page>
  );
}

