// Nokko's base playbook library: generic B2B plays that the AI adapts to each company's approved
// context (positioning, pillars, ICP, segments). Pure data, so the adaptation, the Hub and the tests
// read one source. Markers in «» are what the adaptation must replace with the company's own words.

export type BasePlay = {
  id: "discovery" | "objections" | "demo" | "negotiation" | "proposal";
  section: "playbooks" | "objections";
  title: string;
  /** What the AI must keep when adapting: the structure, not the examples. */
  keep: string;
  body: string;
};

export const BASE_PLAYS: BasePlay[] = [
  {
    id: "discovery",
    section: "playbooks",
    title: "Discovery: qué preguntar y en qué orden",
    keep: "Las cinco fases y su orden. Sustituye los ejemplos entre «» por el dolor, la categoría y el beneficio de la empresa.",
    body: `Objetivo de la llamada: entender si hay un problema que merece la pena resolver, quién lo sufre y qué pasa si no se resuelve. No vender.

1. Contexto (3 minutos)
- ¿Cómo gestionáis hoy «el proceso que resolvemos»?
- ¿Quién participa y quién decide?
- ¿Qué cambió para que estemos hablando ahora?

2. Dolor (5 minutos)
- ¿Qué es lo que más tiempo os quita de eso?
- ¿Cuándo fue la última vez que salió mal? ¿Qué pasó?
- ¿Cuánto os cuesta cada vez, en horas o en dinero?

3. Impacto (5 minutos)
- Si en seis meses sigue igual, ¿qué consecuencia tiene para ti y para tu equipo?
- ¿A quién más le afecta?
- ¿Qué os permitiría hacer si desapareciera?

4. Decisión (5 minutos)
- ¿Cómo se aprueba una herramienta así en «empresa tipo del ICP»?
- ¿Quién tiene que decir que sí y quién puede decir que no?
- ¿Qué habéis probado antes y por qué no cuajó?

5. Cierre (2 minutos)
- Resume en una frase lo que has oído y pide confirmación.
- Propón el siguiente paso con fecha: demo con «el decisor», prueba o propuesta.
- Si no hay dolor claro, dilo y no fuerces la demo.

Reglas
- Una pregunta cada vez. Silencio después de preguntar.
- Anota literales: las palabras del cliente valen más que tu resumen.
- Rellena MEDDPICC al terminar: métrica, comprador económico, criterios, proceso, dolor, campeón.`,
  },
  {
    id: "objections",
    section: "objections",
    title: "Objeciones: las respuestas que funcionan",
    keep: "La estructura reconocer, preguntar, responder, confirmar y la lista de objeciones. Sustituye las respuestas entre «» con el diferenciador, las pruebas y los precios reales de la empresa; no inventes cifras.",
    body: `Cómo responder a cualquier objeción
1. Reconoce: «Tiene sentido que lo preguntes».
2. Pregunta: «¿Qué te preocupa exactamente de eso?». La primera objeción casi nunca es la real.
3. Responde con un dato o un ejemplo, no con un adjetivo.
4. Confirma: «¿Con esto queda resuelto o hay algo más?».

Las seis más frecuentes

«Es caro» / «No tenemos presupuesto»
- Pregunta: ¿caro comparado con qué? ¿Con lo que hacéis hoy o con otra herramienta?
- Responde con el coste de no hacerlo: «lo que cuesta hoy el problema, en horas o en dinero, según el discovery».
- Si no hay presupuesto, pregunta cuándo se decide y quién lo abre.

«Ya tenemos algo» / «Lo hacemos con Excel»
- Pregunta: ¿qué es lo que mejor os funciona de eso? ¿Y lo que peor?
- Responde con «la diferencia concreta frente a la alternativa habitual», sin despreciar lo que usan.

«No es el momento»
- Pregunta: ¿qué tendría que pasar para que lo fuera?
- Acuerda una fecha de revisión y qué tiene que haber cambiado. Si no hay nada, descarta.

«Tengo que consultarlo»
- Pregunta: ¿con quién y qué necesita ver esa persona para decidir?
- Ofrece preparar ese material o estar en esa conversación.

«¿Y si no funciona?»
- Responde con «la prueba, garantía o caso real de la empresa», con plazo y resultado.
- Propón empezar pequeño: un equipo, un mes, un indicador.

«Necesito ver más referencias»
- Pregunta: ¿referencias de qué tipo de empresa? Da una que se parezca a la suya o di que no la tienes todavía.

Lo que no se hace
- Bajar el precio sin pedir nada a cambio.
- Discutir. Si la objeción es real y no tienes respuesta, apúntala y vuelve con ella.`,
  },
  {
    id: "demo",
    section: "playbooks",
    title: "Demo: tres minutos sobre su problema",
    keep: "La estructura de la demo y la regla de los tres minutos. Sustituye los ejemplos entre «» por el flujo real del producto y los perfiles de comprador de la empresa.",
    body: `Principio: la demo no enseña el producto, enseña cómo desaparece su problema. Lo que no responde a algo que dijo en el discovery, sobra.

Antes
- Relee las notas del discovery y elige el dolor principal.
- Prepara datos que se parezcan a los suyos. Nada de «Empresa de prueba».
- Decide qué no vas a enseñar.

Estructura (30 minutos)
1. Recapitula (2 minutos): «Me dijiste que «el dolor principal». ¿Sigue siendo lo más importante?».
2. Tres minutos sobre su problema: enseña solo el flujo que lo resuelve, de principio a fin, con sus datos. Para y pregunta: «¿Así es como lo harías tú?».
3. Profundiza donde haya reacción (10 minutos): sigue sus preguntas, no tu guion.
4. Lo que decide la compra (5 minutos): enseña «lo que necesita ver el decisor: seguridad, integraciones, informes». Solo si está presente quien lo necesita.
5. Siguiente paso (3 minutos): propón el paso con fecha y responsable. Pregunta qué falta para decidir.

Por perfil de comprador
- Decisor económico: resultado y riesgo. Menos clics, más «qué cambia en el trimestre».
- Usuario diario: velocidad y comodidad. Que lo pruebe él en la demo.
- Técnico o seguridad: integraciones, permisos, datos. Ten las respuestas escritas.
- Campeón: dale material para vender dentro: una página, un caso, un número.

Reglas
- Si algo falla, no te disculpes tres veces: sigue.
- Nunca enseñes una función «por si acaso».
- Termina con una pregunta, no con una lista de funciones.`,
  },
  {
    id: "negotiation",
    section: "playbooks",
    title: "Negociación: condiciones, intercambios y límites",
    keep: "La lista de intercambios posibles y los límites. Sustituye los ejemplos entre «» por las condiciones comerciales reales de la empresa; nunca inventes descuentos.",
    body: `Principio: nada se concede gratis. Cada concesión se cambia por algo que reduce riesgo o acorta el ciclo.

Antes de negociar
- Ten claro el precio objetivo, el mínimo aceptable y el punto donde te levantas.
- Sabe qué le importa a cada persona del lado del cliente: el decisor quiere resultado, compras quiere ahorro, legal quiere riesgo cero.

Qué puedes dar y qué pides a cambio
- Descuento: a cambio de plazo más largo, pago anual por adelantado o más usuarios.
- Precio congelado: a cambio de compromiso de renovación.
- Onboarding incluido: a cambio de firmar antes de «una fecha concreta».
- Prueba ampliada: a cambio de un indicador de éxito acordado y una fecha de decisión.
- Cláusula de salida: a cambio de referencia o caso de éxito.

Cómo responder a «dame un descuento»
1. Pregunta qué cifra necesita y por qué: a veces es un objetivo de compras, no un bloqueo real.
2. Si concedes, concede una vez y pide algo a cambio en la misma frase.
3. Nunca por partes: el segundo descuento invita al tercero.

Límites
- No negocies por email lo que puedes resolver en una llamada de 15 minutos.
- No aceptes plazos de pago o cláusulas que no puedas cumplir.
- Si el descuento supera «el margen de maniobra del comercial», pasa por aprobación en Nokko.

Cierre
- Resume por escrito lo acordado el mismo día.
- Fija fecha de firma y quién firma. Un acuerdo sin fecha no es un acuerdo.`,
  },
  {
    id: "proposal",
    section: "playbooks",
    title: "Propuestas: anatomía y señales de alarma",
    keep: "Las seis secciones y las señales de alarma. Sustituye los ejemplos entre «» por la oferta y los precios reales de la empresa.",
    body: `Una propuesta se escribe para el que no estuvo en las reuniones. Tiene que poder aprobarla alguien que no te conoce.

Seis secciones, en este orden
1. Su situación: el problema con sus palabras y lo que cuesta hoy. Dos párrafos.
2. Qué proponemos: «el producto o servicio» aplicado a su caso, sin lista de funciones.
3. Qué cambia: tres resultados concretos y cómo se medirán.
4. Cómo empezamos: plan de las primeras semanas con responsables de cada lado.
5. Inversión: precio claro, qué incluye y qué no. Una opción, dos como mucho.
6. Siguiente paso: qué tiene que hacer el cliente y para cuándo.

Señales de alarma antes de enviarla
- No sabes quién la va a leer ni quién la aprueba.
- No has hablado del precio en voz alta antes de escribirlo.
- Hay más de dos opciones: no decides por él, lo mareas.
- La pide «para compararla» sin haber hecho demo.
- No hay fecha de decisión acordada.

Después de enviarla
- Llama el mismo día para repasarla, no la dejes al email.
- Si no hay respuesta en cinco días, aplica la secuencia de seguimiento y actualiza la fecha de cierre del deal.`,
  },
];

export const BASE_PLAY_TITLES = BASE_PLAYS.map((p) => p.title);
