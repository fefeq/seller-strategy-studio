/** Purpose is inferred only from the source label, never a claim about its contents. */
export function SourcePurpose({ source }: { source: string }) {
  const label = source.toLowerCase();
  const purpose = /^web\s*·/i.test(source)
    ? "Contrastar cómo presentas públicamente tu producto, a quién te diriges y qué prometes. Comprueba si refleja tu negocio de hoy."
    : label.includes("texto pegado")
      ? "Aportar el contexto que tú has escrito. Comprueba que Nokko lo haya interpretado sin perder matices."
      : /icp|cliente|segment/.test(label)
        ? "Dar contexto sobre tus clientes y segmentos objetivo. Revisa que no se confundan clientes actuales con clientes que quieres conseguir."
        : /p&l|finanza|presupuesto|budget/.test(label)
          ? "Dar contexto económico a los objetivos comerciales. Revisa fechas, moneda y si las cifras son reales o previsiones."
          : /battlecard|competi/.test(label)
            ? "Entender alternativas y diferencias frente a la competencia. Revisa que las comparaciones sigan vigentes."
            : /deck|pitch|presentaci/.test(label)
              ? "Entender tu oferta y cómo la cuentas. Revisa que las promesas y los ejemplos sigan siendo válidos."
              : "Aportar contexto para entender tu negocio. Revisa si la interpretación es fiel al documento y si la información sigue vigente.";
  return (
    <p className="mt-2 text-xs leading-relaxed text-ink-mid">
      <span className="font-semibold text-ink">Para qué sirve: </span>
      {purpose}
    </p>
  );
}

export function ReadingGuide() {
  return (
    <div className="mb-6 border-b border-hairline pb-6">
      <h2 className="mt-2 text-2xl font-semibold text-ink">Revisa lo que Nokko entendió</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">
        Estos hallazgos son una interpretación de tus fuentes, no decisiones ya aprobadas. Revisa
        primero lo que esté equivocado, desactualizado o incompleto.
      </p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-ink">Es correcto → Confirmar</dt>
          <dd className="mt-1 text-sm text-ink-mid">
            Validas este dato, no toda la fuente ni tu estrategia.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Necesita un matiz → Editar</dt>
          <dd className="mt-1 text-sm text-ink-mid">
            Corrige el texto. Al guardar, tu versión queda confirmada.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">No lo quieres aquí → Descartar</dt>
          <dd className="mt-1 text-sm text-ink-mid">
            Lo retiras de esta lista. Puedes recuperarlo durante 24 horas.
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-ink-mid">
        Descartar un hallazgo o quitar una fuente no recalcula la propuesta ya generada. Si
        necesitas que deje de influir, vuelve a leer tus fuentes; después revisa los bloques antes
        de aprobarlos.
      </p>
    </div>
  );
}
