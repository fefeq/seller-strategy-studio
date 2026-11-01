import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AccountQuickActions } from "@/components/quick-actions";
import { CompanyLogo } from "@/components/company-logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAccount } from "@/lib/create-account";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useTeam } from "@/hooks/use-team";
import { canApproveAssignment } from "@/lib/assignment";
import { Page, Empty, HealthDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { errorText } from "@/lib/errors";
import { accountsHeadline } from "@/lib/headlines";
import { byScore, latestOf, scoreAccount, type Score } from "@/lib/scoring";
import { ScoreBadge } from "@/components/score";
import { Switch } from "@/components/ui/switch";
import { AccountImport } from "@/components/account-import";
import { IcpCompaniesButton } from "@/components/orchestrator";
import { duplicateOf } from "@/lib/match";
import { EnrichTableButton } from "@/components/parallel";
import { fetchAll } from "@/lib/fetch-all";
import { askConfirm } from "@/components/confirm-dialog";
import { accountsQuery, accountsScoreContextQuery, settle } from "@/hooks/screen-queries";

export const Route = createFileRoute("/_authenticated/accounts/")({
  head: () => ({
    meta: [
      { title: "Cuentas — Nokko" },
      { name: "description", content: "Todas las cuentas con su plan y stakeholders." },
      { property: "og:title", content: "Cuentas — Nokko" },
      { property: "og:description", content: "Todas las cuentas con su plan y stakeholders." },
    ],
  }),
  loader: ({ context }) =>
    settle(
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(accountsScoreContextQuery),
    ),
  component: Accounts,
});

function Accounts() {
  const { money: eur } = useCurrency();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: team = [] } = useTeam();
  const ownerName = (id: string | null) =>
    id ? (team.find((m) => m.user_id === id)?.name ?? "Ex-miembro") : null;
  const leader = canApproveAssignment(me?.roles ?? []);
  const [q, setQ] = useState("");
  const [byName, setByName] = useState(false);
  const { data = [] } = useQuery(accountsQuery);
  const { data: ctx } = useQuery(accountsScoreContextQuery);
  const scores = useMemo(() => {
    const now = new Date();
    const today = now.toISOString();
    return new Map<string, Score>(
      data.map((a) => {
        const deals = a.deals ?? [];
        const lastActivityAt = latestOf(
          ...(a.account_touches ?? []).map((t) => t.occurred_at),
          ...(a.meetings ?? [])
            .map((m) => m.scheduled_at)
            .filter((d): d is string => !!d && d <= today),
          ...(a.calls ?? []).map((c) => c.occurred_at),
          ...deals.map((d) => d.updated_at),
        );
        return [
          a.id,
          scoreAccount(
            {
              ...a,
              lastActivityAt,
              openDeals: deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
            },
            ctx?.icps ?? [],
            now,
            ctx?.segNames,
          ),
        ];
      }),
    );
  }, [data, ctx]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const dup =
    name.trim() || domain.trim()
      ? duplicateOf(
          { name, domain },
          data.map((a) => ({ id: a.id, name: a.name, domain: a.domain })),
        )
      : null;
  async function create() {
    if (
      dup?.kind === "same" &&
      !(await askConfirm(
        `Ya existe «${dup.item.name}»${dup.item.domain ? ` (${dup.item.domain})` : ""}`,
        { body: "¿Crear otra cuenta igualmente?", confirmLabel: "Crear igualmente" },
      ))
    )
      return;
    const { id, error } = await createAccount(supabase, qc, { name, domain });
    if (error) return toast.error(errorText(error));
    navigate({ to: "/accounts/$id", params: { id } });
  }
  const filtered = data.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const list = byName ? filtered : [...filtered].sort(byScore((a) => scores.get(a.id)!));
  return (
    <Page
      eyebrow="Cuentas"
      title={accountsHeadline({
        total: data.length,
        atRisk: data.filter((a) => a.health === "red").length,
      })}
      actions={
        <div className="flex flex-wrap gap-2">
          {leader && (
            <Button variant="outline" asChild>
              <Link to="/accounts/assignment">
                Reparto
                {data.some((a) => !a.owner_id)
                  ? ` (${data.filter((a) => !a.owner_id).length} sin responsable)`
                  : ""}
              </Link>
            </Button>
          )}
          <IcpCompaniesButton />
          <EnrichTableButton />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Importar CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar cuentas desde CSV</DialogTitle>
              </DialogHeader>
              <AccountImport />
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button>+ Nueva cuenta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cuenta</DialogTitle>
              </DialogHeader>
              <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                placeholder="Dominio (acme.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <Button disabled={!name} onClick={create}>
                Crear
              </Button>
              {dup && (
                <p className="w-full text-xs">
                  Ya existe{" "}
                  <Link
                    to="/accounts/$id"
                    params={{ id: dup.item.id }}
                    className="underline underline-offset-4"
                  >
                    {dup.item.name}
                  </Link>
                  {dup.item.domain ? ` (${dup.item.domain})` : ""}: ábrela en vez de crear otra.
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          placeholder="Buscar cuenta…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!byName} onCheckedChange={(v) => setByName(!v)} />
          Por puntuación
        </label>
      </div>
      {list.length === 0 ? (
        <Empty>Aún no hay cuentas. Crea la primera para empezar su plan de cuenta.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                {[
                  "Cuenta",
                  "Puntuación",
                  "Responsable",
                  "Tier",
                  "Salud",
                  "Stakeholders",
                  "Pipeline",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`eyebrow px-3 py-3 sm:px-4 ${h === "Tier" || h === "Stakeholders" || h === "Responsable" ? "hidden sm:table-cell" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-3 sm:px-4">
                    <CompanyLogo domain={a.domain} size={18} className="mr-2" />
                    <Link
                      to="/accounts/$id"
                      params={{ id: a.id }}
                      className="font-medium hover:text-signal"
                    >
                      {a.name}
                    </Link>
                    <span className="block break-all text-xs text-muted-foreground sm:ml-2 sm:inline">
                      {a.domain}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <ScoreBadge score={scores.get(a.id)!} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {ownerName(a.owner_id) ?? <span className="text-signal">Sin responsable</span>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">{a.tier}</td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <HealthDot value={a.health} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{a.stakeholders?.length ?? 0}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono sm:px-4">
                    {eur(
                      (a.deals ?? [])
                        .filter((d) => d.stage !== "won" && d.stage !== "lost")
                        .reduce((s, d) => s + Number(d.amount ?? 0), 0),
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right sm:px-4">
                    <AccountQuickActions account={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          La puntuación es el encaje con el ICP (70 %) más la actividad reciente (30 %). Abre la
          cuenta para ver por qué.
        </p>
      )}
    </Page>
  );
}
