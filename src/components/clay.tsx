// Clay on the screens: prospecting on Cuentas, stakeholders on the account map and «Completar con Clay»
// on the account's fit data. Searches run on the server; saving uses the browser client (RLS).
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Pick } from "@/components/fields";
import { CountryPick } from "@/components/country-pick";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";
import { accountInsertFromDraft } from "@/lib/apollo";
import {
  CLAY_REVENUES,
  CLAY_SENIORITY,
  ENRICH_LABEL,
  SENIORITY_LABEL,
  enrichPatch,
  icpToQuery,
  quotaText,
  type ClayQuota,
  type EnrichChange,
  type EnrichField,
} from "@/lib/clay";
import { clayCompanies, clayEnrich, clayIndustryList, clayPeople } from "@/lib/clay.functions";

const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const PAGE = 10;

function Quota({ q }: { q: ClayQuota }) {
  const t = quotaText(q);
  return t ? <p className="text-xs text-muted-foreground">{t}</p> : null;
}

// ---------------- Prospecting (Cuentas) ----------------

type CompanyRow = Awaited<ReturnType<typeof clayCompanies>>["rows"][number];

export function ClayProspectButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Buscar en Clay</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prospectar cuentas con Clay</DialogTitle>
        </DialogHeader>
        <ClayProspect />
      </DialogContent>
    </Dialog>
  );
}

