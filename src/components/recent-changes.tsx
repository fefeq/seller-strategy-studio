import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { canUndoChange, changeText, undoStatus } from "@/lib/delete-rules";
import { errorText } from "@/lib/errors";
import { recentChanges, undoChange } from "@/lib/field-undo";

/** CA-5: edits and deletes of the last 24 hours, each with «Deshacer» while it is still possible. */
export function RecentChanges() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["recent-changes", me?.currentOrg?.org_id],
    queryFn: () => recentChanges(),
    enabled: !!me,
  });
  if (isError || !data?.length) return null;
  const now = new Date();
  const roles = me?.roles ?? [];
  async function undo(id: string) {
    setBusy(id);
    try {
      await undoChange(id);
      toast.success("Cambio deshecho.");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="mt-10 border-t-2 border-hairline-firm pt-4">
      <h2 className="font-display text-2xl">Cambios de las últimas 24 horas</h2>
      <ul className="mt-3 divide-y divide-hairline">
        {data.map((e) => {
          const can = canUndoChange(e, roles, now);
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{changeText(e)}</p>
                <p className="text-sm text-ink-mid">{undoStatus(e, now).text}</p>
              </div>
              <div className="flex items-center gap-2">
                {!can.allowed && can.reason && (
                  <span className="text-xs text-ink-mid">{can.reason}</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!can.allowed || busy === e.id}
                  onClick={() => undo(e.id)}
                >
                  {busy === e.id ? "Deshaciendo…" : "Deshacer"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
