import { JargonTerm } from "@/components/jargon-term";
import { X } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EntityCombobox, useAccountOptions, usePeopleOptions } from "@/components/entity-combobox";
import { duplicateOf } from "@/lib/match";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page, Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { engagementScore, registrationConflict, TOUCH_WEIGHTS } from "@/lib/metrics";
import { errorText } from "@/lib/errors";
import { askConfirm, askText } from "@/components/confirm-dialog";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/abm")({
  head: () => ({
    meta: [
      { title: "ABM y partners — Nokko" },
      { name: "description", content: "Cuentas objetivo, engagement y programa de partners." },
      { property: "og:title", content: "ABM y partners — Nokko" },
      {
        property: "og:description",
        content: "Cuentas objetivo, engagement y programa de partners.",
      },
    ],
  }),
  component: Abm,
});

const CHANNELS: Record<string, string> = {
  web_visit: "Visita web",
  email: "Email",
  linkedin: "LinkedIn",
  direct_mail: "Envío físico",
  event: "Evento",
  call: "Llamada",
  meeting: "Reunión",
};
const PTYPES: Record<string, string> = {
  reseller: "Reseller",
  referral: "Referral",
  technology: "Tecnológico / co-sell",
  integrator: "Integrador (SI)",
  marketplace: "Marketplace cloud",
};
const ABM_TIERS: Record<string, string> = { "1": "1 · 1:1", "2": "2 · 1:few", "3": "3 · 1:many" };
const REG_STATUS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  expired: "Caducado",
};

