import { Trash2 } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveToDriveButton } from "@/components/drive";
import type { Doc } from "@/components/hub/hub-screen";
import {
  BINDING_MARK_ONLY_LEADERS,
  canEditDoc,
  canWriteBinding,
  isVoiceDoc,
} from "@/lib/knowledge-rules";

export function Editor({
  doc,
  roles,
  isOwner,
  saving,
  onSave,
  onDelete,
}: {
  doc: Doc;
  /** Roles in the current company; undefined while they load (binding documents stay read-only until then). */
  roles: string[] | undefined;
  isOwner: boolean;
  saving: boolean;
  onSave: (d: Partial<Doc>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  // A voice document is never mandatory (NK-0128): no box, and it saves unmarked even if it came marked.
  const isVoice = isVoiceDoc(doc);
  const [marked, setMandatory] = useState(!!doc.mandatory);
  const mandatory = !isVoice && marked;
  const isDraft = !doc.id;
  const isRules = doc.section === "rules";
  const empty = !title.trim() || !body.trim();
  const id = doc.id || undefined;
  // Reglas and mandatory team documents are what the whole team's agent obeys: only Owner or Sales Leader write them (NK-0095).
  const edit = canEditDoc(doc, roles);
  const readOnly = !edit.allowed;
  const canMark = canWriteBinding(roles);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      {isDraft && <p className="eyebrow">Documento nuevo · sin guardar</p>}
      {readOnly && roles && <p className="text-sm text-muted-foreground">{edit.reason}</p>}
      <Input
        value={title}
        placeholder="Título"
        readOnly={readOnly}
        onChange={(e) => setTitle(e.target.value)}
        className="font-display text-2xl"
      />
      <Textarea
        value={body}
        placeholder="Contenido"
        readOnly={readOnly}
        onChange={(e) => setBody(e.target.value)}
        rows={18}
        className="font-mono text-base md:text-sm"
      />
      {doc.scope === "team" && !isVoice && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={isRules || mandatory}
            disabled={isRules || readOnly || !canMark}
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
      {doc.scope === "team" && !isVoice && !isRules && !readOnly && !canMark && roles && (
        <p className="text-xs text-muted-foreground">{BINDING_MARK_ONLY_LEADERS}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={empty || saving || readOnly}
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
        {empty && !readOnly && (
          <span className="text-xs text-muted-foreground">
            Escribe un título y el contenido para poder guardar.
          </span>
        )}
        {!isDraft && (
          <SaveToDriveButton title={title || doc.title} markdown={`# ${title}\n\n${body}`} />
        )}
        {isOwner && !isDraft && (
          <Button variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            <IconText icon={Trash2}>Eliminar</IconText>
          </Button>
        )}
      </div>
    </div>
  );
}
