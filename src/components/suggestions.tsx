import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, Check, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { decideSuggestion, refreshSuggestions } from "@/lib/agent.functions";
import { digest } from "@/lib/proactive";
import { errorText } from "@/lib/errors";

const PRIO: Record<number, string> = { 1: "Urgente", 2: "Importante", 3: "Cuando puedas" };

export function useSuggestions() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const refresh = useServerFn(refreshSuggestions);
  const qc = useQueryClient();
  // Re-run the (database-only) detectors once per org when the app opens.
  useEffect(() => {
    if (!orgId) return;
    const k = `gtm-detect-${orgId}`;
    const last = Number(sessionStorage.getItem(k) ?? 0);
    if (Date.now() - last < 5 * 60_000) return;
    sessionStorage.setItem(k, String(Date.now()));
    refresh().then(() => qc.invalidateQueries({ queryKey: ["suggestions"] })).catch(() => {});
  }, [orgId, refresh, qc]);
  return useQuery({
    queryKey: ["suggestions", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("suggestions").select("id,title,body,priority,link,action,created_at,detector").eq("org_id", orgId!).eq("status", "pending").or(`user_id.is.null,user_id.eq.${me!.user.id}`).order("priority").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
}

type S = NonNullable<ReturnType<typeof useSuggestions>["data"]>[number];

export function SuggestionCard({ s }: { s: S }) {
  const decide = useServerFn(decideSuggestion);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(decision: "approve" | "snooze" | "dismiss") {
    setBusy(decision);
    try {
      const r = await decide({ data: { id: s.id, decision } });
      toast.success(r.message);
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  }
  const hasAction = !!(s.action as any)?.tool;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-mono text-[10px] uppercase ${s.priority === 1 ? "text-signal" : "text-muted-foreground"}`}>{PRIO[s.priority]}</p>
          <p className="mt-0.5 break-words font-medium">{s.title}</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{s.body}</p>
        </div>
        {s.link && <Link to={s.link as any} className="-m-2 shrink-0 p-2 text-muted-foreground hover:text-foreground md:m-0 md:p-0" aria-label="Abrir"><ArrowUpRight className="size-4" /></Link>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasAction || !s.link
          ? <Button size="sm" disabled={!!busy} onClick={() => act("approve")}><Check className="size-3.5" /> {hasAction ? "Aprobar y hacer" : "Hecho"}</Button>
          : <Button size="sm" asChild><Link to={s.link as any}><ArrowUpRight className="size-3.5" /> Resolver</Link></Button>}
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("snooze")}><Clock className="size-3.5" /> En 3 días</Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("dismiss")}><X className="size-3.5" /> Descartar</Button>
      </div>
    </div>
  );
}

export function TodayDigest() {
  const { data = [] } = useSuggestions();
  const top = digest(data, 3);
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl">3 cosas para hoy</h3>
        <Link to="/inbox" className="-my-2 py-2 text-xs text-muted-foreground hover:text-foreground md:my-0 md:py-0">{data.length === 1 ? "Ver 1 sugerencia" : `Ver las ${data.length} sugerencias`}</Link>
      </div>
      {top.length === 0 ? <p className="text-sm text-muted-foreground">Todo en orden. Te avisaré cuando detecte algo.</p> : <div className="space-y-3">{top.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>}
    </div>
  );
}
