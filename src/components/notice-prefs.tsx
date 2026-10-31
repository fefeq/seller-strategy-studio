// Preferencias de avisos: what each person gets on Telegram when Nokko finishes something, and the night silence.
// In the app everything always shows in «Avisos»; these settings only filter what leaves it.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Pick } from "@/components/fields";
import { DEFAULT_PREFS, TELEGRAM_LEVEL_LABEL, type NoticePrefs, type TelegramLevel } from "@/lib/jobs";
import { errorText } from "@/lib/errors";
import { DEFAULT_DAILY, type DailyPrefs } from "@/lib/daily-email";
import { sendMyDailyEmail } from "@/lib/daily-email.functions";

type Prefs = NoticePrefs & Omit<DailyPrefs, "timezone">;
const DEFAULTS: Prefs = { ...DEFAULT_PREFS, daily_email: DEFAULT_DAILY.daily_email, daily_email_hour: DEFAULT_DAILY.daily_email_hour };

const HOURS = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [String(h), `${String(h).padStart(2, "0")}:00`]));

export function NoticePrefsCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const userId = me?.user.id;
  const sendNow = useServerFn(sendMyDailyEmail);
  const [sending, setSending] = useState(false);
  const { data: prefs = DEFAULTS } = useQuery({
    queryKey: ["notice-prefs", userId],
    enabled: !!userId,
    queryFn: async () => ((await supabase.from("notification_prefs").select("telegram,quiet_from,quiet_to,timezone,daily_email,daily_email_hour").eq("user_id", userId!).maybeSingle()).data as Prefs | null) ?? DEFAULTS,
  });
  async function save(patch: Partial<Prefs>) {
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
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Todo lo que Nokko hace en segundo plano aparece en «Avisos». Aquí eliges tu resumen diario por email, qué te llega además por Telegram (si lo tienes vinculado) y cuándo no molestar.</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <label className="space-y-1">
          <span className="eyebrow">Resumen diario por email</span>
          <Pick aria-label="Resumen diario por email" value={prefs.daily_email ? "on" : "off"} options={{ on: "Sí", off: "No" }} onChange={(v) => save({ daily_email: v === "on" })} />
        </label>
        <label className="space-y-1">
          <span className="eyebrow">a las</span>
          <Pick aria-label="Hora del resumen diario" value={String(prefs.daily_email_hour)} options={HOURS} onChange={(v) => save({ daily_email_hour: Number(v) })} />
        </label>
        <div className="flex items-end pb-2">
          <button type="button" className="text-left text-xs text-signal disabled:opacity-50" disabled={sending} onClick={async () => {
            setSending(true);
            try { const r = await sendNow(); toast.success(`Enviado a ${r.to}.`); } catch (e) { toast.error(errorText(e)); } finally { setSending(false); }
          }}>{sending ? "Enviando…" : "Envíamelo ahora"}</button>
        </div>
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
      <p className="mt-3 text-xs text-muted-foreground">El resumen diario llega desde avisos@nokko.ai con lo que Nokko hizo solo, lo que necesita tu decisión y lo que tienes hoy, a tu hora local. «Solo lo importante» = fallos, lo que necesita tu decisión, tareas grandes (Descubiertos, debates, informes, búsquedas) y los avisos de dinero. Lo que llegue durante el silencio te lo mando al terminar, si no tiene más de 12 horas. Misma hora de inicio y fin = sin silencio.</p>
    </div>
  );
}
