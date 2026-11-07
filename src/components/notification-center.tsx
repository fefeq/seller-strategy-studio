// Centro de avisos: what Nokko is doing in the background («En marcha») and what it finished («Avisos»).
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelBackgroundJob, retryBackgroundJob } from "@/lib/background.functions";
import { errorText } from "@/lib/errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { unreadCount } from "@/lib/jobs";

type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  job_id: string | null;
};
type Running = {
  id: string;
  label: string;
  step: string | null;
  status: string;
  created_at: string;
  cancel_requested: boolean;
};

const KIND: Record<string, string> = {
  done: "Hecho",
  failed: "Falló",
  needs_decision: "Decide tú",
  autopilot: "Lo hice solo",
  money: "Dinero",
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function NotificationCenter({
  userId,
  className = "",
}: {
  userId: string | undefined;
  className?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notices = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () =>
      ((
        await supabase
          .from("notifications")
          .select("id,kind,title,body,link,read_at,created_at,job_id")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(40)
      ).data ?? []) as Notice[],
  });
  const { data: running = [] } = useQuery({
    queryKey: ["jobs-running", userId],
    enabled: !!userId,
    queryFn: async () =>
      ((
        await supabase
          .from("background_jobs")
          .select("id,label,step,status,created_at,cancel_requested")
          .eq("user_id", userId!)
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? []) as Running[],
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notices-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "background_jobs", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["jobs-running", userId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const cancelFn = useServerFn(cancelBackgroundJob);
  const retryFn = useServerFn(retryBackgroundJob);
  async function cancel(id: string) {
    try {
      const r = await cancelFn({ data: { jobId: id } });
      toast.message(
        r.status === "cancelled"
          ? "Cancelado."
          : "Cancelando: paro en el siguiente paso. Lo que ya hizo se queda.",
      );
    } catch (e) {
      toast.error(errorText(e));
    }
    qc.invalidateQueries({ queryKey: ["jobs-running", userId] });
  }
  async function retry(n: Notice) {
    if (!n.job_id) return;
    try {
      await retryFn({ data: { jobId: n.job_id } });
      toast.success("Lo intento otra vez. Te aviso al terminar.");
      void markRead([n.id]);
    } catch (e) {
      toast.error(errorText(e));
    }
    qc.invalidateQueries({ queryKey: ["jobs-running", userId] });
  }
  const unread = unreadCount(notices);
  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }
  function open(n: Notice) {
    void markRead(n.read_at ? [] : [n.id]);
    if (n.link) navigate({ to: n.link as "/" });
  }

  const label = running.length
    ? `Avisos · ${running.length} en marcha`
    : unread
      ? `Avisos · ${unread}`
      : "Avisos";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`text-sm ${unread ? "font-medium text-ink" : "text-ink-mid"} underline decoration-hairline-firm underline-offset-4 hover:decoration-ink ${className}`}
          aria-label={`Avisos, ${unread} sin leer`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Tabs defaultValue={running.length ? "running" : "notices"}>
          <div className="flex items-center justify-between border-b border-hairline px-3 pt-2">
            <TabsList>
              <TabsTrigger value="running">
                En marcha{running.length ? ` · ${running.length}` : ""}
              </TabsTrigger>
              <TabsTrigger value="notices">Avisos{unread ? ` · ${unread}` : ""}</TabsTrigger>
            </TabsList>
            {unread > 0 && (
              <button
                className="text-xs underline underline-offset-4"
                onClick={() => markRead(notices.filter((n) => !n.read_at).map((n) => n.id))}
              >
                Leer todo
              </button>
            )}
          </div>
          <TabsContent value="running" className="m-0 max-h-[60vh] overflow-y-auto">
            {running.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nada en marcha ahora mismo.</p>
            ) : (
              running.map((j) => (
                <div key={j.id} className="border-b border-hairline px-4 py-3 last:border-0">
                  <p className="text-sm font-medium">{j.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Trabajando · {j.step ?? (j.status === "queued" ? "en cola" : "en curso")} ·
                    desde {when(j.created_at)}
                  </p>
                  {!j.cancel_requested && (
                    <button
                      type="button"
                      className="mt-1 text-xs underline underline-offset-4"
                      onClick={() => cancel(j.id)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ))
            )}
          </TabsContent>
          <TabsContent value="notices" className="m-0 max-h-[60vh] overflow-y-auto">
            {notices.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Cuando Nokko termine algo, lo verás aquí.
              </p>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-hairline last:border-0 ${n.read_at ? "opacity-70" : ""}`}
                >
                  <button
                    onClick={() => open(n)}
                    className="block w-full px-4 pt-3 pb-2 text-left hover:bg-muted"
                  >
                    <p className="eyebrow">
                      {KIND[n.kind] ?? n.kind}
                      {!n.read_at && " · nuevo"} · {when(n.created_at)}
                    </p>
                    <p className="mt-1 text-sm">{n.title}</p>
                    {n.body && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{n.body}</p>
                    )}
                  </button>
                  {n.kind === "failed" && n.job_id && (
                    <button
                      type="button"
                      className="mx-4 mb-3 text-xs underline underline-offset-4"
                      onClick={() => retry(n)}
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              ))
            )}
            <p className="border-t border-hairline px-4 py-2 text-xs text-muted-foreground">
              Qué te llega por Telegram:{" "}
              <Link to="/team" hash="avisos" className="underline underline-offset-4">
                Preferencias de avisos
              </Link>
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
