/**
 * Help for every input in Nokko: what it is, what it is for and, for fields worth drafting elsewhere,
 * what to ask another AI. Matched by label (see normalizeLabel), so one entry covers every screen that
 * uses the same label; `labels` lists the variants. `prompt: false` hides «Copiar prompt» (selects,
 * dates, settings, keys): there is nothing to draft for those.
 */
export type HelpEntry = {
  labels: string[];
  description: string;
  goal: string;
  example?: string;
  /** The task for the other assistant; defaults to «escribe el contenido de …». */
  ask?: string;
  /** The answer format; defaults to plain text ready to paste. */
  format?: string;
  prompt?: false;
};

const LIST = "una lista separada por comas, sin numerar ni explicar.";
const NUMBER = "solo el número, sin símbolos ni texto. Si es una estimación, añade debajo una línea con la fuente o el supuesto.";

export const FIELD_HELP: HelpEntry[] = [
  // ---------------- Onboarding y fuentes ----------------
  { labels: ["Web, blog o LinkedIn de la empresa", "Web de la empresa", "Web", "Sitio web"], description: "La dirección pública de tu empresa (web, blog o página de LinkedIn).", goal: "Nokko la lee para proponer posicionamiento, ICP, segmentos y precios sin que tengas que escribirlos.", example: "https://tuempresa.com", ask: "dime la URL más completa sobre la empresa (web principal, página de producto o LinkedIn) para que otra herramienta la lea.", format: "solo la URL." },
  { labels: ["Documentos: business plan, P&L, decks, battlecards, ICP", "Documentos"], description: "Archivos internos que describen tu negocio: business plan, P&L, decks, battlecards o un ICP ya escrito.", goal: "Cuanto más contexto real, más precisa es la propuesta de estrategia y menos tienes que corregir.", ask: "prepara un documento resumen del negocio con producto, clientes, competidores, precios, objetivos y métricas clave, a partir de lo que sepas de la empresa.", format: "texto con títulos cortos por sección, listo para guardar como .txt o .md." },
  { labels: ["O pega lo que tengas", "Texto pegado"], description: "Cualquier texto sobre tu negocio: descripción del producto, clientes ideales, competidores, precios, notas de reuniones.", goal: "Es la vía más rápida de dar contexto a Nokko cuando no tienes documentos a mano.", ask: "redacta un resumen completo de la empresa para que una herramienta de estrategia GTM lo lea: producto, a quién vende, problemas que resuelve, competidores, precios, canales y objetivos comerciales.", format: "texto corrido con títulos cortos por sección, máximo 2 páginas." },
  { labels: ["Indicación para rehacer el bloque", "Indicación"], description: "Lo que quieres que cambie la IA al rehacer este bloque: una frase corta o un documento entero (posicionamiento, notas, una transcripción).", goal: "La IA rehace solo este bloque siguiendo tu indicación; el resto de la propuesta no se toca.", example: "Céntrate en agencias de más de 50 personas en España y México.", ask: "redacta una indicación clara para que una IA rehaga este bloque de mi estrategia GTM: qué debe cambiar, qué debe mantener y qué datos concretos debe usar.", format: "un párrafo directo o una lista corta de instrucciones." },

  // ---------------- Jerga comercial ----------------
  { labels: ["MEDDPICC"], description: "Método para cualificar un deal con ocho preguntas: Metrics (impacto medible), Economic buyer (quién firma el presupuesto), Decision criteria (criterios de decisión), Decision process (pasos para decidir), Paper process (proceso de compra y contrato), Identify pain (dolor concreto), Champion (quién te defiende dentro) y Competition (alternativas).", goal: "Cada punto puntúa de 0 a 3; con la suma sabes si el deal está bien cualificado o qué falta antes de avanzar de etapa.", prompt: false },
  { labels: ["ABM", "Account-based"], description: "Account-Based Marketing: en vez de atraer leads sueltos, eliges cuentas objetivo concretas y marketing y ventas trabajan juntos cada una con mensajes a medida.", goal: "El tier decide cuánto personalizar: 1 · 1:1 (una cuenta), 2 · 1:few (un grupo pequeño parecido), 3 · 1:many (muchas cuentas con poca personalización).", prompt: false },

  // ---------------- Empresa ----------------
  { labels: ["Nombre de la empresa", "Empresa"], description: "El nombre de la empresa tal y como la conoce el mercado.", goal: "Identifica la empresa en listas, búsquedas y deduplicación de cuentas.", example: "Acme Logistics", format: "solo el nombre." },
  { labels: ["Razón social", "Nombre legal"], description: "Nombre legal de la empresa, si es distinto del comercial.", goal: "Aparece en facturas, propuestas y documentos formales.", format: "solo el nombre legal." },
  { labels: ["Dominio", "Dominio (acme.com)"], description: "El dominio web principal de la empresa, sin https ni www.", goal: "Nokko lo usa para no duplicar cuentas, buscar el logo y enriquecer datos con Apollo, Clay o la web.", example: "acme.com", format: "solo el dominio." },
  { labels: ["Moneda de la empresa", "Moneda"], description: "La moneda en la que trabajas los importes.", goal: "Todos los importes se muestran en ella; cambiarla solo reetiqueta, no convierte cifras.", prompt: false },

  // ---------------- Posicionamiento (April Dunford) ----------------
  { labels: ["Tus mejores clientes", "Mejores clientes"], description: "Los clientes que más valor sacan del producto y por qué lo aman.", goal: "Es la base del marco de April Dunford: de aquí salen el ICP, los mensajes y las cuentas objetivo.", example: "Agencias de marketing de 20–200 personas que gestionan más de 30 clientes en redes.", ask: "describe quiénes son los mejores clientes de la empresa y por qué el producto les encaja tan bien." },
  { labels: ["Alternativas competitivas", "Alternativas"], description: "Lo que harían tus clientes si no existieras: competidores, Excel, hacerlo a mano o no hacer nada.", goal: "Define contra qué te comparan de verdad, y con eso la diferenciación y las objeciones.", example: "Hootsuite, hojas de cálculo compartidas, contratar un community manager más.", ask: "enumera las alternativas reales que usaría un cliente si la empresa no existiera, incluidas las no tecnológicas.", format: LIST },
  { labels: ["Diferenciación"], description: "Las capacidades únicas que las alternativas no tienen.", goal: "Es lo que hace creíble el valor; alimenta pitch, battlecards y la preparación de llamadas.", ask: "identifica 2–4 capacidades únicas del producto frente a sus alternativas, concretas y verificables." },
  { labels: ["Valor"], description: "Lo que el cliente consigue gracias a esa diferenciación, en resultados de negocio.", goal: "Traduce funcionalidades en beneficios medibles para mensajes y propuestas.", example: "Reducen un 40 % el tiempo de reporting y retienen más clientes.", ask: "describe el valor de negocio que obtiene el cliente gracias a la diferenciación, con cifras si existen." },
  { labels: ["Tendencia"], description: "La ola de mercado que hace relevante tu producto ahora.", goal: "Da urgencia al mensaje: por qué comprar ahora y no dentro de un año.", ask: "describe la tendencia de mercado que hace relevante este producto hoy, en una o dos frases." },
  { labels: ["Cliente objetivo"], description: "Trozo de la frase de posicionamiento: para quién es el producto.", goal: "Completa la frase «Para [cliente objetivo] que [necesidad]…».", example: "agencias de marketing digital", format: "un fragmento en minúscula y sin punto final, que encaje dentro de una frase." },
  { labels: ["Necesidad / dolor", "Necesidad"], description: "Trozo de la frase de posicionamiento: el problema que tiene el cliente objetivo.", goal: "Completa «…que [necesidad]…» y se reutiliza en mensajes y discovery.", example: "pierden horas preparando informes para cada cliente", format: "un fragmento en minúscula y sin punto final." },
  { labels: ["Producto"], description: "El nombre del producto o plan.", goal: "Identifica qué se vende en el deal o en la frase de posicionamiento.", format: "solo el nombre." },
  { labels: ["Categoría", "Categoría de mercado"], description: "La categoría de mercado en la que quieres que te encuadren.", goal: "Marca con qué te comparan y qué espera el comprador.", example: "plataforma de gestión de redes sociales", format: "un fragmento en minúscula y sin punto final." },
  { labels: ["Beneficio clave"], description: "Trozo de la frase: el principal beneficio que obtiene el cliente.", goal: "Completa «…que [beneficio clave]…».", format: "un fragmento en minúscula y sin punto final." },
  { labels: ["Alternativa competitiva"], description: "Trozo de la frase: la alternativa principal con la que te comparan.", goal: "Completa «A diferencia de [alternativa]…».", format: "un fragmento en minúscula y sin punto final." },
  { labels: ["Diferenciador"], description: "Trozo de la frase: lo que te hace distinto frente a esa alternativa.", goal: "Completa «…nuestro producto [diferenciador]».", format: "un fragmento en minúscula y sin punto final." },
  { labels: ["Tagline"], description: "Lema corto de 5 a 10 palabras.", goal: "Encabeza web, firmas y presentaciones.", ask: "propón 3 taglines de 5 a 10 palabras y marca la recomendada.", format: "tres opciones en líneas separadas; la recomendada primero." },
  { labels: ["Una frase: qué hacemos", "Frase de una línea", "One liner"], description: "Una sola frase que explica qué hace la empresa y para quién.", goal: "Es lo que dices cuando alguien pregunta «¿a qué os dedicáis?».", ask: "escribe una sola frase clara que explique qué hace la empresa y para quién." },
  { labels: ["Pitch corto"], description: "Tres o cuatro frases: problema, solución y prueba.", goal: "Sirve para emails de prospección y el inicio de una demo.", ask: "escribe un pitch corto con problema, solución y una prueba concreta.", format: "un párrafo de 3–4 frases." },
  { labels: ["Elevator pitch"], description: "Explicación de 30 a 60 segundos de la propuesta de valor.", goal: "Para eventos, llamadas en frío y presentaciones rápidas.", ask: "escribe un elevator pitch de 30–60 segundos hablado.", format: "un párrafo de unas 100–140 palabras." },
  { labels: ["Título"], description: "El título o nombre corto de este elemento.", goal: "Lo identifica en listas, búsquedas y avisos.", format: "un título corto, máximo 8 palabras." },
  { labels: ["Mensaje"], description: "El mensaje principal que comunica este pilar o envío.", goal: "Da coherencia a outbound, demos y contenido.", ask: "redacta el mensaje en 1–2 frases orientadas al beneficio del cliente." },
  { labels: ["Pruebas", "Prueba"], description: "Evidencias que respaldan el mensaje: casos, cifras, clientes, premios.", goal: "Hacen creíble el mensaje frente a compradores escépticos.", ask: "enumera pruebas concretas (casos, métricas, logos, testimonios) que respalden este mensaje.", format: LIST },

  // ---------------- Segmentos y modelo de venta ----------------
  { labels: ["Segmento"], description: "El segmento de mercado al que pertenece este registro.", goal: "Agrupa pipeline, métricas, cobertura y payback por segmento.", prompt: false },
  { labels: ["Prioridad"], description: "Orden de importancia (1 = máxima).", goal: "Decide dónde se concentra el esfuerzo comercial y qué segmentos ven primero las sugerencias.", prompt: false },
  { labels: ["ACV mín", "ACV mín."], description: "Valor anual del contrato más bajo típico del segmento.", goal: "Con el máximo, define la horquilla de ACV que decide el modelo de venta recomendado.", ask: "estima el ACV mínimo típico de este segmento según precios públicos y competidores.", format: NUMBER },
  { labels: ["ACV máx", "ACV máx."], description: "Valor anual del contrato más alto típico del segmento.", goal: "Cierra la horquilla de ACV usada en la calculadora de capacidad y payback.", ask: "estima el ACV máximo típico de este segmento según precios públicos y competidores.", format: NUMBER },
  { labels: ["Modelo de venta", "Motion"], description: "Cómo se vende al segmento: self-service, inside sales, field sales o estratégico.", goal: "Fija ciclo, equipo necesario y costes esperados según el ACV.", prompt: false },
  { labels: ["Ciclo", "Ciclo (días)"], description: "Días medios desde la primera conversación hasta el cierre.", goal: "Sirve para prever cuándo se convierte el pipeline en ingresos.", ask: "estima el ciclo de venta medio en días para este segmento en empresas B2B similares.", format: NUMBER },
  { labels: ["SDR por AE"], description: "Cuántos SDR apoyan a cada Account Executive.", goal: "Calcula el equipo necesario para generar el pipeline objetivo.", ask: "recomienda el ratio SDR por AE para este modelo de venta.", format: NUMBER },
  { labels: ["AE por SE"], description: "Cuántos Account Executives comparte cada Sales Engineer.", goal: "Dimensiona el soporte técnico en preventa.", ask: "recomienda el ratio AE por SE para este modelo de venta.", format: NUMBER },
  { labels: ["Win rate %", "Win rate obj.", "Win rate objetivo", "Win rate"], description: "Porcentaje de oportunidades que esperas ganar.", goal: "Con la cuota, calcula cuánto pipeline necesitas (la cobertura recomendada es 3–4x).", ask: "estima un win rate objetivo realista para este segmento según benchmarks B2B.", format: NUMBER },
  { labels: ["Cuota anual AE"], description: "Ingresos nuevos que debe cerrar cada Account Executive al año.", goal: "Base de la calculadora de capacidad: cuántos AE necesitas para el objetivo.", ask: "estima una cuota anual por AE razonable para este segmento y ACV.", format: NUMBER },
  { labels: ["CAC objetivo"], description: "Coste máximo aceptable para conseguir un cliente nuevo.", goal: "Se compara con el CAC real para saber si la captación es rentable.", ask: "calcula un CAC objetivo razonable a partir del ACV, el margen y un payback de 12–18 meses.", format: NUMBER },
  { labels: ["Margen bruto %", "Margen bruto", "Margen %", "Margen"], description: "Porcentaje de ingresos que queda tras el coste de servir al cliente.", goal: "Hace real el payback: sin margen, el CAC parece recuperarse antes de lo que lo hace.", ask: "estima el margen bruto típico de una empresa como esta.", format: NUMBER },
  { labels: ["Payback obj.", "Payback objetivo"], description: "Meses en los que quieres recuperar el coste de adquisición.", goal: "Es el listón con el que se pinta en verde o rojo el payback real.", prompt: false },
  { labels: ["Calcular con"], description: "Qué datos usa la calculadora: los objetivos o los reales.", goal: "Te deja comparar el plan con lo que está pasando.", prompt: false },
  { labels: ["Cuota", "Cuota del trimestre"], description: "ACV nuevo a cerrar en el trimestre.", goal: "Base de la cobertura de pipeline y del forecast.", prompt: false },

  // ---------------- ICP ----------------
  { labels: ["Nombre del ICP"], description: "Nombre corto del perfil de cliente ideal.", goal: "Lo identifica en búsquedas, Descubiertos y puntuación.", example: "Agencias medianas en LATAM", format: "un nombre de 2–5 palabras." },
  { labels: ["Sectores o tipo de empresa", "Sectores", "Sector"], description: "Los sectores o tipos de empresa que encajan con tu producto.", goal: "Filtra búsquedas en Apollo, Clay o la web y puntúa cuentas.", example: "Agencias de marketing, consultoras de comunicación", ask: "enumera los sectores o tipos de empresa con mejor encaje para este producto.", format: LIST },
  { labels: ["Sector de LinkedIn", "Sector de LinkedIn (en inglés)"], description: "El sector tal como lo nombra LinkedIn, en inglés.", goal: "Las búsquedas de Clay y Apollo usan esa taxonomía; en español fallan.", example: "Marketing Services", ask: "traduce los sectores objetivo a los nombres exactos de la taxonomía de industrias de LinkedIn.", format: LIST },
  { labels: ["Tamaño en palabras", "Tamaño de empresa", "Tamaño"], description: "El tamaño de empresa que encaja: empleados, facturación o etapa.", goal: "Si no fijas empleados mín./máx., Nokko lo usa para buscar y puntuar.", example: "Entre 50 y 500 empleados, Serie A–C", ask: "describe el tamaño de empresa ideal (empleados, facturación o etapa) para este producto." },
  { labels: ["Geografía en palabras", "Geografía"], description: "Regiones, países o ciudades donde vendes.", goal: "Acota búsquedas y prospección a donde puedes atender.", example: "España, México y Colombia", format: LIST },
  { labels: ["Países (código de 2 letras)", "Países", "País"], description: "Países objetivo con su código ISO de 2 letras.", goal: "Filtra con precisión las búsquedas de empresas y contactos.", example: "ES, MX, CO", ask: "convierte la geografía objetivo en códigos ISO de país de 2 letras.", format: "códigos separados por comas, por ejemplo ES, MX." },
  { labels: ["Empleados desde", "Empleados mín", "Empleados mín."], description: "Número mínimo de empleados de las empresas objetivo.", goal: "Filtro numérico exacto para Apollo, Clay y la puntuación.", prompt: false },
  { labels: ["Empleados hasta", "Empleados máx", "Empleados máx."], description: "Número máximo de empleados de las empresas objetivo.", goal: "Filtro numérico exacto para Apollo, Clay y la puntuación.", prompt: false },
  { labels: ["Ingresos anuales desde", "Ingresos anuales desde (USD)"], description: "Facturación anual mínima de las empresas que buscas, en dólares.", goal: "Descarta empresas demasiado pequeñas para tu precio.", prompt: false },
  { labels: ["Stack tecnológico"], description: "Herramientas que suelen usar tus clientes ideales.", goal: "Señal de encaje e integración; ayuda a encontrar cuentas parecidas.", example: "HubSpot, Slack, Google Workspace", ask: "enumera las herramientas que suele usar el cliente ideal de este producto.", format: LIST },
  { labels: ["Etapa de crecimiento"], description: "En qué momento está la empresa: startup, scale-up, consolidada.", goal: "Ajusta el mensaje y descarta cuentas fuera de momento.", ask: "describe la etapa de crecimiento en la que el producto encaja mejor." },
  { labels: ["Señales de contratación"], description: "Puestos que abren las empresas cuando necesitan lo que vendes.", goal: "Nokko las usa para detectar cuentas con intención de compra.", example: "Head of RevOps, Marketing Ops Manager", ask: "enumera los puestos de trabajo cuya apertura indica que una empresa necesita este producto.", format: LIST },
  { labels: ["Rondas o eventos"], description: "Eventos que disparan la compra: rondas de inversión, expansión, fusiones.", goal: "Prioriza cuentas en el momento adecuado.", ask: "enumera los eventos empresariales que suelen disparar la compra de este producto.", format: LIST },
  { labels: ["Adopción tecnológica"], description: "Si tu cliente ideal es early adopter o adopta tarde.", goal: "Ajusta el discurso: innovación frente a seguridad y casos probados.", ask: "describe el perfil de adopción tecnológica del cliente ideal en una frase." },
  { labels: ["Dolores que resolvemos", "Dolor que resuelve", "Dolor"], description: "Los problemas concretos que resuelve tu producto a este cliente.", goal: "La IA los usa para cualificar leads, investigar cuentas y preparar reuniones.", ask: "enumera los 3–5 dolores principales que resuelve el producto para este perfil, con sus palabras.", format: "una lista con un dolor por línea." },
  { labels: ["Por qué encajan", "Por qué encaja"], description: "Por qué este perfil cierra rápido, usa más o renueva.", goal: "Explica la puntuación y orienta a quién priorizar.", ask: "explica en 2–3 frases por qué este perfil encaja especialmente bien con el producto." },
  { labels: ["Anti-ICP: a quién no venderle", "Anti-ICP"], description: "A quién no venderle: perfiles que no encajan o dan problemas.", goal: "Descarta leads y resta puntuación para no perder tiempo.", ask: "describe los perfiles de empresa a los que no conviene venderle este producto y por qué.", format: "una lista con un perfil por línea." },
  { labels: ["Cargos en inglés", "Cargos", "Palabras del cargo"], description: "Cargos de las personas clave a buscar, en inglés como en LinkedIn.", goal: "Apollo, Clay y Descubiertos buscan contactos con estos cargos.", example: "VP Sales, Head of RevOps, CRO", ask: "enumera los cargos en inglés de las personas que deciden o influyen en la compra de este producto.", format: LIST },
  { labels: ["Cargo"], description: "El puesto de la persona en su empresa.", goal: "Ayuda a saber su papel en la compra y cómo hablarle.", format: "solo el cargo." },
  { labels: ["Palabras clave en inglés (como en LinkedIn)", "Palabras clave (sector o producto, mejor en inglés)", "Palabras clave (sector o producto)", "Palabras clave (en su descripción)", "Palabras clave"], description: "Términos que aparecen en la descripción de las empresas que buscas.", goal: "Afinan las búsquedas de empresas en Apollo, Clay y la web.", example: "social media management, agency, influencer marketing", ask: "propón palabras clave en inglés que aparecerían en la descripción de LinkedIn de las empresas objetivo.", format: LIST },
  { labels: ["Partir de un ICP"], description: "Rellena la búsqueda con los criterios de un ICP guardado.", goal: "Evita reescribir filtros y mantiene las búsquedas alineadas con tu ICP.", prompt: false },

  // ---------------- Cuentas, personas y leads ----------------
  { labels: ["Nombre"], description: "El nombre con el que identificarás este registro.", goal: "Aparece en listas, búsquedas y avisos.", format: "solo el nombre." },
  { labels: ["Cuenta"], description: "La empresa cliente o prospecto a la que pertenece.", goal: "Vincula deals, personas y reuniones a la misma cuenta, sin duplicarla.", prompt: false },
  { labels: ["Contacto", "Con quién"], description: "La persona con la que se habla.", goal: "Sitúa la conversación y el seguimiento en la persona correcta.", prompt: false },
  { labels: ["Email"], description: "El correo de trabajo de la persona.", goal: "Para contactarla y para no duplicar personas ni leads.", prompt: false },
  { labels: ["Teléfono"], description: "Teléfono de contacto, con prefijo internacional.", goal: "Para llamadas y seguimiento.", prompt: false },
  { labels: ["LinkedIn", "URL de LinkedIn"], description: "La URL del perfil de LinkedIn de la persona.", goal: "Para investigarla y enriquecer sus datos.", prompt: false },
  { labels: ["LinkedIn de la empresa"], description: "La URL de la página de empresa en LinkedIn.", goal: "Permite enriquecer la cuenta con tamaño, sector y personas.", prompt: false },
  { labels: ["Origen", "Fuente", "Nombre del origen"], description: "De dónde vino este registro: webinar, LinkedIn, referido, formulario, evento…", goal: "Mide qué canales traen mejores leads y más ingresos.", prompt: false },
  { labels: ["Notas", "Notas libres"], description: "Cualquier contexto útil que no tenga su propio campo.", goal: "El agente y las sugerencias lo leen como contexto.", ask: "resume en notas breves lo más útil que sepamos de este registro para el seguimiento comercial.", format: "viñetas cortas." },
  { labels: ["Motivo del descarte"], description: "Por qué se descarta este lead o deal.", goal: "Nokko aprende de los descartes y no vuelve a proponer lo mismo; alimenta el análisis de pérdidas.", prompt: false },
  { labels: ["Próximo seguimiento"], description: "Cuándo toca volver a contactar.", goal: "Genera el recordatorio y evita que el lead se enfríe.", prompt: false },
  { labels: ["Responsable"], description: "La persona del equipo a cargo.", goal: "Deja claro quién debe actuar y a quién avisar.", prompt: false },
  { labels: ["Estado"], description: "En qué punto está este elemento.", goal: "Filtra listas y decide qué aparece como pendiente.", prompt: false },
  { labels: ["Tipo"], description: "La clase de elemento.", goal: "Agrupa y filtra; cambia cómo lo usa Nokko.", prompt: false },
  { labels: ["Tier", "Tier ABM"], description: "Nivel de prioridad de la cuenta (A, B o C, o 1–3 en ABM).", goal: "Decide cuánto esfuerzo y personalización recibe la cuenta.", prompt: false },
  { labels: ["Secuencia"], description: "En qué paso de la secuencia de prospección está la persona.", goal: "Evita contactar dos veces y muestra el avance del outbound.", prompt: false },
  { labels: ["Etapa CRM"], description: "Relación comercial con la persona: lead, cliente, etc.", goal: "Separa prospectos de clientes en listas y métricas.", prompt: false },
  { labels: ["Rol en la compra"], description: "Papel de la persona en la decisión: decisor, influenciador, usuario, bloqueador…", goal: "Asegura que cubres a todo el comité de compra.", prompt: false },
  { labels: ["Nivel de apoyo"], description: "Cuánto apoya a tu propuesta: promotor, neutral o detractor.", goal: "Indica dónde reforzar relaciones antes de cerrar.", prompt: false },
  { labels: ["Reporta a"], description: "A quién reporta esta persona dentro de su empresa.", goal: "Dibuja el organigrama y ayuda a llegar al decisor.", prompt: false },
  { labels: ["Prioridades y notas"], description: "Lo que le importa a esta persona y cualquier detalle útil.", goal: "Personaliza mensajes y prepara reuniones.", ask: "resume las prioridades profesionales de esta persona según su cargo y lo público sobre ella.", format: "viñetas cortas." },
  { labels: ["Salud"], description: "Cómo ves el deal: sano, atención o en riesgo.", goal: "Las alertas y el forecast priorizan los deals en riesgo.", prompt: false },
  { labels: ["Encaje con el ICP"], description: "Peso del encaje con tu ICP en la nota del lead (0–100).", goal: "Decide cuánto cuenta parecerse a tu cliente ideal.", prompt: false },
  { labels: ["Intención"], description: "Peso de las señales de interés de compra (0–100).", goal: "Decide cuánto cuenta que el lead quiera hablar del producto.", prompt: false },
  { labels: ["Poder de decisión"], description: "Peso de la autoridad de la persona (0–100).", goal: "Decide cuánto cuenta que el lead pueda decidir o influir en la compra.", prompt: false },
  { labels: ["MQL desde"], description: "Nota mínima para proponer un lead como MQL.", goal: "Marca cuándo marketing considera el lead cualificado.", prompt: false },
  { labels: ["SQL desde"], description: "Nota mínima para proponer un lead como SQL.", goal: "Marca cuándo ventas debe tomar el lead.", prompt: false },
  { labels: ["Días máx.", "Días máximos en la etapa"], description: "Días que puede pasar un lead en esta etapa antes de considerarse retrasado.", goal: "Activa los avisos de leads atascados.", prompt: false },
  { labels: ["Días sin actividad para darlo por enfriado"], description: "Días sin actividad tras los que una cuenta se considera fría.", goal: "Activa la revisión automática de cuentas que se enfrían.", prompt: false },

  // ---------------- Entrada de leads ----------------
  { labels: ["Modo"], description: "Si lo que llega se revisa antes de entrar o entra directamente.", goal: "Protege tus datos: en revisión nada se guarda sin tu aprobación.", prompt: false },
  { labels: ["Qué recibe"], description: "Si esta conexión trae leads o cuentas objetivo.", goal: "Decide dónde aparece lo que llega.", prompt: false },
  { labels: ["Por envío"], description: "Máximo de filas aceptadas en un solo envío.", goal: "Evita que un error de la otra herramienta llene Nokko de datos.", prompt: false },
  { labels: ["Al día"], description: "Máximo de filas aceptadas al día.", goal: "Si se supera, la conexión se pausa sola.", prompt: false },
  { labels: ["Etapa por defecto", "Etapa si la fila no trae ninguna", "Etapa si el lead no trae ninguna"], description: "La etapa que se asigna cuando lo importado no trae una.", goal: "Coloca cada registro en el lugar correcto del pipeline.", prompt: false },

  // ---------------- Pipeline y deals ----------------
  { labels: ["Nombre del deal", "Deal"], description: "Nombre de la oportunidad, normalmente empresa + producto.", goal: "Identifica el deal en el pipeline, el forecast y los avisos.", example: "Acme · Plan Pro", format: "solo el nombre." },
  { labels: ["Etapa"], description: "En qué punto del proceso de venta está.", goal: "Mueve el pipeline, la cobertura y el forecast.", prompt: false },
  { labels: ["Importe (ACV)", "Importe", "Valor anual del contrato (ACV)", "Valor estimado", "Valor"], description: "Valor anual del contrato (ACV) esperado.", goal: "Suma en pipeline, cobertura, forecast y CAC.", ask: "estima el ACV de este deal según el tamaño de la cuenta y los precios del producto.", format: NUMBER },
  { labels: ["Fecha de cierre"], description: "Cuándo esperas cerrar el deal.", goal: "Sin fecha, el deal no cuenta en la cobertura del trimestre.", prompt: false },
  { labels: ["Probabilidad", "Probabilidad (%)"], description: "Probabilidad de ganar el deal, en porcentaje.", goal: "Pondera el forecast.", prompt: false },
  { labels: ["Categoría de forecast"], description: "Cómo cuentas el deal en la previsión: commit, best case, pipeline u omitido.", goal: "Hace el forecast más preciso (objetivo: error menor al 10 %).", prompt: false },
  { labels: ["Próximo paso"], description: "La siguiente acción concreta, con responsable y fecha.", goal: "Un deal sin próximo paso se estanca; Nokko te avisa.", example: "Demo técnica con IT el jueves 14", ask: "propón el próximo paso concreto para avanzar este deal (qué, quién y cuándo).", format: "una frase." },
  { labels: ["Partner"], description: "El partner que participa en el deal o en la cuenta.", goal: "Mide los ingresos que traen o influyen los partners.", prompt: false },
  { labels: ["Fecha del hito"], description: "Fecha comprometida para este hito del plan de cierre.", goal: "Ordena el plan mutuo de acción con el cliente.", prompt: false },
  { labels: ["Precio"], description: "Precio del producto o plan.", goal: "Calcula el importe de los deals que lo incluyen.", prompt: false },
  { labels: ["Coste"], description: "Coste de servir este producto (opcional).", goal: "Calcula el margen real de cada deal.", prompt: false },
  { labels: ["Cobro"], description: "Cada cuánto se cobra: mensual, anual o pago único.", goal: "Convierte el precio en ACV correctamente.", prompt: false },

  // ---------------- Reuniones y llamadas ----------------
  { labels: ["Fecha y hora", "Fecha", "Inicio", "Fin", "Desde", "Hasta", "Alta", "Activación", "Pago", "Fecha de emisión"], description: "La fecha de este registro.", goal: "Ordena el historial y calcula plazos y métricas por periodo.", prompt: false },
  { labels: ["Objetivo"], description: "Qué quieres conseguir en esta reunión.", goal: "Orienta la agenda y el brief que prepara la IA.", example: "Validar presupuesto y conocer al decisor técnico", ask: "propón un objetivo concreto y medible para esta reunión comercial.", format: "una frase." },
  { labels: ["Asistentes"], description: "Quién asiste por cada lado, con su cargo y rol en la compra.", goal: "Prepara a quién hablarle y qué le importa a cada uno.", format: "una persona por línea: nombre — cargo (rol)." },
  { labels: ["Agenda"], description: "Los puntos a tratar y su orden.", goal: "Mantiene la reunión enfocada en el objetivo.", ask: "propón una agenda de reunión de 30 minutos orientada al objetivo, con tiempos.", format: "una lista numerada con minutos por punto." },
  { labels: ["Preguntas de discovery"], description: "Preguntas para entender dolor, impacto, decisión y urgencia.", goal: "Cualifica el deal (MEDDPICC) y evita presentar antes de entender.", ask: "propón 6–8 preguntas de discovery abiertas para esta reunión.", format: "una pregunta por línea." },
  { labels: ["Objeciones esperadas"], description: "Dudas o resistencias que prevés y cómo responderlas.", goal: "Llegas con respuestas preparadas.", ask: "enumera las objeciones más probables y una respuesta breve a cada una.", format: "objeción → respuesta, una por línea." },
  { labels: ["Materiales"], description: "Lo que necesitas llevar o enviar: deck, demo, casos, propuesta.", goal: "Nada se queda olvidado antes de la reunión.", format: LIST },
  { labels: ["Resultado deseado"], description: "Con qué acuerdo quieres salir de la reunión.", goal: "Define cómo sabrás que la reunión ha ido bien.", ask: "propón el resultado ideal de esta reunión en forma de compromiso concreto del cliente.", format: "una frase." },
  { labels: ["Qué les duele"], description: "El problema del cliente con sus propias palabras.", goal: "La IA desmonta la llamada y propone qué actualizar en el deal.", format: "una línea." },
  { labels: ["Qué les cuesta no resolverlo"], description: "El impacto de no resolverlo: dinero, tiempo, riesgo o una fecha límite.", goal: "Cuantifica la urgencia del deal.", format: "una línea." },
  { labels: ["Quién decide y cómo"], description: "Quién firma, quién opina y qué pasos hay hasta la compra.", goal: "Completa el proceso de decisión del deal.", format: "una línea." },
  { labels: ["Qué les frena"], description: "La objeción, duda o riesgo que salió o que intuyes.", goal: "Avisa de lo que puede bloquear el deal.", format: "una línea." },
  { labels: ["Próximo paso acordado"], description: "Qué, quién y cuándo. Sin fecha no es un próximo paso.", goal: "Se convierte en tarea y en el próximo paso del deal.", format: "una línea." },

  // ---------------- Asesor, debates, aprobaciones ----------------
  { labels: ["Objetivo o problema comercial"], description: "Lo que quieres conseguir o el problema que te preocupa.", goal: "El Asesor GTM lo cruza con tu pipeline, métricas y segmentos para darte recomendaciones priorizadas.", example: "Duplicar el pipeline del segmento mid-market antes de fin de trimestre.", ask: "formula mi objetivo o problema comercial de forma concreta, con cifra, plazo y contexto." },
  { labels: ["Horizonte"], description: "Plazo en el que quieres resultados.", goal: "Ajusta el tipo de recomendaciones: rápidas o estructurales.", prompt: false },
  { labels: ["Tema del debate", "Tema"], description: "La pregunta o decisión que quieres que debatan los agentes.", goal: "Los agentes la discuten desde sus roles y te dan una síntesis.", ask: "formula la pregunta estratégica para un debate entre directivos, concreta y con contexto." },
  { labels: ["Qué quieres cambiar"], description: "El cambio que pides aprobar.", goal: "Owner y Sales Leader lo revisan y deciden.", format: "una frase." },
  { labels: ["Evidencia"], description: "Datos o hechos que justifican el cambio.", goal: "Facilita una decisión rápida y bien fundada.", ask: "resume la evidencia que justifica este cambio, con datos concretos.", format: "viñetas cortas." },
  { labels: ["Qué se dijo"], description: "Resumen de lo que se habló en la llamada.", goal: "Queda en la historia de la cuenta para todo el equipo.", ask: "resume esta llamada comercial: contexto, dolores, objeciones y acuerdos.", format: "viñetas cortas." },
  { labels: ["Próximos pasos"], description: "Lo que queda acordado tras la llamada.", goal: "Se convierte en seguimiento y tareas.", format: "una acción por línea con responsable y fecha." },
  { labels: ["Contenido"], description: "El cuerpo del documento o nota.", goal: "Queda en Conocimiento y el agente lo usa como contexto.", ask: "redacta el contenido del documento de forma clara y estructurada.", format: "texto con títulos cortos." },
  { labels: ["Recuerdo", "Qué debe recordar Nokko"], description: "Algo que Nokko debe tener en cuenta siempre.", goal: "El agente y las sugerencias lo usan en adelante.", example: "El CFO decide; el presupuesto se aprueba en enero.", format: "una frase, máximo 600 caracteres." },

  // ---------------- Integraciones ----------------
  { labels: ["Mensaje de la secuencia"], description: "El texto que se envía en este paso.", goal: "Personaliza el contacto con cada persona.", ask: "redacta un mensaje de prospección breve y personalizado para este paso de la secuencia.", format: "máximo 90 palabras, sin asunto." },
  { labels: ["Concepto"], description: "Nombre del coste.", goal: "Agrupa el gasto en Finanzas.", example: "Salarios", prompt: false },
  { labels: ["Importe mensual"], description: "Cuánto cuesta al mes.", goal: "Se multiplica por los meses activos para el gasto real del trimestre.", prompt: false },
  { labels: ["Número de factura"], description: "El número de la factura (opcional).", goal: "Para localizarla y no duplicarla.", prompt: false },
  { labels: ["Importe de la factura"], description: "El total facturado.", goal: "Cuenta como ingreso real del trimestre.", prompt: false },
  { labels: ["Cliente o nota"], description: "A quién se facturó o una nota breve.", goal: "Identifica la factura en el listado.", prompt: false },
  { labels: ["MRR"], description: "Ingreso mensual recurrente de este cliente.", goal: "Suma el MRR nuevo del funnel self-service.", prompt: false },
  { labels: ["Clave", "Clave personal de PostHog", "Clave restringida de Stripe", "ID del proyecto"], description: "Credencial de la otra herramienta; se guarda cifrada.", goal: "Permite a Nokko leer tus datos de esa herramienta.", prompt: false },

  // ---------------- Theory U ----------------
  { labels: ["Recorrido", "Recorrido U"], description: "El recorrido de Theory U al que pertenece.", goal: "Agrupa escucha, prototipos y aprendizajes de una misma pregunta.", prompt: false },
  { labels: ["Intención / pregunta que nos convoca"], description: "La pregunta de fondo que quieres explorar con Theory U.", goal: "Guía las entrevistas, la escucha y los prototipos.", ask: "formula la pregunta que nos convoca como una pregunta abierta, ambiciosa y concreta sobre nuestro mercado." },
  { labels: ["Qué escuché", "Qué escuché (sus palabras, necesidades)"], description: "Lo que dijo la otra persona, con sus palabras.", goal: "La IA encuentra patrones entre conversaciones.", format: "frases textuales entre comillas, una por línea." },
  { labels: ["Qué me sorprendió"], description: "Lo que no esperabas oír.", goal: "Las sorpresas señalan dónde cambia el mercado.", format: "viñetas cortas." },
  { labels: ["Qué parece querer emerger"], description: "La oportunidad o idea que intuyes tras la conversación.", goal: "Alimenta los prototipos de Theory U.", format: "una o dos frases." },
  { labels: ["Mi nivel de escucha"], description: "Cómo escuchaste: descargando, factual, empática o generativa.", goal: "Te ayuda a mejorar la calidad de tus conversaciones.", prompt: false },
  { labels: ["Contexto"], description: "Dónde, cuándo y qué estaba pasando.", goal: "Sitúa la conversación al analizarla después.", format: "una frase." },
  { labels: ["Case giver"], description: "Quien presenta el caso en la clínica.", goal: "Sitúa el caso y quién recibe el feedback.", prompt: false },
  { labels: ["Coaches"], description: "Quienes escuchan y devuelven reflexiones en la clínica.", goal: "Reparte los roles de la sesión.", prompt: false },
];
