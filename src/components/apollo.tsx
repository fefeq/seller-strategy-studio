// Apollo on the screens: prospecting on Cuentas, people search + reveal on the account map,
// email/mobile reveal on a stakeholder, «Completar con Apollo» and the list of revealed phones.
import { useAccountOptions } from "@/components/entity-combobox";
import { markKnown } from "@/lib/match";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/fields";
import { CountryPick } from "@/components/country-pick";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";
import {
  APOLLO_SENIORITY,
  accountInsertFromDraft,
  APOLLO_SENIORITY_LABEL,
  MAX_REVEAL,
  PHONE_TYPE,
  type ApolloPhone,
} from "@/lib/apollo";
import { ENRICH_LABEL, enrichPatch, type EnrichChange, type EnrichField } from "@/lib/clay";
import { apolloCompanies, apolloEnrich, apolloPeople, apolloRevealStakeholder, apolloRevealToAccount } from "@/lib/apollo.functions";

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const PHONE_WAIT = "Apollo envía los móviles unos minutos después de pedirlos; aparecerán aquí solos.";

// ---------------- Prospecting (Cuentas) ----------------

type CompanyRow = Awaited<ReturnType<typeof apolloCompanies>>["rows"][number];

export function ApolloProspectButton() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Buscar en Apollo</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Prospectar cuentas con Apollo</DialogTitle></DialogHeader>
        <ApolloProspect />
      </DialogContent>
    </Dialog>
  );
}