function ClayProspect() {
  const qc = useQueryClient();
  const search = useServerFn(clayCompanies);
  const industriesFn = useServerFn(clayIndustryList);
  const [keywords, setKeywords] = useState("");
  const [industries, setIndustries] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [minEmp, setMinEmp] = useState("");
  const [maxEmp, setMaxEmp] = useState("");
  const [revFrom, setRevFrom] = useState("");
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const { data: known = [] } = useAccountOptions(rows.length > 0);
  const view = markKnown(rows, known);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [searchId, setSearchId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [quota, setQuota] = useState<ClayQuota>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(false);
  const { data: icps = [] } = useQuery({
    queryKey: ["clay-icps"],
    queryFn: async () =>
      (
        await supabase
          .from("icp_profiles")
          .select("id,name,industries,company_size,geography")
          .order("name")
      ).data ?? [],
  });
  const { data: industryList = [] } = useQuery({
    queryKey: ["clay-industries"],
    queryFn: () => industriesFn(),
    staleTime: 3_600_000,
  });

  function useIcp(id: string) {
    const icp = icps.find((i) => i.id === id);
    if (!icp) return;
    const q = icpToQuery(icp);
    setKeywords((q.keywords ?? []).join(", "));
    setCountries(q.countries ?? []);
    setMinEmp(q.minEmployees ? String(q.minEmployees) : "");
    setMaxEmp(q.maxEmployees ? String(q.maxEmployees) : "");
    toast.success(`Criterios cargados desde «${icp.name}». Revísalos antes de buscar.`);
  }

  async function run(more: boolean) {
    setBusy(true);
    try {
      const revenues = revFrom
        ? CLAY_REVENUES.slice(CLAY_REVENUES.indexOf(revFrom as (typeof CLAY_REVENUES)[number]))
        : [];
      const r = await search({
        data:
          more && searchId
            ? { searchId, limit: PAGE }
            : {
                limit: PAGE,
                query: {
                  keywords: split(keywords),
                  industries: split(industries),
                  countries,
                  revenues: [...revenues],
                  minEmployees: Number(minEmp) || null,
                  maxEmployees: Number(maxEmp) || null,
                },
              },
      });
      setRows(more ? [...rows, ...r.rows] : r.rows);
      if (!more) setPicked(new Set());
      setSearchId(r.searchId);
      setHasMore(r.hasMore);
      setQuota(r.quota);
      if (!r.rows.length && !more)
        toast.message("Clay no ha encontrado empresas con esos criterios. Prueba a quitar alguno.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
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
      setRows(
        rows.map((r) =>
          r.domain && ids.has(r.domain) ? { ...r, existingId: ids.get(r.domain)! } : r,
        ),
      );
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${data?.length ?? 0} cuentas añadidas desde Clay.`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const selectable = view.filter((r) => r.domain && !r.existingId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Busca empresas que encajen con tu ICP y añádelas como cuentas. Cada resultado gasta cupo de
        tu cuenta de Clay, por eso se traen de {PAGE} en {PAGE}.
      </p>
      {icps.length > 0 && (
        <Field label="Partir de un ICP">
          <Pick
            aria-label="Partir de un ICP"
            value=""
            options={{
              "": "Elige un ICP…",
              ...Object.fromEntries(icps.map((i) => [i.id, i.name])),
            }}
            onChange={useIcp}
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Palabras clave (en su descripción)">
          <Input
            value={keywords}
            placeholder="payments, logistics, B2B SaaS"
            onChange={(e) => setKeywords(e.target.value)}
          />
        </Field>
        <Field label="Sector de LinkedIn (en inglés)">
          <Input
            list="clay-industries"
            value={industries}
            placeholder="Software Development, Financial Services"
            onChange={(e) => setIndustries(e.target.value)}
          />
          <datalist id="clay-industries">
            {industryList.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </Field>
        <Field label="Países">
          <CountryPick
            aria-label="Añadir país"
            value={null}
            empty="Añadir país…"
            onChange={(v) => v && !countries.includes(v) && setCountries([...countries, v])}
          />
          {countries.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-2 text-sm">
              {countries.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="underline"
                  aria-label={`Quitar ${countryName(c)}`}
                  onClick={() => setCountries(countries.filter((x) => x !== c))}
                >
                  {countryName(c)} ×
                </button>
              ))}
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empleados mín.">
            <Input
              inputMode="numeric"
              value={minEmp}
              onChange={(e) => setMinEmp(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Empleados máx.">
            <Input
              inputMode="numeric"
              value={maxEmp}
              onChange={(e) => setMaxEmp(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </div>
        <Field label="Ingresos anuales desde (USD)">
          <Pick
            aria-label="Ingresos anuales desde"
            value={revFrom}
            options={{ "": "Cualquiera", ...Object.fromEntries(CLAY_REVENUES.map((r) => [r, r])) }}
            onChange={setRevFrom}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => run(false)} disabled={busy}>
          {busy ? "Buscando…" : "Buscar empresas"}
        </Button>
        <Quota q={quota} />
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr>
                  {["", "Empresa", "Sector", "Tamaño", "País", ""].map((h, i) => (
                    <th key={i} className="eyebrow px-2 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((r, i) => (
                  <tr key={`${r.domain ?? r.name}-${i}`} className="border-t align-top">
                    <td className="px-2 py-2">
                      {r.domain && !r.existingId && (
                        <Checkbox
                          aria-label={`Elegir ${r.name}`}
                          checked={picked.has(r.domain)}
                          onCheckedChange={(v) => {
                            const n = new Set(picked);
                            if (v) n.add(r.domain!);
                            else n.delete(r.domain!);
                            setPicked(n);
                          }}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="block break-all text-xs text-muted-foreground">
                        {r.domain ?? "sin dominio"}
                        {r.location ? ` · ${r.location}` : ""}
                      </span>
                      {r.description && (
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">{r.industry}</td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {r.size}
                      {r.revenue ? (
                        <span className="block text-xs text-muted-foreground">{r.revenue} USD</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{r.country ? countryName(r.country) : ""}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">
                      {r.existingId ? (
                        <Link
                          to="/accounts/$id"
                          params={{ id: r.existingId }}
                          className="underline"
                        >
                          Ya está en Nokko
                        </Link>
                      ) : !r.domain ? (
                        <span className="text-muted-foreground">Sin dominio</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!selectable.length}
              onClick={() =>
                setPicked(
                  picked.size === selectable.length
                    ? new Set()
                    : new Set(selectable.map((r) => r.domain!)),
                )
              }
            >
              {picked.size === selectable.length && selectable.length
                ? "Quitar selección"
                : "Elegir todas"}
            </Button>
            {hasMore && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(true)}>
                Traer {PAGE} más
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={target} onCheckedChange={(v) => setTarget(!!v)} />
              Marcar como objetivo ABM
            </label>
            <Button disabled={busy || !picked.size} onClick={importPicked}>
              Añadir {picked.size || ""} {picked.size === 1 ? "cuenta" : "cuentas"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Stakeholders (account map) ----------------

type PersonRow = Awaited<ReturnType<typeof clayPeople>>["rows"][number];
const DEFAULT_SENIORITY = ["c-suite", "vp", "director", "head"];

export function ClayPeopleButton({
  accountId,
  hasDomain,
  onAdded,
}: {
  accountId: string;
  hasDomain: boolean;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasDomain}
          title={hasDomain ? undefined : "Añade el dominio de la cuenta para buscar en Clay"}
        >
          Buscar en Clay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar stakeholders con Clay</DialogTitle>
        </DialogHeader>
        {open && <ClayPeople accountId={accountId} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

function ClayPeople({ accountId, onAdded }: { accountId: string; onAdded: () => void }) {
  const search = useServerFn(clayPeople);
  const [titles, setTitles] = useState("");
  const [seniority, setSeniority] = useState<string[]>(DEFAULT_SENIORITY);
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [searchId, setSearchId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [quota, setQuota] = useState<ClayQuota>(null);
  const [busy, setBusy] = useState(false);

  async function run(more: boolean) {
    setBusy(true);
    try {
      const r = await search({
        data:
          more && searchId
            ? { accountId, searchId, limit: PAGE }
            : {
                accountId,
                limit: PAGE,
                query: {
                  titles: split(titles),
                  seniority: seniority as (typeof CLAY_SENIORITY)[number][],
                  countries: [],
                },
              },
      });
      setRows(more ? [...rows, ...r.rows] : r.rows);
      if (!more) setPicked(new Set());
      setSearchId(r.searchId);
      setHasMore(r.hasMore);
      setQuota(r.quota);
      if (!r.rows.length && !more)
        toast.message("Clay no ha encontrado personas con esos criterios en esta empresa.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const chosen = rows.filter((_, i) => picked.has(i));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("stakeholders").insert(
        chosen.map((p) => ({
          account_id: accountId,
          name: p.name,
          title: p.title,
          linkedin_url: p.linkedin_url,
        })),
      );
      if (error) throw error;
      setRows(rows.map((p, i) => (picked.has(i) ? { ...p, existingId: "added" } : p)));
      setPicked(new Set());
      onAdded();
      toast.success(
        `${chosen.length} ${chosen.length === 1 ? "persona añadida" : "personas añadidas"} al mapa de poder.`,
      );
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Busca a las personas de esta empresa por cargo y seniority. Cada resultado gasta cupo de tu
        cuenta de Clay.
      </p>
      <Field label="Palabras del cargo">
        <Input
          value={titles}
          placeholder="Sales, Revenue, Finance, Operations"
          onChange={(e) => setTitles(e.target.value)}
        />
      </Field>
      <div>
        <p className="eyebrow mb-2">Seniority</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {CLAY_SENIORITY.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={seniority.includes(s)}
                onCheckedChange={(v) =>
                  setSeniority(v ? [...seniority, s] : seniority.filter((x) => x !== s))
                }
              />
              {SENIORITY_LABEL[s]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => run(false)} disabled={busy}>
          {busy ? "Buscando…" : "Buscar personas"}
        </Button>
        <Quota q={quota} />
      </div>
      {rows.length > 0 && (
        <div className="space-y-3">
          <ul className="divide-y border-t">
            {rows.map((p, i) => (
              <li
                key={`${p.linkedin_url ?? p.name}-${i}`}
                className="flex items-start gap-3 py-2 text-sm"
              >
                {!p.existingId ? (
                  <Checkbox
                    aria-label={`Elegir ${p.name}`}
                    className="mt-0.5"
                    checked={picked.has(i)}
                    onCheckedChange={(v) => {
                      const n = new Set(picked);
                      if (v) n.add(i);
                      else n.delete(i);
                      setPicked(n);
                    }}
                  />
                ) : (
                  <span className="w-4" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.name}</span>
                  {p.title && <span className="text-muted-foreground"> · {p.title}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {p.location}
                    {p.linkedin_url && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={p.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          LinkedIn
                        </a>
                      </>
                    )}
                  </span>
                </span>
                {p.existingId && (
                  <span className="text-xs text-muted-foreground">Ya está en el mapa</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {hasMore && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(true)}>
                Traer {PAGE} más
              </Button>
            )}
            <Button disabled={busy || !picked.size} onClick={add}>
              Añadir {picked.size || ""} al mapa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Enrichment (account fit data) ----------------

export function ClayEnrich({
  account,
  onSaved,
}: {
  account: { id: string; domain: string | null };
  onSaved: () => void;
}) {
  const enrich = useServerFn(clayEnrich);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    changes: EnrichChange[];
    quota: ClayQuota;
  } | null>(null);
  const [picked, setPicked] = useState<EnrichField[]>([]);

  async function run() {
    setBusy(true);
    try {
      const r = await enrich({ data: { accountId: account.id } });
      setResult(r);
      setPicked(r.changes.filter((c) => c.empty).map((c) => c.field));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!result) return;
    const patch = enrichPatch(result.changes, picked);
    if (!Object.keys(patch).length) return;
    setBusy(true);
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Cuenta completada con los datos de Clay.");
    setResult(null);
    onSaved();
  }
  const show = (c: EnrichChange, v: string | null) =>
    v && c.field === "country" ? countryName(v) : v;

  if (!account.domain)
    return (
      <p className="text-xs text-muted-foreground">
        Añade el dominio de la cuenta para completarla con Clay.
      </p>
    );
  if (!result)
    return (
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? "Consultando Clay…" : "Completar con Clay"}
      </Button>
    );
  if (!result.found)
    return (
      <p className="text-sm text-muted-foreground">
        Clay no tiene datos de {account.domain}.{" "}
        <button className="underline" onClick={() => setResult(null)}>
          Cerrar
        </button>
      </p>
    );
  if (!result.changes.length)
    return (
      <p className="text-sm text-muted-foreground">
        Clay no aporta nada nuevo: los datos ya coinciden.{" "}
        <button className="underline" onClick={() => setResult(null)}>
          Cerrar
        </button>
      </p>
    );
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="eyebrow">Datos de Clay</p>
      {result.changes.map((c) => (
        <label key={c.field} className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={picked.includes(c.field)}
            onCheckedChange={(v) =>
              setPicked(v ? [...picked, c.field] : picked.filter((x) => x !== c.field))
            }
          />
          <span className="min-w-0">
            <span className="font-medium">{ENRICH_LABEL[c.field]}:</span>{" "}
            <span className={c.field === "notes" ? "line-clamp-3" : ""}>{show(c, c.proposed)}</span>
            {c.current && (
              <span className="block text-xs text-muted-foreground">
                Ahora: {c.field === "notes" ? "tiene notas (se sustituirían)" : show(c, c.current)}
              </span>
            )}
          </span>
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={apply} disabled={busy || !picked.length}>
          Aplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
          Descartar
        </Button>
      </div>
      <Quota q={result.quota} />
    </div>
  );
}
