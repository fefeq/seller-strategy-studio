import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "Conectar asistentes de IA — Nokko" },
      {
        name: "description",
        content:
          "Cómo conectar Claude, ChatGPT, Claude Code u otro asistente a Nokko y mantenerlo al día.",
      },
      { property: "og:title", content: "Conectar asistentes de IA — Nokko" },
      {
        property: "og:description",
        content:
          "Cómo conectar Claude, ChatGPT, Claude Code u otro asistente a Nokko y mantenerlo al día.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectPage,
});

const APP_NAME = "Nokko";
const SLUG = "nokko";

/** Single-quoted for the shell: a quote inside the URL can never end the argument. */
const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copiado.`),
    () => toast.error("No se ha podido copiar. Selecciónalo y cópialo a mano."),
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">{children}</ol>;
}

function CopyLine({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className="font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <Button variant="outline" onClick={() => copy(value, label)}>
        Copiar
      </Button>
    </div>
  );
}

function ConnectPage() {
  // The address follows the domain the app is open on, so it is always the live one.
  const [mcpUrl, setMcpUrl] = useState("");
  useEffect(() => setMcpUrl(new URL("/mcp", window.location.origin).toString()), []);
  const url = mcpUrl || "…";
  const claudeLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(APP_NAME)}&connectorUrl=${encodeURIComponent(mcpUrl)}`;
  const command = `claude mcp add --scope user --transport http ${SLUG} ${shellQuote(mcpUrl)}`;
  const ext = { target: "_blank", rel: "noreferrer", className: "text-signal" } as const;

  return (
    <Page eyebrow="Asistentes de IA" title="Conecta tu asistente a Nokko">
      <section className="max-w-3xl space-y-3">
        <p className="text-sm text-muted-foreground">
          Tu asistente podrá consultar cuentas, deals, leads, métricas y estrategia, y buscar en
          Clay. Actúa como tú, en tu empresa activa y con tu rol. Lo que cambie datos queda
          pendiente hasta que lo confirmes en Sugerencias.
        </p>
        <p className="eyebrow">Dirección del servidor</p>
        <CopyLine value={url} label="Dirección" />
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-3xl">Conectar</h2>
        <Tabs defaultValue="chatgpt" className="mt-4">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
            <TabsTrigger value="claude">Claude</TabsTrigger>
            <TabsTrigger value="code">Claude Code</TabsTrigger>
            <TabsTrigger value="other">Otros asistentes</TabsTrigger>
          </TabsList>
          <TabsContent value="chatgpt">
            <Steps>
              <li>
                Abre{" "}
                <a href="https://chatgpt.com/#settings/Connectors/Advanced" {...ext}>
                  Ajustes → Aplicaciones → Avanzado
                </a>{" "}
                y activa el modo desarrollador (lee el aviso que aparece). Si no puedes activarlo,
                pídeselo a quien administre ChatGPT en tu empresa.
              </li>
              <li>
                Abre{" "}
                <a
                  href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
                  {...ext}
                >
                  el formulario de nueva aplicación
                </a>
                .
              </li>
              <li>Escribe «{APP_NAME}» como nombre y pega la dirección de arriba.</li>
              <li>
                Revisa los datos, marca «Entiendo y quiero continuar» (ChatGPT lo pide con cualquier
                servidor propio) y pulsa Crear.
              </li>
              <li>Se abrirá Nokko: inicia sesión si hace falta y pulsa Aprobar.</li>
              <li>
                En un chat nuevo, activa {APP_NAME} desde el botón + y pídele, por ejemplo, «¿Qué
                leads tengo retrasados?».
              </li>
            </Steps>
          </TabsContent>
          <TabsContent value="claude">
            <Steps>
              <li>
                Abre{" "}
                <a href={claudeLink} {...ext}>
                  el formulario de conector de Claude
                </a>
                : ya lleva el nombre y la dirección.
              </li>
              <li>
                Revisa los datos y pulsa Añadir. Se abrirá Nokko: inicia sesión si hace falta y
                pulsa Aprobar.
              </li>
              <li>
                Si el formulario no se abre relleno, ve a Ajustes → Conectores → Añadir conector
                personalizado, escribe «{APP_NAME}» y pega la dirección.
              </li>
              <li>
                Activa el conector desde el botón de herramientas del chat y pídele a Claude que use{" "}
                {APP_NAME}.
              </li>
            </Steps>
          </TabsContent>
          <TabsContent value="code">
            <Steps>
              <li>
                Copia este comando y ejecútalo en un terminal. Es toda la instalación y funciona
                desde cualquier carpeta.
                <div className="mt-2">
                  <CopyLine value={mcpUrl ? command : "…"} label="Comando" />
                </div>
              </li>
              <li>
                Abre Claude Code y escribe <code className="font-mono">/mcp</code>. Elige {SLUG},
                inicia sesión y pulsa Aprobar en Nokko.
              </li>
              <li>Pídele a Claude Code que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
          <TabsContent value="other">
            <Steps>
              <li>
                Abre los ajustes de servidores MCP o conectores personalizados de tu asistente
                (Cursor, Codex, etc.).
              </li>
              <li>Crea una conexión a un servidor MCP remoto.</li>
              <li>Ponle de nombre «{APP_NAME}» y pega la dirección de arriba.</li>
              <li>Completa el inicio de sesión y pulsa Aprobar en Nokko.</li>
              <li>Activa la conexión y pide al asistente que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
        </Tabs>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-3xl">Actualizar cuando Nokko cambie</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los asistentes guardan la lista de herramientas. Cuando Nokko estrene funciones, actualiza
          la conexión para verlas.
        </p>
        <Tabs defaultValue="chatgpt" className="mt-4">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
            <TabsTrigger value="claude">Claude</TabsTrigger>
            <TabsTrigger value="code">Claude Code</TabsTrigger>
            <TabsTrigger value="other">Otros asistentes</TabsTrigger>
          </TabsList>
          <TabsContent value="chatgpt">
            <Steps>
              <li>Abre la página de aplicaciones de ChatGPT y elige {APP_NAME}.</li>
              <li>Baja hasta «Información» y pulsa Actualizar.</li>
              <li>
                ChatGPT no deja cambiar la dirección de una aplicación. Si la dirección ha cambiado,
                borra la aplicación y vuelve a conectarla con la dirección de arriba.
              </li>
              <li>Empieza un chat nuevo y pídele que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
          <TabsContent value="claude">
            <Steps>
              <li>Abre Ajustes → Conectores y elige {APP_NAME}.</li>
              <li>Actualiza las herramientas del conector.</li>
              <li>
                Claude no deja cambiar la dirección de un conector. Si ha cambiado, quítalo y vuelve
                a añadirlo con la dirección de arriba.
              </li>
              <li>Pídele a Claude que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
          <TabsContent value="code">
            <Steps>
              <li>Abre una sesión nueva de Claude Code: carga las herramientas al conectarse.</li>
              <li>
                Si la dirección ha cambiado, ejecuta{" "}
                <code className="font-mono">claude mcp remove {SLUG}</code> y vuelve a ejecutar el
                comando de instalación.
              </li>
              <li>Pídele a Claude Code que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
          <TabsContent value="other">
            <Steps>
              <li>Abre los ajustes de servidores MCP o conectores de tu asistente.</li>
              <li>Elige la conexión de {APP_NAME}.</li>
              <li>
                Actualiza la lista de herramientas, recarga el servidor o vuelve a conectarlo.
              </li>
              <li>Si la dirección ha cambiado, pega la de arriba.</li>
              <li>Empieza un chat o sesión nueva y pide al asistente que use {APP_NAME}.</li>
            </Steps>
          </TabsContent>
        </Tabs>
      </section>
    </Page>
  );
}
