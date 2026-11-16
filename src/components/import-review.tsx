import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/page";
import { approveImport, discardImport, undoImport } from "@/lib/imports.functions";
import { errorText } from "@/lib/errors";
import { askConfirm } from "@/components/confirm-dialog";
import type { Tables } from "@/integrations/supabase/types";

const BATCH: Record<string, string> = {
  pending: "Pendiente",
  partial: "En parte",
  approved: "Aprobado",
  discarded: "Descartado",
  undone: "Deshecho",
};
const ROW: Record<string, string> = {
  pending: "Pendiente",
  applied: "Entró",
  discarded: "Descartada",
  error: "Error",
  undone: "Deshecha",
};
const fmt = (d: string) =>
  new Date(d).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

/** Quarantine: batches sent by third parties wait here until someone approves them, and can be undone. */
export function ImportReview({ canManage, isOwner }: { canManage: boolean; isOwner: boolean }) {
  const { data: batches = [] } = useQuery({
    queryKey: ["import-batches"],
    queryFn: async () =>
      (
        await supabase
          .from("import_batches")
          .select("*, lead_sources(name)")
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
  });
  const pending = batches.filter((b) => b.status === "pending" || b.status === "partial");
  const done = batches.filter((b) => !(b.status === "pending" || b.status === "partial"));
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-3xl">Pendientes de revisar</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Lo que envían las conexiones en modo «Revisar» espera aquí. No entra nada en Cuentas, Leads
        ni Pipeline hasta que lo apruebes.
      </p>
      {pending.length === 0 ? (
        <Empty>No hay nada pendiente.</Empty>
      ) : (
        <div className="space-y-4">
          {pending.map((b) => (
            <Batch key={b.id} batch={b} canManage={canManage} isOwner={isOwner} open />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm">Historial de lotes ({done.length})</summary>
          <div className="mt-3 space-y-3">
            {done.map((b) => (
              <Batch key={b.id} batch={b} canManage={canManage} isOwner={isOwner} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Batch({
  batch: b,
  canManage,
  isOwner,
  open = false,
}: {
  batch: Tables<"import_batches"> & { lead_sources: { name: string } | null };
  canManage: boolean;
  isOwner: boolean;
  open?: boolean;
}) {
  const qc = useQueryClient();
  const [show, setShow] = useState(open);
  const [busy, setBusy] = useState(false);
  const approve = useServerFn(approveImport);
  const discard = useServerFn(discardImport);
  const undo = useServerFn(undoImport);
  const { data: rows = [] } = useQuery({
    queryKey: ["import-rows", b.id],
    enabled: show,
    queryFn: async () =>
      (
        await supabase
          .from("import_rows")
          .select("id,line,summary,action,reason,status,error")
          .eq("batch_id", b.id)
          .order("line")
          .limit(500)
      ).data ?? [],
  });
  async function act<T>(fn: () => Promise<T>, ok: (r: T) => string) {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok(r));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      qc.invalidateQueries();
    }
  }
  const open_ = b.status === "pending" || b.status === "partial";
  const fresh = rows.filter((r) => r.status === "pending" && r.action !== "skip").length;
  return (
    <div className="border-t border-hairline pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="font-medium">
            {b.lead_sources?.name ?? "Conexión"} · {b.kind === "accounts" ? "cuentas" : "leads"} ·{" "}
            {b.row_count} filas
          </p>
          <p className="text-xs text-muted-foreground">
            {fmt(b.created_at)} · {BATCH[b.status] ?? b.status}
            {b.created_count || b.updated_count
              ? ` · ${b.created_count} nuevas, ${b.updated_count} actualizadas`
              : ""}
            {b.error_count ? ` · ${b.error_count} con error` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShow(!show)}>
          {show ? "Ocultar filas" : "Ver filas"}
        </Button>
        {open_ && canManage && (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                act(
                  () => approve({ data: { batchId: b.id } }),
                  (r) =>
                    `${r.created} nuevas · ${r.updated} actualizadas${r.skipped ? ` · ${r.skipped} descartadas` : ""}${r.errors ? ` · ${r.errors} con error` : ""}.`,
                )
              }
            >
              Aprobar lote
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(
                  () => discard({ data: { batchId: b.id } }),
                  () => "Lote descartado.",
                )
              }
            >
              Descartar
            </Button>
          </>
        )}
        {isOwner && (b.status === "approved" || b.status === "partial") && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () =>
              (await askConfirm("¿Deshacer este lote?", {
                body: "Se borran las cuentas y leads que creó y que nadie ha tocado desde entonces. Lo que actualizó de registros existentes se queda.",
                confirmLabel: "Deshacer lote",
              })) &&
              act(
                () => undo({ data: { batchId: b.id } }),
                (r) =>
                  `${r.undone} filas deshechas${r.kept ? ` · ${r.kept} se quedan (ya existían o se han modificado)` : ""}.`,
              )
            }
          >
            Deshacer lote
          </Button>
        )}
      </div>
      {show && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left">
              <tr>
                {["Fila", "Registro", "Qué pasará", "Estado", ""].map((h) => (
                  <th key={h} className="eyebrow px-2 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline">
                  <td className="px-2 py-1.5 font-mono">{r.line}</td>
                  <td className="px-2 py-1.5">{r.summary}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.action === "skip"
                      ? `No entra: ${r.reason}`
                      : b.kind === "accounts"
                        ? "Cuenta nueva"
                        : "Se creará o actualizará"}
                  </td>
                  <td className="px-2 py-1.5">
                    {ROW[r.status] ?? r.status}
                    {r.error ? ` · ${r.error}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {open_ && canManage && r.status === "pending" && r.action !== "skip" && (
                      <span className="flex justify-end gap-2">
                        <button
                          className="underline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => approve({ data: { batchId: b.id, rowIds: [r.id] } }),
                              () => "Fila aprobada.",
                            )
                          }
                        >
                          Aprobar
                        </button>
                        <button
                          className="underline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => discard({ data: { batchId: b.id, rowIds: [r.id] } }),
                              () => "Fila descartada.",
                            )
                          }
                        >
                          Descartar
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {open_ && fresh === 0 && rows.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No queda ninguna fila válida pendiente.
            </p>
          )}
          {b.kind === "accounts" && b.status === "approved" && (
            <p className="mt-2 text-xs">
              <Link to="/accounts" className="underline">
                Ver cuentas
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
