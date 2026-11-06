import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { LISTENING_LEVELS, listeningStats, type ListeningLevel } from "@/lib/theory-u";

const LEVELS = [1, 2, 3, 4] as const;

export function LevelPicker({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (l: ListeningLevel | null) => void;
}) {
  const picked = value ? LISTENING_LEVELS[value as ListeningLevel] : null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            title={LISTENING_LEVELS[l].description}
            onClick={() => onChange(value === l ? null : l)}
            className={`min-h-10 rounded-md border px-2 py-1.5 text-left text-xs md:min-h-0 ${value === l ? "border-signal bg-signal/10" : "hover:border-foreground/30"}`}
          >
            <span className="font-mono text-xs text-muted-foreground">{l}</span>{" "}
            <span className="font-medium">{LISTENING_LEVELS[l].label}</span>
          </button>
        ))}
      </div>
      {/* The description lives in `title` on desktop; touch has no hover, so show it. */}
      {picked && (
        <p className="mt-1.5 text-xs text-muted-foreground md:hidden">{picked.description}</p>
      )}
    </div>
  );
}

export function Listening() {
  const { data } = useQuery({
    queryKey: ["listening"],
    queryFn: async () => {
      const [m, n] = await Promise.all([
        supabase
          .from("meetings")
          .select(
            "id,title,scheduled_at,listening_level,listening_coaching,account_id,accounts(name)",
          )
          .not("listening_level", "is", null)
          .order("scheduled_at", { ascending: false }),
        supabase.from("sensing_notes").select("listening_level").not("listening_level", "is", null),
      ]);
      return { meetings: m.data ?? [], notes: n.data ?? [] };
    },
  });
  const meetings = data?.meetings ?? [];
  const stats = listeningStats([
    ...meetings.map((m) => m.listening_level),
    ...(data?.notes ?? []).map((n) => n.listening_level),
  ]);
  const max = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Según Scharmer, la calidad de los resultados depende de la calidad de la atención. En
        ventas, pasar de la descarga a la escucha empática o generativa es lo que convierte un pitch
        en una conversación que el cliente recuerda. Valora tu nivel después de cada reunión en el
        planificador de reuniones de cada cuenta.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        {LEVELS.map((l) => (
          <div key={l} className="rounded-lg border bg-card p-4">
            <p className="font-mono text-xs text-muted-foreground">Nivel {l}</p>
            <p className="font-display text-2xl">{LISTENING_LEVELS[l].label}</p>
            <p className="text-xs font-medium">{LISTENING_LEVELS[l].short}</p>
            <p className="mt-2 text-xs text-muted-foreground">{LISTENING_LEVELS[l].description}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded bg-muted">
                <div
                  className="h-full rounded bg-signal"
                  style={{ width: `${(stats.distribution[l] / max) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs">{stats.distribution[l]}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-6 rounded-lg border bg-card p-5">
        <div>
          <p className="eyebrow">Conversaciones valoradas</p>
          <p className="font-display text-4xl">{stats.count}</p>
        </div>
        <div>
          <p className="eyebrow">Nivel medio</p>
          <p className="font-display text-4xl">{stats.count ? stats.average.toFixed(1) : "—"}</p>
        </div>
        <div>
          <p className="eyebrow">Escucha profunda (3–4)</p>
          <p className="font-display text-4xl">
            {stats.count ? `${Math.round(stats.deepShare * 100)}%` : "—"}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="eyebrow">Reuniones valoradas</p>
        {meetings.length === 0 && (
          <Empty>
            Aún no hay reuniones con nivel de escucha. Ábrelas desde Cuentas → Planificador de
            reuniones.
          </Empty>
        )}
        {meetings.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
          >
            <div className="min-w-0 break-words">
              <p className="font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">
                {m.account_id ? (
                  <Link
                    to="/accounts/$id"
                    params={{ id: m.account_id }}
                    className="hover:text-signal"
                  >
                    {m.accounts?.name}
                  </Link>
                ) : (
                  "—"
                )}
                {m.scheduled_at ? ` · ${new Date(m.scheduled_at).toLocaleDateString("es-ES")}` : ""}
                {m.listening_coaching ? " · con coaching IA" : ""}
              </p>
            </div>
            <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs uppercase">
              {m.listening_level} · {LISTENING_LEVELS[m.listening_level as ListeningLevel]?.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
