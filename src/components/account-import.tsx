import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCsv } from "@/lib/dedupe";
import { errorText } from "@/lib/errors";
import {
  ACCOUNT_FIELD_LABELS,
  accountColumnMapping,
  planAccountImport,
  type AccountField,
} from "@/lib/account-import";

const OPTS: Record<string, string> = { "": "No importar", ...ACCOUNT_FIELD_LABELS };

/** Target accounts from a CSV: shows which field each column fills, then imports and reports every skipped row. */
export function AccountImport({ onDone }: { onDone?: (created: number) => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, AccountField | null>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: { line: number; name: string; reason: string }[];
  } | null>(null);

  async function onFile(f: File) {
    const parsed = parseCsv(await f.text());
    if (!parsed.length) return toast.error("El archivo no tiene filas.");
    setRows(parsed);
    setMapping(accountColumnMapping(Object.keys(parsed[0] ?? {})));
    setResult(null);
  }

  async function run() {
    if (!rows) return;
    if (!Object.values(mapping).some((f) => f === "name" || f === "domain"))
      return toast.error("Asigna al menos la columna con el nombre o el dominio de la cuenta.");
    setBusy(true);
    try {
      const [acc, seg] = await Promise.all([
        supabase.from("accounts").select("name,domain"),
        supabase.from("segments").select("id,name"),
      ]);
      if (acc.error) throw acc.error;
      const plan = planAccountImport(rows, mapping, seg.data ?? [], acc.data ?? []);
      let created = 0;
      for (let i = 0; i < plan.rows.length; i += 200) {
        const { data, error } = await supabase
          .from("accounts")
          .insert(plan.rows.slice(i, i + 200))
          .select("id");
        if (error) throw error;
        created += data?.length ?? 0;
        // Same as «+ Nueva cuenta»: every account starts with an empty plan.
        if (data?.length)
          await supabase.from("account_plans").insert(data.map((a) => ({ account_id: a.id })));
      }
      setResult({ created, skipped: plan.skipped });
      toast.success(
        `${created} ${created === 1 ? "cuenta creada" : "cuentas creadas"}${plan.skipped.length ? ` · ${plan.skipped.length} sin importar` : ""}.`,
      );
      setRows(null);
      qc.invalidateQueries();
      onDone?.(created);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const cols = rows ? Object.keys(rows[0] ?? {}) : [];
  return (
    <div className="space-y-3 text-sm">
      <Input
        type="file"
        accept=".csv,text/csv"
        aria-label="Archivo CSV de cuentas"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <p className="text-xs text-muted-foreground">
        Un CSV con una cuenta por fila (exportado de Excel, Sales Navigator o tu CRM). Columnas
        útiles: nombre, web, sector, tamaño, tier y segmento. Las que ya existen, por nombre o
        dominio, no se duplican.
      </p>
      {rows && (
        <div className="rounded-md bg-muted/50 p-3">
          <p>
            <strong>{rows.length}</strong> filas · revisa qué campo rellena cada columna:
          </p>
          <div className="mt-2 divide-y divide-hairline border-y border-hairline">
            {cols.map((c) => (
              <div
                key={c}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 py-1.5"
              >
                <span className="truncate font-mono text-xs" title={c}>
                  {c} <span className="text-muted-foreground">· {rows[0]?.[c] || "vacía"}</span>
                </span>
                <Pick
                  value={mapping[c] ?? ""}
                  options={OPTS}
                  onChange={(v) =>
                    setMapping({ ...mapping, [c]: (v || null) as AccountField | null })
                  }
                />
              </div>
            ))}
          </div>
          <Button className="mt-3 w-full" disabled={busy} onClick={run}>
            {busy ? "Importando…" : `Importar ${rows.length} cuentas`}
          </Button>
        </div>
      )}
      {result && result.skipped.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>{result.skipped.length} filas sin importar</summary>
          <ul className="mt-1 space-y-0.5">
            {result.skipped.slice(0, 50).map((s) => (
              <li key={s.line}>
                Fila {s.line} · {s.name}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
