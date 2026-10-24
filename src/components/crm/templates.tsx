// Email templates of the company (from the Postin CRM): used by «Registrar actividad» with {{nombre}}, {{empresa}}, {{deal}}, {{remitente}}.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";

type T = { id: string; name: string; subject: string; body: string };
const BLANK: T = { id: "", name: "", subject: "", body: "" };

export function EmailTemplates() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: list = [] } = useQuery({ queryKey: ["email-templates"], queryFn: async () => (await supabase.from("email_templates").select("id,name,subject,body").order("name")).data ?? [] });
  const [t, setT] = useState<T | null>(null);

  async function save() {
    if (!t?.name.trim()) return toast.error("Ponle un nombre a la plantilla.");
    const row = { name: t.name.trim(), subject: t.subject, body: t.body };
    const { error } = t.id ? await supabase.from("email_templates").update(row).eq("id", t.id) : await supabase.from("email_templates").insert(row);
    if (error) return toast.error(errorText(error));
    toast.success("Plantilla guardada."); setT(null); qc.invalidateQueries({ queryKey: ["email-templates"] });
  }
  async function remove(x: T) {
    if (!(await askConfirm(`Borrar «${x.name}»`, { confirmLabel: "Borrar" }))) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", x.id);
    if (error) return toast.error(errorText(error));
    setT(null); qc.invalidateQueries({ queryKey: ["email-templates"] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Correos que el equipo repite: primer contacto, seguimiento, propuesta. Variables: {"{{nombre}}"}, {"{{empresa}}"}, {"{{deal}}"}, {"{{remitente}}"}.</p>
        <Button size="sm" variant="outline" className="w-full" onClick={() => setT({ ...BLANK })}>+ Nueva plantilla</Button>
        <ul className="space-y-1">
          {list.map((x) => <li key={x.id}><button onClick={() => setT(x)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${t?.id === x.id ? "bg-paper-sunk" : "hover:bg-muted"}`}>{x.name}</button></li>)}
        </ul>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay plantillas.</p>}
      </div>
      {t ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Input aria-label="Nombre" placeholder="Nombre (p. ej. Seguimiento tras demo)" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          <Input aria-label="Asunto" placeholder="Asunto" value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} />
          <Textarea aria-label="Cuerpo" rows={10} placeholder={"Hola {{nombre}},\n\n…"} value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Guardar</Button>
            <Button variant="ghost" onClick={() => setT(null)}>Cancelar</Button>
            {t.id && me?.roles.includes("owner") && <Button variant="ghost" onClick={() => remove(t)}>Borrar</Button>}
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground">Elige una plantilla o crea una nueva.</p>}
    </div>
  );
}
