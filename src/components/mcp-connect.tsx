import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MCP_URL = "https://nokko.ai/mcp";
const STEPS: [string, string][] = [
  ["Claude", "Ajustes → Conectores → Añadir conector personalizado → pega la dirección."],
  ["ChatGPT", "Ajustes → Conectores (modo desarrollador) → Crear → pega la dirección y elige OAuth."],
  ["Codex / Claude Code", "Añade un servidor MCP remoto con esta dirección (p. ej. «claude mcp add --transport http nokko " + MCP_URL + "»)."],
];

export function McpConnect() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="eyebrow mb-1">Conectar con asistentes de IA</p>
      <p className="text-sm text-muted-foreground">Usa Nokko desde Claude, ChatGPT, Codex o Cursor. Al conectar, inicias sesión y apruebas el acceso; el asistente actúa como tú, con tu rol, y lo que cambie datos queda pendiente de tu confirmación en Sugerencias.</p>
      <div className="mt-3 flex gap-2">
        <Input readOnly value={MCP_URL} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button size="icon" variant="outline" aria-label="Copiar dirección" onClick={() => { navigator.clipboard.writeText(MCP_URL); toast.success("Dirección copiada"); }}><Copy className="size-4" /></Button>
      </div>
      <button className="mt-2 text-xs underline" onClick={() => setOpen(!open)}>{open ? "Ocultar pasos" : "Ver pasos para cada asistente"}</button>
      {open && <ul className="mt-2 space-y-1 text-sm">{STEPS.map(([n, s]) => <li key={n}><strong>{n}:</strong> {s}</li>)}</ul>}
    </div>
  );
}
