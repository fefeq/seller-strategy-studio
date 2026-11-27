// Contenido de la página de presentación. El formulario de contacto y el botón de entrar se reciben desde fuera
// para no cambiar la entrada de contactos ni las reglas de ingreso.
import type { ReactNode } from "react";
import { BAJADA, EJEMPLO, PROMESAS, TITULAR } from "@/lib/landing-copy";

type Props = {
  /** Dirección de la pantalla de ingreso actual. */
  entrarHref: string;
  /** Formulario de contacto existente. */
  formulario?: ReactNode;
};

export function LandingContent({ entrarHref, formulario }: Props) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">{TITULAR}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{BAJADA}</p>
        <div>
          <a
            href={entrarHref}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Entrar
          </a>
        </div>
      </header>

      <section aria-labelledby="lo-que-hace" className="flex flex-col gap-6">
        <h2 id="lo-que-hace" className="text-2xl font-semibold">
          Lo que tu equipo usa hoy en Nokko
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PROMESAS.map((p) => (
            <li key={p.titulo} className="rounded-lg border p-5">
              <h3 className="font-medium">{p.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ejemplo" className="flex flex-col gap-3">
        <h2 id="ejemplo" className="text-2xl font-semibold">
          Así se ve un aviso
        </h2>
        <div className="rounded-lg border p-5">
          <p className="font-medium">{EJEMPLO.aviso}</p>
          <p className="mt-2 text-xs text-muted-foreground">{EJEMPLO.aclaracion}</p>
        </div>
      </section>

      {formulario ? (
        <section aria-labelledby="contacto" className="flex flex-col gap-4">
          <h2 id="contacto" className="text-2xl font-semibold">
            Habla con el equipo
          </h2>
          {formulario}
        </section>
      ) : null}
    </main>
  );
}
