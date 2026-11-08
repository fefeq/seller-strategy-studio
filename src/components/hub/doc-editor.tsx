import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveToDriveButton } from "@/components/drive";
import type { Doc } from "@/components/hub/hub-screen";

export function Editor({
  doc,
  isOwner,
  saving,
  onSave,
  onDelete,
}: {
  doc: Doc;
  isOwner: boolean;
  saving: boolean;
  onSave: (d: Partial<Doc>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [mandatory, setMandatory] = useState(!!doc.mandatory);
  const isDraft = !doc.id;
  const isRules = doc.section === "rules";
  const empty = !title.trim() || !body.trim();
  const id = doc.id || undefined;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      {isDraft && <p className="eyebrow">Documento nuevo · sin guardar</p>}
      <Input
        value={title}
        placeholder="Título"
        onChange={(e) => setTitle(e.target.value)}
        className="font-display text-2xl"
      />
      <Textarea
        value={body}
        placeholder="Contenido"
        onChange={(e) => setBody(e.target.value)}
        rows={18}
        className="font-mono text-base md:text-sm"
      />
      {doc.scope === "team" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={isRules || mandatory}
            disabled={isRules}
            onChange={(e) => setMandatory(e.target.checked)}
          />
          <span>
            De obligado cumplimiento
            <span className="block text-xs text-muted-foreground">
              {isRules ? "Todo lo de Reglas lo es: el" : "El"} agente lo lee en cada conversación y
              al redactar seguimientos y preparaciones de reunión, y el Ciclo GTM en sus documentos.
            </span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={empty || saving}
          onClick={() => onSave({ id, title, body, scope: doc.scope, mandatory })}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {doc.section === "skills" && doc.scope === "personal" && isOwner && !isDraft && (
          <Button
            variant="outline"
            disabled={empty || saving}
            onClick={() => onSave({ id, title, body, scope: "team", mandatory })}
          >
            Promover a equipo
          </Button>
        )}
        {empty && (
          <span className="text-xs text-muted-foreground">
            Escribe un título y el contenido para poder guardar.
          </span>
        )}
        {!isDraft && (
          <SaveToDriveButton title={title || doc.title} markdown={`# ${title}\n\n${body}`} />
        )}
        {isOwner && !isDraft && (
          <Button variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
