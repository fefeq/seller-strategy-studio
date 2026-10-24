// Preferencias de avisos: what each person gets on Telegram when Nokko finishes something, and the night silence.
// In the app everything always shows in «Avisos»; these settings only filter what leaves it.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Pick } from "@/components/fields";
import { DEFAULT_PREFS, TELEGRAM_LEVEL_LABEL, type NoticePrefs, type TelegramLevel } from "@/lib/jobs";
import { errorText } from "@/lib/errors";

const HOURS = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [String(h), `${String(h).padStart(2, "0")}:00`]));

export function NoticePrefsCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const userId = me?.user.id;
  const { data: prefs = DEFAULT_PREFS } = useQuery({
    queryKey: ["notice-prefs", userId],
    enabled: !!userId,
    queryFn: async () => ((await supabase.from("notification_prefs").select("telegram,quiet_from,quiet_to,timezone").eq("user_id", userId!).maybeSingle()).data as NoticePrefs | null) ?? DEFAULT_PREFS,
  });
  async function save(patch: Partial<NoticePrefs>) {
    const next = { ...prefs, ...patch };
    // The browser's own time zone, so the night silence follows where the person is.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || next.timezone;
    const { error } = await supabase.from("notification_prefs").upsert({ user_id: userId!, ...next, timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return toast.error(errorText(error));
    toast.success("Preferencias guardadas.");
    qc.invalidateQueries({ queryKey: ["notice-prefs", userId] });
  }
  return (
    <div id="avisos" className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h3 className="text-2xl">Avisos</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Todo lo que Nokko hace en segundo plano aparece en «Avisos». Aquí eliges qué te llega además por Telegram (si lo tienes vinculado) y cuándo no molestar.</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <label className="space-y-1 sm:col-span-3">
          <span className="eyebrow">Por Telegram</span>
          <Pick aria-label="Qué avisos llegan por Telegram" value={prefs.telegram} options={TELEGRAM_LEVEL_LABEL} onChange={(v) => save({ telegram: v as TelegramLevel })} />
        </label>
        <label className="space-y-1">
          <span className="eyebrow">Silencio desde</span>
          <Pick aria-label="Silencio desde" value={String(prefs.quiet_from)} options={HOURS} onChange={(v) => save({ quiet_from: Number(v) })} />
        </label>
        <label className="space-y-1">
          <span className="eyebrow">hasta</span>
          <Pick aria-label="Silencio hasta" value={String(prefs.quiet_to)} options={HOURS} onChange={(v) => save({ quiet_to: Number(v) })} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">«Solo lo importante» = fallos, lo que necesita tu decisión y tareas grandes (Descubiertos, debates, informes, búsquedas). Lo que llegue durante el silencio te lo mando al terminar, si no tiene más de 12 horas. Misma hora de inicio y fin = sin silencio.</p>
    </div>
  );
}
