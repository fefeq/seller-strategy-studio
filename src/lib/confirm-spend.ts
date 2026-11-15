// Screen confirmation before spending (A2 of PLAN-UX-20261115): same estimate as the agent's card, read from the
// active company's measured ledger under RLS; «sin dato» when there is no history. Nothing runs unless confirmed.
import { supabase } from "@/integrations/supabase/client";
import { askConfirm } from "@/components/confirm-dialog";
import { estimateText } from "@/lib/agent/spend-confirm";
import type { SpendRow } from "@/lib/spend";

export async function confirmSpend(tool: string, what: string, provider: string): Promise<boolean> {
  let line = estimateText([], tool);
  try {
    const { data } = await supabase
      .from("integration_usage")
      .select("cost,currency,cost_kind,tool,created_at")
      .eq("tool", tool)
      .eq("cost_kind", "measured")
      .order("created_at", { ascending: false })
      .limit(200);
    line = estimateText((data ?? []) as SpendRow[], tool);
  } catch {
    /* keep «sin dato» */
  }
  return askConfirm(`${what}?`, {
    body: `Gasta saldo de ${provider} y cuenta en el presupuesto de la empresa. ${line[0]!.toUpperCase()}${line.slice(1)}.`,
    confirmLabel: "Gastar y continuar",
  });
}