function ApolloProspect() {
  const qc = useQueryClient();
  const search = useServerFn(apolloCompanies);
  const [keywords, setKeywords] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [minEmp, setMinEmp] = useState("");
  const [maxEmp, setMaxEmp] = useState("");
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const { data: known = [] } = useAccountOptions(rows.length > 0);
  const view = markKnown(rows, known);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(false);

  async function run(next: number) {
    setBusy(true);
    try {
      const r = await search({ data: { page: next, query: { keywords: split(keywords), countries, minEmployees: Number(minEmp) || null, maxEmployees: Number(maxEmp) || null } } });
      setRows(next > 1 ? [...rows, ...r.rows] : r.rows);
      if (next === 1) setPicked(new Set());
      setPage(next); setHasMore(r.hasMore);
      if (!r.rows.length && next === 1) toast.message("Apollo no ha encontrado empresas con esos criterios. Prueba a quitar alguno.");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  async function importPicked() {
    const chosen = view.filter((r) => r.domain && picked.has(r.domain) && !r.existingId);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .insert(chosen.map((r) => accountInsertFromDraft(r, target)))
        .select("id,domain");
      if (error) throw error;
      await supabase.from("account_plans").insert((data ?? []).map((a) => ({ account_id: a.id })));
      const ids = new Map((data ?? []).map((a) => [a.domain, a.id]));
      setRows(rows.map((r) => (r.domain && ids.has(r.domain) ? { ...r, existingId: ids.get(r.domain)! } : r)));
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${data?.length ?? 0} cuentas añadidas desde Apollo.`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const selectable = view.filter((r) => r.domain && !r.existingId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Busca empresas y añádelas como cuentas. Cada página de resultados gasta créditos de tu cuenta de Apollo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Palabras clave (sector o producto)"><Input value={keywords} placeholder="payments, logistics, saas" onChange={(e) => setKeywords(e.target.value)} /></Field>
        <Field label="Países">
          <CountryPick aria-label="Añadir país" value={null} empty="Añadir país…" onChange={(v) => v && !countries.includes(v) && setCountries([...countries, v])} />
          {countries.length > 0 && <p className="mt-1 flex flex-wrap gap-2 text-sm">{countries.map((c) => <button key={c} type="button" className="underline" aria-label={`Quitar ${countryName(c)}`} onClick={() => setCountries(countries.filter((x) => x !== c))}>{countryName(c)} ×</button>)}</p>}
        </Field>
        <Field label="Empleados mín."><Input inputMode="numeric" value={minEmp} onChange={(e) => setMinEmp(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Empleados máx."><Input inputMode="numeric" value={maxEmp} onChange={(e) => setMaxEmp(e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      <Button onClick={() => run(1)} disabled={busy}>{busy ? "Buscando…" : "Buscar empresas"}</Button>
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="text-left"><tr>{["", "Empresa", "Sector", "Tamaño", "País", ""].map((h, i) => <th key={i} className="eyebrow px-2 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {view.map((r, i) => (
                  <tr key={`${r.domain ?? r.name}-${i}`} className="border-t align-top">
                    <td className="px-2 py-2">{r.domain && !r.existingId && <Checkbox aria-label={`Elegir ${r.name}`} checked={picked.has(r.domain)} onCheckedChange={(v) => { const n = new Set(picked); v ? n.add(r.domain!) : n.delete(r.domain!); setPicked(n); }} />}</td>
                    <td className="px-2 py-2"><span className="font-medium">{r.name}</span><span className="block break-all text-xs text-muted-foreground">{r.domain ?? "sin dominio"}{r.location ? ` · ${r.location}` : ""}</span></td>
                    <td className="px-2 py-2">{r.industry}</td>
                    <td className="whitespace-nowrap px-2 py-2">{r.size}</td>
                    <td className="px-2 py-2">{r.country ? countryName(r.country) : ""}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">{r.existingId ? <Link to="/accounts/$id" params={{ id: r.existingId }} className="underline">Ya está en Nokko</Link> : !r.domain ? <span className="text-muted-foreground">Sin dominio</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasMore && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(page + 1)}>Siguiente página</Button>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={target} onCheckedChange={(v) => setTarget(!!v)} />Marcar como objetivo ABM</label>
            <Button disabled={busy || !picked.size || !selectable.length} onClick={importPicked}>Añadir {picked.size || ""} {picked.size === 1 ? "cuenta" : "cuentas"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- People search + reveal (account map) ----------------

type PersonRow = Awaited<ReturnType<typeof apolloPeople>>["rows"][number];
const DEFAULT_SENIORITY = ["c_suite", "vp", "director", "head"];

export function ApolloPeopleButton({ accountId, hasDomain, onAdded }: { accountId: string; hasDomain: boolean; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" disabled={!hasDomain} title={hasDomain ? undefined : "Añade el dominio de la cuenta para buscar en Apollo"}>Buscar en Apollo</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Buscar stakeholders con Apollo</DialogTitle></DialogHeader>
        {open && <ApolloPeople accountId={accountId} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

function ApolloPeople({ accountId, onAdded }: { accountId: string; onAdded: () => void }) {
  const search = useServerFn(apolloPeople);
  const reveal = useServerFn(apolloRevealToAccount);
  const [titles, setTitles] = useState("");
  const [seniorities, setSeniorities] = useState<string[]>(DEFAULT_SENIORITY);
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Map<string, string>>(new Map());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(next: number) {
    setBusy(true);
    try {
      const r = await search({ data: { accountId, page: next, query: { titles: split(titles), seniorities: seniorities as (typeof APOLLO_SENIORITY)[number][] } } });
      setRows(next > 1 ? [...rows, ...r.rows] : r.rows);
      if (next === 1) setPicked(new Set());
      setPage(next); setHasMore(r.hasMore);
      if (!r.rows.length && next === 1) toast.message("Apollo no ha encontrado personas con esos criterios en esta empresa.");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  async function revealPicked() {
    const ids = [...picked];
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await reveal({ data: { accountId, apolloIds: ids, phone } });
      const next = new Map(added);
      for (const x of r) next.set(x.contact.apolloId, x.contact.email ? `${x.contact.name} · ${x.contact.email}` : `${x.contact.name} · sin email`);
      setAdded(next);
      setPicked(new Set());
      onAdded();
      toast.success(`${r.length} ${r.length === 1 ? "persona revelada y añadida" : "personas reveladas y añadidas"} al mapa.${phone ? ` ${PHONE_WAIT}` : ""}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Buscar es gratis; Apollo oculta el apellido y el contacto hasta que revelas a la persona, y revelar gasta créditos por persona (máximo {MAX_REVEAL} a la vez).</p>
      <Field label="Cargos"><Input value={titles} placeholder="Head of Sales, CFO, Operations" onChange={(e) => setTitles(e.target.value)} /></Field>
      <div>
        <p className="eyebrow mb-2">Seniority</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {APOLLO_SENIORITY.map((s) => <label key={s} className="flex items-center gap-2 text-sm"><Checkbox checked={seniorities.includes(s)} onCheckedChange={(v) => setSeniorities(v ? [...seniorities, s] : seniorities.filter((x) => x !== s))} />{APOLLO_SENIORITY_LABEL[s]}</label>)}
        </div>
      </div>
      <Button onClick={() => run(1)} disabled={busy}>{busy ? "Buscando…" : "Buscar personas"}</Button>
      {rows.length > 0 && (
        <div className="space-y-3">
          <ul className="divide-y border-t">
            {rows.map((p) => {
              const done = added.get(p.apolloId);
              return (
                <li key={p.apolloId} className="flex items-start gap-3 py-2 text-sm">
                  {!done ? <Checkbox aria-label={`Elegir ${p.name}`} className="mt-0.5" disabled={!picked.has(p.apolloId) && picked.size >= MAX_REVEAL} checked={picked.has(p.apolloId)} onCheckedChange={(v) => { const n = new Set(picked); v ? n.add(p.apolloId) : n.delete(p.apolloId); setPicked(n); }} /> : <span className="w-4" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{done ?? p.name}</span>{!done && p.title && <span className="text-muted-foreground"> · {p.title}</span>}
                    <span className="block text-xs text-muted-foreground">{done ? "Añadida al mapa" : [p.hasEmail ? "tiene email" : "sin email conocido", p.hasPhone ? "tiene teléfono" : null].filter(Boolean).join(" · ")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {hasMore && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(page + 1)}>Siguiente página</Button>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={phone} onCheckedChange={(v) => setPhone(!!v)} />Pedir también el móvil (cuesta más)</label>
            <Button disabled={busy || !picked.size} onClick={revealPicked}>Revelar y añadir {picked.size || ""}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Reveal on one stakeholder ----------------

/** Email/mobile reveal for a stakeholder already on the map; shows a pending mobile until Apollo delivers it. */
export function ApolloReveal({ stakeholderId, onChange }: { stakeholderId: string; onChange: () => void }) {
  const reveal = useServerFn(apolloRevealStakeholder);
  const [busy, setBusy] = useState<"email" | "phone" | null>(null);
  const { data: pending, refetch } = useQuery({
    queryKey: ["phone-reveal", stakeholderId],
    queryFn: async () => (await supabase.from("phone_reveals").select("status,received_at").eq("stakeholder_id", stakeholderId).order("requested_at", { ascending: false }).limit(1)).data?.[0] ?? null,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 10_000 : false),
  });
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  if (pending?.status && pending.status !== lastStatus) {
    if (lastStatus === "pending" && pending.status !== "pending") onChange();
    setLastStatus(pending.status);
  }

  async function run(phone: boolean) {
    setBusy(phone ? "phone" : "email");
    try {
      const r = await reveal({ data: { stakeholderId, phone } });
      if (!r.found) toast.message("Apollo no ha encontrado a esta persona. Añade su LinkedIn o su email y vuelve a probar.");
      else if (r.phone === "cached") toast.success(`Móvil recuperado sin coste: ${r.phoneNumber}`);
      else if (r.phone === "pending") toast.message(`El móvil ya está pedido. ${PHONE_WAIT}`);
      else if (r.phone === "requested") toast.success(`Pedido a Apollo. ${PHONE_WAIT}`);
      else toast.success(r.contact?.email ? `Email revelado: ${r.contact.email}` : "Apollo no tiene email para esta persona.");
      onChange();
      refetch();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(false)}>{busy === "email" ? "Revelando…" : "Conseguir email"}</Button>
      <Button size="sm" variant="outline" disabled={!!busy || pending?.status === "pending"} onClick={() => run(true)}>{busy === "phone" ? "Pidiendo…" : "Conseguir móvil"}</Button>
      {pending?.status === "pending" && <span className="text-xs text-muted-foreground">Móvil pedido: llegará en unos minutos.</span>}
      {pending?.status === "not_found" && <span className="text-xs text-muted-foreground">Apollo no tenía móvil para esta persona.</span>}
    </div>
  );
}

// ---------------- Enrichment (account fit data) ----------------

export function ApolloEnrich({ account, onSaved }: { account: { id: string; domain: string | null }; onSaved: () => void }) {
  const enrich = useServerFn(apolloEnrich);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ found: boolean; changes: EnrichChange[] } | null>(null);
  const [picked, setPicked] = useState<EnrichField[]>([]);

  async function run() {
    setBusy(true);
    try {
      const r = await enrich({ data: { accountId: account.id } });
      setResult(r);
      setPicked(r.changes.filter((c) => c.empty).map((c) => c.field));
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function apply() {
    if (!result) return;
    const patch = enrichPatch(result.changes, picked);
    if (!Object.keys(patch).length) return;
    setBusy(true);
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Cuenta completada con los datos de Apollo.");
    setResult(null);
    onSaved();
  }
  const show = (c: EnrichChange, v: string | null) => (v && c.field === "country" ? countryName(v) : v);

  if (!account.domain) return null;
  if (!result) return <Button variant="outline" size="sm" onClick={run} disabled={busy}>{busy ? "Consultando Apollo…" : "Completar con Apollo"}</Button>;
  if (!result.found) return <p className="text-sm text-muted-foreground">Apollo no tiene datos de {account.domain}. <button className="underline" onClick={() => setResult(null)}>Cerrar</button></p>;
  if (!result.changes.length) return <p className="text-sm text-muted-foreground">Apollo no aporta nada nuevo: los datos ya coinciden. <button className="underline" onClick={() => setResult(null)}>Cerrar</button></p>;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="eyebrow">Datos de Apollo</p>
      {result.changes.map((c) => (
        <label key={c.field} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={picked.includes(c.field)} onCheckedChange={(v) => setPicked(v ? [...picked, c.field] : picked.filter((x) => x !== c.field))} />
          <span className="min-w-0">
            <span className="font-medium">{ENRICH_LABEL[c.field]}:</span> <span className={c.field === "notes" ? "line-clamp-3" : ""}>{show(c, c.proposed)}</span>
            {c.current && <span className="block text-xs text-muted-foreground">Ahora: {c.field === "notes" ? "tiene notas (se sustituirían)" : show(c, c.current)}</span>}
          </span>
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={apply} disabled={busy || !picked.length}>Aplicar</Button>
        <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Descartar</Button>
      </div>
    </div>
  );
}

// ---------------- Revealed phones (Personas) ----------------

export function ApolloPhones() {
  const { data = [] } = useQuery({
    queryKey: ["phone-reveals"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("phone_reveals").select("id,name,status,phones,requested_at,received_at,stakeholder_id").order("requested_at", { ascending: false }).limit(100);
      const ids = [...new Set((rows ?? []).map((r) => r.stakeholder_id).filter((x): x is string => !!x))];
      const { data: sh } = ids.length ? await supabase.from("stakeholders").select("id,account_id").in("id", ids) : { data: [] as { id: string; account_id: string }[] };
      const acc = new Map((sh ?? []).map((s) => [s.id, s.account_id]));
      return (rows ?? []).map((r) => ({ ...r, accountId: r.stakeholder_id ? acc.get(r.stakeholder_id) ?? null : null }));
    },
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "pending") ? 15_000 : false),
  });
  if (!data.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-3xl">Teléfonos revelados</h2>
      <p className="mt-1 text-sm text-muted-foreground">Los móviles pedidos a Apollo. Llegan unos minutos después de pedirlos y se guardan también en la ficha del stakeholder.</p>
      <div className="mt-4 overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="text-left"><tr>{["Persona", "Teléfono", "Estado", "Recibido"].map((h) => <th key={h} className="eyebrow px-2 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">{r.accountId ? <Link to="/accounts/$id" params={{ id: r.accountId }} search={{ tab: "stakeholders" }} className="underline">{r.name || "Sin nombre"}</Link> : r.name || "Sin nombre"}</td>
                <td className="px-2 py-2 font-mono">{((r.phones as ApolloPhone[] | null) ?? []).map((p) => <span key={p.number} className="block">{p.number}{p.type ? <span className="ml-2 font-sans text-xs text-muted-foreground">{PHONE_TYPE[p.type] ?? p.type}</span> : null}</span>)}</td>
                <td className="px-2 py-2">{r.status === "pending" ? "Pedido, llegará en unos minutos" : r.status === "delivered" ? "Recibido" : "Apollo no tenía móvil"}</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{r.received_at ? new Date(r.received_at).toLocaleString("es-ES") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