function Abm() {
  return (
    <Page eyebrow="Account-based y canal" title="ABM y partners">
      <p className="mb-4 text-sm text-ink-mid">
        ¿Qué es <JargonTerm term="ABM" />?
      </p>
      <Tabs defaultValue="abm">
        <TabsList className="mb-6">
          <TabsTrigger value="abm">Cuentas objetivo</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="regs">Registro de deals</TabsTrigger>
        </TabsList>
        <TabsContent value="abm">
          <Targets />
        </TabsContent>
        <TabsContent value="partners">
          <Partners />
        </TabsContent>
        <TabsContent value="regs">
          <Registrations />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Targets() {
  const qc = useQueryClient();
  const [touchFor, setTouchFor] = useState<string | null>(null);
  const [channel, setChannel] = useState("email");
  const [note, setNote] = useState("");
  const { data } = useQuery({
    queryKey: ["abm"],
    queryFn: async () => {
      const [a, t] = await Promise.all([
        supabase.from("accounts").select("id,name,domain,is_target,abm_tier,tier,health"),
        supabase.from("account_touches").select("*").order("occurred_at", { ascending: false }),
      ]);
      return { accounts: a.data ?? [], touches: t.data ?? [] };
    },
  });
  const accounts = data?.accounts ?? [];
  const targets = accounts
    .filter((a) => a.is_target)
    .map((a) => {
      const ts = (data?.touches ?? []).filter((t) => t.account_id === a.id);
      return {
        ...a,
        score: engagementScore(ts),
        last: ts[0]?.occurred_at,
        channels: new Set(ts.map((t) => t.channel)).size,
      };
    })
    .sort((x, y) => y.score - x.score);
  async function toggle(id: string, is_target: boolean) {
    await supabase.from("accounts").update({ is_target }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["abm"] });
  }
  async function tier(id: string, abm_tier: string) {
    await supabase.from("accounts").update({ abm_tier }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["abm"] });
  }
  async function logTouch() {
    if (!touchFor) return;
    const { error } = await supabase
      .from("account_touches")
      .insert({ account_id: touchFor, channel, notes: note });
    if (error) return toast.error(errorText(error));
    setNote("");
    setTouchFor(null);
    qc.invalidateQueries({ queryKey: ["abm"] });
  }
  const others = accounts.filter((a) => !a.is_target);
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Recomendado para contratos de más de 100K, ciclos largos y varios decisores. Trabaja 50–500
        cuentas con mensajes personalizados en varios canales, y mide el engagement de cada cuenta
        en lugar del volumen de leads.
      </p>
      {targets.length === 0 ? (
        <Empty>Marca cuentas como objetivo desde la lista de abajo.</Empty>
      ) : (
        <>
          {/* Phones: one card per target account; the table from md. */}
          <div className="divide-y divide-hairline border-t border-hairline md:hidden">
            {targets.map((a) => (
              <div key={a.id} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/accounts/$id"
                    params={{ id: a.id }}
                    className="min-w-0 break-words font-medium hover:text-signal"
                  >
                    {a.name}
                  </Link>
                  <ScoreBar score={a.score} />
                </div>
                <Field label="Tier ABM">
                  <Pick
                    value={a.abm_tier ?? "2"}
                    options={ABM_TIERS}
                    onChange={(v) => tier(a.id, v)}
                  />
                </Field>
                <p className="font-mono text-xs text-muted-foreground">
                  {a.channels} canales · último toque{" "}
                  {a.last ? new Date(a.last).toLocaleDateString("es-ES") : "—"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setTouchFor(a.id)}>
                    + Toque
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(a.id, false)}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {["Cuenta", "Tier ABM", "Engagement (90 d)", "Canales", "Último toque", ""].map(
                    (h) => (
                      <th key={h} className="eyebrow px-3 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {targets.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link
                        to="/accounts/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:text-signal"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 w-40">
                      <Pick
                        value={a.abm_tier ?? "2"}
                        options={ABM_TIERS}
                        onChange={(v) => tier(a.id, v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBar score={a.score} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{a.channels}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {a.last ? new Date(a.last).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setTouchFor(a.id)}>
                        + Toque
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(a.id, false)}>
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {touchFor && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4 [&>div]:w-full sm:[&>div]:w-auto">
          <Field label={`Toque en ${accounts.find((a) => a.id === touchFor)?.name}`}>
            <Pick
              value={channel}
              options={Object.fromEntries(
                Object.entries(CHANNELS).map(([k, v]) => [k, `${v} (+${TOUCH_WEIGHTS[k]})`]),
              )}
              onChange={setChannel}
            />
          </Field>
          <Input
            className="w-full sm:max-w-md"
            placeholder="Nota"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button onClick={logTouch}>Registrar</Button>
          <Button variant="ghost" onClick={() => setTouchFor(null)}>
            <IconText icon={X}>Cancelar</IconText>
          </Button>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Otras cuentas</p>
          <div className="flex flex-wrap gap-2">
            {others.map((a) => (
              <button
                key={a.id}
                onClick={() => toggle(a.id, true)}
                className="min-h-9 rounded-none border px-3 py-2 text-left text-xs hover:border-signal md:min-h-0 md:py-1"
              >
                + {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Partners() {
  const { money: eur } = useCurrency();
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: async () =>
      (await supabase.from("partners").select("*, deals(amount,stage)").order("name")).data ?? [],
  });
  async function add() {
    const name = await askText("Nuevo partner", {
      placeholder: "Nombre del partner",
      confirmLabel: "Crear partner",
    });
    if (!name) return;
    const dup = duplicateOf(
      { name },
      list.map((p) => ({ id: p.id, name: p.name })),
    );
    if (
      dup &&
      !(await askConfirm(`Ya existe el partner «${dup.item.name}»`, {
        body: "¿Crear otro igualmente?",
        confirmLabel: "Crear igualmente",
      }))
    )
      return;
    await supabase.from("partners").insert({ name });
    qc.invalidateQueries({ queryKey: ["partners"] });
  }
  async function upd(id: string, patch: TablesUpdate<"partners">) {
    await supabase.from("partners").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["partners"] });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Para que funcionen hacen falta incentivos claros (los resellers suelen llevarse un 20–30%
          de margen), formación y materiales, registro de deals y marketing conjunto.
        </p>
        <Button size="sm" onClick={add}>
          + Partner
        </Button>
      </div>
      {list.length === 0 && <Empty>Sin partners todavía. Añade el primero con «+ Partner».</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => {
          const won = (p.deals ?? [])
            .filter((d) => d.stage === "won")
            .reduce((s, d) => s + Number(d.amount ?? 0), 0);
          const pipe = (p.deals ?? [])
            .filter((d) => d.stage !== "won" && d.stage !== "lost")
            .reduce((s, d) => s + Number(d.amount ?? 0), 0);
          return (
            <div key={p.id} className="space-y-3 rounded-lg border bg-card p-4">
              <Input
                className="font-display md:text-[22px]"
                defaultValue={p.name}
                onBlur={(e) => upd(p.id, { name: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Tipo">
                  <Pick
                    value={p.partner_type}
                    options={PTYPES}
                    onChange={(v) => upd(p.id, { partner_type: v })}
                  />
                </Field>
                <Field label="Margen %">
                  <Input
                    type="number"
                    defaultValue={p.margin_pct ?? 0}
                    onBlur={(e) => upd(p.id, { margin_pct: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Estado">
                  <Pick
                    value={p.status}
                    options={{ active: "Activo", onboarding: "Onboarding", paused: "Pausado" }}
                    onChange={(v) => upd(p.id, { status: v })}
                  />
                </Field>
              </div>
              <Field label="Contacto">
                <PartnerContact value={p.contact ?? ""} onSave={(v) => upd(p.id, { contact: v })} />
              </Field>
              <p className="font-mono text-xs text-muted-foreground">
                Pipeline {eur(pipe)} · Ganado {eur(won)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Registrations() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canDecide = me?.roles.some(
    (r) => r === "owner" || r === "sales_leader" || r === "deal_desk",
  );
  const { data } = useQuery({
    queryKey: ["regs"],
    queryFn: async () => {
      const [r, p] = await Promise.all([
        supabase
          .from("deal_registrations")
          .select("*, partners(name)")
          .order("created_at", { ascending: false }),
        supabase.from("partners").select("id,name"),
      ]);
      return { regs: r.data ?? [], partners: p.data ?? [] };
    },
  });
  const [partner, setPartner] = useState("");
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");
  const regs = data?.regs ?? [];
  const { data: accounts = [] } = useAccountOptions();
  const conflict = partner && account ? registrationConflict(account, regs, partner) : undefined;
  async function submit() {
    const expires = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
    const { error } = await supabase
      .from("deal_registrations")
      .insert({ partner_id: partner, account_name: account, notes, expires_at: expires });
    if (error) return toast.error(errorText(error));
    if (conflict) {
      await supabase.from("approvals").insert({
        kind: "other",
        title: `Conflicto de canal: ${account}`,
        evidence: `Ya registrado por ${conflict.partners?.name ?? "otro partner"} (${REG_STATUS[conflict.status]}).`,
      });
      toast.warning("Registrado con conflicto: enviado a Aprobaciones.");
    } else toast.success("Registro enviado.");
    setAccount("");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["regs"] });
  }
  async function decide(id: string, status: string) {
    await supabase.from("deal_registrations").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["regs"] });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h3 className="text-2xl">Registrar oportunidad de partner</h3>
        <Field label="Partner">
          <Pick
            value={partner}
            options={Object.fromEntries([
              ["", "Elige…"],
              ...(data?.partners ?? []).map((p) => [p.id, p.name]),
            ])}
            onChange={setPartner}
          />
        </Field>
        <Field label="Cuenta">
          <EntityCombobox
            items={accounts}
            value={account}
            selectedId={accounts.find((a) => a.name === account)?.id ?? null}
            onChange={(t) => setAccount(t)}
            placeholder="Busca entre tus cuentas"
            noun="cuenta nueva"
            logos
            ariaLabel="Cuenta"
          />
        </Field>
        <Field label="Notas">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {conflict && (
          <p className="rounded bg-signal/10 p-2 text-xs text-signal">
            Esta cuenta ya está registrada por {conflict.partners?.name ?? "otro partner"}. Si
            continúas, se enviará a Aprobaciones.
          </p>
        )}
        <Button disabled={!partner || !account} onClick={submit}>
          Registrar (válido 90 días)
        </Button>
      </div>
      <div className="space-y-2">
        {regs.length === 0 && (
          <Empty>Sin registros de partner. Registra una oportunidad con el formulario.</Empty>
        )}
        {regs.map((r) => {
          const expired = r.expires_at && new Date(r.expires_at) < new Date();
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border bg-card p-3 text-sm"
            >
              <div className="min-w-0 break-words">
                <p className="font-medium">{r.account_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.partners?.name} · caduca {r.expires_at}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-1.5 font-mono text-xs uppercase">
                  {expired ? "Caducado" : REG_STATUS[r.status]}
                </span>
                {canDecide && r.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => decide(r.id, "approved")}>
                      Aprobar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="h-1.5 w-24 rounded bg-muted">
        <div
          className="h-full rounded bg-signal"
          style={{ width: `${Math.min(100, score * 3)}%` }}
        />
      </div>
      <span className="font-mono text-xs">{score}</span>
    </div>
  );
}

/** Partner contact: suggests people already in Personas; saved as text when leaving the field. */
function PartnerContact({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const { data: people = [] } = usePeopleOptions();
  return (
    <div
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
    >
      <EntityCombobox
        items={people}
        value={v}
        selectedId={people.find((p) => p.name === v)?.id ?? null}
        onChange={(t) => setV(t)}
        placeholder="Busca en Personas o escribe"
        noun="contacto nuevo"
        ariaLabel="Contacto"
      />
    </div>
  );
}
