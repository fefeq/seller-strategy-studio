import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Short card on Equipo; the full steps per assistant live on /connect. */
export function McpConnect() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(new URL("/mcp", window.location.origin).toString()), []);
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="eyebrow mb-1">Conectar con asistentes de IA</p>
      <p className="text-sm text-muted-foreground">
        Usa Nokko desde Claude, ChatGPT, Claude Code o Cursor. Al conectar, inicias sesión y
        apruebas el acceso; el asistente actúa como tú, con tu rol, y lo que cambie datos queda
        pendiente de tu confirmación en Sugerencias.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Dirección"
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button
          variant="outline"
          disabled={!url}
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Dirección copiada.");
          }}
        >
          Copiar
        </Button>
      </div>
      <Link to="/connect" className="mt-2 inline-block text-xs underline">
        Ver los pasos para cada asistente
      </Link>
    </div>
  );
}
