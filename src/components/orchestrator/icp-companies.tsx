import { useAccountOptions } from "@/components/entity-combobox";
import { duplicateOf } from "@/lib/match";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateSetup } from "@/hooks/setup-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { JobProgress, useJob, type BgJob } from "@/components/background";
import { freshResult } from "@/lib/jobs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Pick } from "@/components/fields";
import { CountryPick } from "@/components/country-pick";
import { CompanyLogo } from "@/components/company-logo";
import { IcpListButton } from "@/components/parallel";
import { type orchestrateIcpCompanies } from "@/lib/orchestrator.functions";
import { icpCompanyQuery } from "@/lib/icp";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";
import { accountInsertFromDraft } from "@/lib/apollo";
import { splitList } from "@/components/orchestrator/key-people";

// ---------------- «Buscar empresas por ICP» (Cuentas) ----------------

export type CompaniesRes = Awaited<ReturnType<typeof orchestrateIcpCompanies>>;

export type CompaniesJob = {
  search?: CompaniesRes;
  query?: {
    keywords?: string[];
    countries?: string[];
    minEmployees?: number | null;
    maxEmployees?: number | null;
  };
};

export function IcpCompaniesButton() {
  const search = useSearch({ strict: false }) as { icp?: string | number };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  useEffect(() => {
    if (search.icp) {
      setOpen(true);
      void navigate({
        to: ".",
        search: ((s: Record<string, unknown>) => ({ ...s, icp: undefined })) as never,
        replace: true,
      });
    }
  }, [search.icp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Buscar empresas por ICP</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buscar empresas por ICP</DialogTitle>
          </DialogHeader>
          {open && (
            <IcpCompanies
              onDeep={() => {
                setOpen(false);
                setDeepOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <IcpListButton open={deepOpen} onOpenChange={setDeepOpen} hideTrigger />
    </>
  );
}

export function IcpCompanies({ onDeep }: { onDeep: () => void }) {
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob<"icp_companies", CompaniesJob>("icp_companies", {
    onDone: () => {
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
    },
  });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const done = freshResult<BgJob<CompaniesJob>>(job, dismissed);
  const [keywords, setKeywords] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [minEmp, setMinEmp] = useState("");
  const [maxEmp, setMaxEmp] = useState("");
  const [imported, setImported] = useState<Map<string, string>>(new Map());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: icps = [] } = useQuery({
    queryKey: ["clay-icps"],
    queryFn: async () => (await supabase.from("icp_profiles").select("*").order("name")).data ?? [],
  });
  const { data: known = [] } = useAccountOptions(!!done?.result?.search);
  // Also flag results that are already accounts under a similar name (no domain in Nokko, «S.L.», accents…).
  const res = done?.result?.search
    ? {
        ...done.result.search,
        rows: done.result.search.rows.map((r) =>
          r.domain && imported.has(r.domain)
            ? { ...r, existingId: imported.get(r.domain)! }
            : !r.existingId
              ? {
                  ...r,
                  existingId: (() => {
                    const d = duplicateOf({ name: r.name, domain: r.domain }, known);
                    return d?.kind === "same" ? d.item.id : r.existingId;
                  })(),
                }
              : r,
        ),
      }
    : null;
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!done || loaded.current === done.id) return;
    loaded.current = done.id;
    const q = done.result?.query;
    if (q) {
      setKeywords((q.keywords ?? []).join(", "));
      setCountries(q.countries ?? []);
      setMinEmp(q.minEmployees ? String(q.minEmployees) : "");
      setMaxEmp(q.maxEmployees ? String(q.maxEmployees) : "");
    }
  }, [done?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function useIcp(id: string) {
    const icp = icps.find((i) => i.id === id);
    if (!icp) return;
    const q = icpCompanyQuery(icp).query;
    setKeywords((q.keywords ?? []).join(", "));
    setCountries(q.countries ?? []);
    setMinEmp(q.minEmployees ? String(q.minEmployees) : "");
    setMaxEmp(q.maxEmployees ? String(q.maxEmployees) : "");
    toast.success(`Criterios cargados desde «${icp.name}». Revísalos antes de buscar.`);
  }

  function run(more: boolean) {
    if (more && (!res?.cursor || !job)) return;
    void start({
      cursor: more ? res!.cursor : null,
      query: {
        keywords: splitList(keywords),
        countries,
        minEmployees: Number(minEmp) || null,
        maxEmployees: Number(maxEmp) || null,
      },
      ...(more ? { prevJobId: job!.id } : {}),
    });
  }

  async function importPicked() {
    if (!res) return;
    const chosen = res.rows.filter((r) => r.domain && picked.has(r.domain) && !r.existingId);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .insert(chosen.map((r) => accountInsertFromDraft(r, target)))
        .select("id,domain");
      if (error) throw error;
      await supabase.from("account_plans").insert((data ?? []).map((a) => ({ account_id: a.id })));
      setImported(
        new Map([
          ...imported,
          ...(data ?? []).filter((a) => a.domain).map((a) => [a.domain!, a.id] as [string, string]),
        ]),
      );
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["accounts"] });
      invalidateSetup(qc);
      toast.success(`${data?.length ?? 0} cuentas añadidas.`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const rows = res?.rows ?? [];
  const selectable = rows.filter((r) => r.domain && !r.existingId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Describe a tu cliente ideal y Nokko busca empresas en la fuente más rápida y barata que
        tengas conectada; si no encuentra, prueba otra. Trabaja en segundo plano: puedes cerrar esta
        ventana y te aviso al terminar.
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
        <Field label="Palabras clave (sector o producto, mejor en inglés)">
          <Input
            value={keywords}
            placeholder="payments, logistics, B2B SaaS"
            onChange={(e) => setKeywords(e.target.value)}
          />
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
      {running ? (
        <JobProgress job={job} onCancel={cancel} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)}>{res ? "Buscar de nuevo" : "Buscar empresas"}</Button>
          {res && (
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setDismissed(done!.id)}
            >
              Limpiar resultados
            </button>
          )}
          <button type="button" className="text-sm underline" onClick={onDeep}>
            Buscar a fondo (25–100 empresas, tarda minutos)
          </button>
        </div>
      )}
      {!running && job?.status === "failed" && (
        <p className="text-sm text-muted-foreground">La última búsqueda falló: {job.error}</p>
      )}
      {res?.blocked && <p className="text-sm text-muted-foreground">{res.blocked}</p>}
      {res && !res.blocked && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay empresas con esos criterios. Prueba a quitar alguno o busca a fondo.
        </p>
      )}
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
                {rows.map((r, i) => (
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
                      <CompanyLogo domain={r.domain} size={16} className="mr-1.5" />
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
                    <td className="whitespace-nowrap px-2 py-2">{r.size}</td>
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
          <p className="font-mono text-xs text-muted-foreground">{res?.sources}</p>
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
            {res?.cursor && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || running}
                onClick={() => run(true)}
              >
                Traer más
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
