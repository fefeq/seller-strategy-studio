import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createTelegramLinkCode, telegramBotInfo } from "@/lib/agent.functions";

export function TelegramLink() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const info = useServerFn(telegramBotInfo);
  const mkCode = useServerFn(createTelegramLinkCode);
  const [code, setCode] = useState<string | null>(null);
  const { data: bot } = useQuery({ queryKey: ["tg-bot"], queryFn: () => info(), staleTime: 300_000 });
  const { data: link } = useQuery({
    queryKey: ["tg-link", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("channel_links").select("chat_id,linked_at,daily_digest").eq("user_id", me!.user.id).eq("channel", "telegram").maybeSingle()).data,
    refetchInterval: code ? 4000 : false,
  });
  const linked = !!link?.chat_id;

  async function generate() {
    try { setCode((await mkCode()).code); } catch (e) { toast.error((e as Error).message); }
  }
  async function unlink() {
    await supabase.from("channel_links").delete().eq("user_id", me!.user.id).eq("channel", "telegram");
    setCode(null); qc.invalidateQueries({ queryKey: ["tg-link"] });
  }
  async function toggleDigest(v: boolean) {
    await supabase.from("channel_links").update({ daily_digest: v }).eq("user_id", me!.user.id).eq("channel", "telegram");
    qc.invalidateQueries({ queryKey: ["tg-link"] });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="flex items-center gap-2 text-2xl"><Send className="size-5" /> Telegram</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Habla con el agente desde Telegram, recibe cada mañana tus 3 prioridades y aprueba las sugerencias urgentes con un botón. Usa tus permisos y tu empresa activa.</p>
      {!bot?.connected ? (
        <p className="mt-3 text-sm">El bot de Telegram todavía no está conectado a GTM Brain.</p>
      ) : linked ? (
        <div className="mt-4 space-y-3 text-sm">
          <p>Vinculado{bot.username ? <> con <strong>@{bot.username}</strong></> : null} desde el {new Date(link!.linked_at!).toLocaleDateString("es-ES")}.</p>
          <label className="flex items-center gap-2"><Switch checked={link!.daily_digest} onCheckedChange={toggleDigest} /> Resumen diario por la mañana</label>
          <Button variant="outline" size="sm" onClick={unlink}>Desvincular</Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          {!code ? <Button onClick={generate}>Conectar Telegram</Button> : (
            <>
              <p>Tu código (caduca en 15 minutos): <span className="rounded bg-muted px-2 py-1 font-mono text-base tracking-widest">{code}</span></p>
              {bot.username
                ? <Button asChild><a href={`https://t.me/${bot.username}?start=${code}`} target="_blank" rel="noreferrer">Abrir @{bot.username} y vincular</a></Button>
                : <p>Envía al bot: <span className="font-mono">/vincular {code}</span></p>}
              <p className="text-xs text-muted-foreground">Esta página se actualizará sola al vincularse.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
