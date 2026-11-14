// NK-0174 SDD 1: Conexiones card for the company's mailbox. Everyone sees whether it is linked; only a superadmin links it (Q-4).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { LEGAL_GATE_TEXT } from "@/lib/reply-inbox/rules";
import { linkMailbox, unlinkMailbox } from "@/lib/reply-inbox/mailbox.functions";

export function MailboxCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const link = useServerFn(linkMailbox);
  const unlink = useServerFn(unlinkMailbox);
  const { data } = useQuery({
    queryKey: ["mailbox-link", orgId],
    queryFn: async () => {
      const [{ data: row }, { data: u }] = await Promise.all([
        supabase.from("mailbox_links").select("address,status,linked_at,last_synced_at,replies_count").eq("org_id", orgId).maybeSingle(),
        supabase.auth.getSession(),
      ]);
      const uid = u.session?.user.id;
      const { data: admin } = uid
        ? await supabase.rpc("is_platform_admin", { _user: uid })
        : { data: false };
      return { row, admin: !!admin };
    },
  });
  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
    qc.invalidateQueries({ queryKey: ["mailbox-link", orgId] });
  }
  const row = data?.row;
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="eyebrow">Bandeja de respuestas · Gmail</p>
      <p className="mt-2 text-sm">
        {row
          ? `Conectado: ${row.address}. Cada hora NOKKO mira si tus leads en Contactado te han respondido y, si es así, detiene su secuencia de seguimiento. Solo lee remitente y fecha; nunca envía desde él.`
          : "Sin buzón conectado. Al conectarlo, NOKKO detecta las respuestas de tus leads y detiene su secuencia de seguimiento."}
      </p>
      {row && (
        <p className="mt-1 text-xs text-ink-mid">
          {row.last_synced_at
            ? `Última revisión: ${new Date(row.last_synced_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} · ${row.replies_count} respuestas detectadas`
            : "Aún no se ha revisado: la primera revisión llega en la próxima hora."}
        </p>
      )}
      {data && !data.admin && <p className="mt-2 text-xs text-ink-mid">{LEGAL_GATE_TEXT}</p>}
      {data?.admin && (
        <div className="mt-3">
          {row ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (await askConfirm("¿Desconectar el buzón?", { body: "NOKKO dejará de leer las respuestas y borrará lo leído. Los leads marcados como «respondió» siguen sin secuencia.", confirmLabel: "Desconectar" }))
                  run(() => unlink({ data: { orgId } }), "Buzón desconectado");
              }}
            >
              Desconectar
            </Button>
          ) : (
            <Button onClick={() => run(() => link({ data: { orgId } }), "Buzón conectado")}>Conectar mi Gmail</Button>
          )}
        </div>
      )}
    </section>
  );
}
