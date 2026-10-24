# Onboarding de Nokko: de cero a una estrategia GTM aprobada sin fricción (SDD)

El plan sigue Spec-Driven Development en tres capas: **Requisitos** (qué y por qué), **Diseño** (cómo se ve y funciona) y **Tareas** (en qué orden se construye y cómo se comprueba). Cada fase deja la app funcionando.

---

## 1. Requisitos

### Persona principal
Un founder con poco tiempo. Entra a crear su estrategia GTM y después usa Nokko a diario para ejecutarla. No quiere rellenar formularios: quiere dar lo que ya tiene y aprobar.

### Historias de usuario
1. Como founder, elijo cuánto tiempo y profundidad quiero dedicar (Exprés, Estándar o A fondo), y Nokko ajusta las preguntas y el trabajo a esa elección.
2. Como founder, doy todo lo que ya tengo de una vez: la web, el blog, LinkedIn, un business plan, un P&L, un ICP, battlecards, decks, textos sueltos y documentos de Drive o del CRM. Nokko los lee solo.
3. Como founder, veo en directo qué está leyendo Nokko y qué ha aprendido, con la fuente de cada dato.
4. Como founder, apruebo la estrategia **bloque a bloque**: empresa, ICP, segmentos y benchmarks, posicionamiento, mensajes, objetivos y cuota. Cada dato muestra de dónde sale («Web · 24 oct», «Business plan p. 4», «Supuesto de Nokko»).
5. Como founder, cuando a Nokko le falta algo, me hace solo las preguntas imprescindibles, una a una y con opciones.
6. Como founder, puedo salir a mitad y volver justo donde lo dejé, desde cualquier dispositivo.
7. Como founder, al terminar veo un **roadmap claro**: qué hará Nokko solo y qué me toca a mí. Desde ahí lanzo los primeros pasos: buscar empresas por ICP, importar leads o cuentas, conectar herramientas, y conectar asistentes de IA y Telegram.
8. Como miembro invitado, mi onboarding es corto: mi rol, mis preferencias y lo que ya está aprobado.

### Criterios de aceptación
- La primera propuesta aparece en menos de 3 minutos en Exprés, contando solo con la web.
- No hay campos obligatorios antes de ver valor. Lo único obligatorio es el nombre de la empresa o la web.
- Ningún dato propuesto se guarda sin aprobar su bloque. Los datos que escribe la persona nunca se sobrescriben (se respeta la marca de origen de cada campo que ya existe).
- Cada bloque se puede deshacer después de guardarlo, como ya permite el guardado de Configuración.
- El progreso de Configuración (el porcentaje de la barra lateral) sube con cada bloque aprobado.
- Todo el texto en español neutro, de tú. Con el diseño Nokko Edición: sin iconos, estados con palabra y sin cajas.
- La lectura de fuentes respeta el presupuesto mensual (aviso al 80 % y pausa al 100 %) y muestra el coste aproximado antes de lanzar Estándar o A fondo.

### Fuera de alcance
- Facturación y planes de pago.
- Los conectores CRM nuevos que aún no existen (Pipedrive, Attio, Salesforce): para esos, el onboarding enlaza la importación por CSV o webhook que ya existe.

---

## 2. Diseño

### Recorrido

```text
Crear empresa ─► 1 Profundidad ─► 2 Dale tus fuentes ─► 3 Nokko lee (en directo)
      ─► 4 Preguntas que faltan ─► 5 Aprobar bloque a bloque ─► 6 Tu roadmap y primeros pasos
```

**1. Profundidad.** Tres opciones con su tiempo y lo que obtienes:
- Exprés (5 min): con la web, una estrategia base con supuestos marcados.
- Estándar (15 min): web y documentos, unas 5 preguntas.
- A fondo (30+ min): todas las fuentes, informe de mercado y competidores, y debate de los agentes C-Levels sobre la estrategia.

**2. Dale tus fuentes.** Una sola pantalla con varias zonas:
- Web, blog y LinkedIn de la empresa.
- Arrastrar archivos: business plan, P&L, decks, battlecards, ICP.
- Pegar texto.
- Elegir documentos o carpetas de Drive.
- Conectar el CRM: HubSpot mediante la importación existente, el resto por CSV.

Cada fuente queda en una lista con su estado: «Leyendo», «Leído» o «Sin acceso». Además, todas se guardan en Conocimiento para que el agente las use después.

**3. Nokko lee.** Corre en segundo plano y te avisa al terminar. Un panel tipo teletipo muestra lo que encuentra: «Encontrado: 3 segmentos en el business plan», «Competidor: X (web)». Puedes salir: el aviso te devuelve aquí.

**4. Preguntas que faltan.** Solo las que bloquean un bloque, con opciones y «No lo sé, propónmelo». Reutiliza la entrevista que ya existe.

**5. Aprobar bloque a bloque.**
- Seis bloques en orden: Empresa y moneda, ICP, Segmentos y benchmarks, Posicionamiento (Dunford), Mensajes, Objetivos y cuota.
- Cada bloque muestra la propuesta editable, el origen de cada dato y su nivel: «Confirmado», «Deducido» o «Supuesto».
- Acciones por bloque: «Aprobar bloque», «Rehacer con IA» (con una indicación) y «Saltar por ahora».
- En A fondo, cada bloque incluye la opinión breve del debate C-Levels.

**6. Tu roadmap.** Una pantalla final con dos columnas:
- **Nokko hará solo:** buscar empresas por ICP cada semana, preparar reuniones e investigar cuentas nuevas, con el piloto automático y el interruptor por empresa.
- **Te toca a ti:** conectar herramientas, importar leads o cuentas, conectar asistentes de IA y Telegram, e invitar al equipo.

Cada paso tiene su botón y su estado. El roadmap sigue visible en Inicio hasta completarse, y lo alimenta el ciclo GTM que ya existe (fases y siguientes pasos).

### Reutilización de lo que ya existe
- Extracción con IA, propuesta y deshacer guardado: `setup-extraction.ts`, `setup-undo.ts`, componentes `setup/ai-fill` y `setup/wizard`.
- Entrevista: `setup-questions.ts`. Progreso: `setup-schema.ts` (`SETUP_ITEMS`, `setupStatus`).
- Lectura web: Firecrawl y Perplexity (`web-research-core`). Documentos: Drive (`drive-core`) y `importToKnowledge`. Informes A fondo: Parallel.
- Segundo plano y avisos: `background_jobs` con un nuevo tipo de trabajo y el centro de avisos.
- Presupuesto: el orquestador (`monthBudget`). Origen de cada dato: `provenance.ts`.
- ICP estructurado: `icp.ts` y el componente `icp-editor`. Debates: `bmad/debate-core`.
- Siguientes pasos: `use-cycle` y `next-steps`. Primeros pasos: búsqueda ICP, importación (`leads.entrada`, `import-review`), `/connect` y vinculación de Telegram.

### Detalles técnicos
- Tabla nueva `onboarding_sessions`: org_id, user_id, depth, step, sources (jsonb), findings (jsonb), block_status (jsonb), timestamps. Con GRANTs, RLS por empresa y usuario, y org_id por defecto `current_org()`.
- Nuevo tipo de trabajo `onboarding_read`. Lee cada fuente con tolerancia a fallos y escribe los hallazgos con su origen. El progreso se informa por pasos.
- La extracción amplía `SETUP_EXTRACTION_SCHEMA` con origen y confianza por campo. Los PDF y XLSX se leen con el parser de documentos que ya existe en el servidor, o desde Drive.
- Cada bloque se aprueba con las herramientas de escritura actuales (`upsert_segment`, `create_icp`, `update_positioning`, etc.), que ya validan rol y empresa. Se graban las marcas de origen.
- Ruta nueva `/onboarding` con un paso por pantalla, piezas en `src/components/onboarding/` y lógica pura en `src/lib/onboarding.ts`. `/setup` sigue para editar después.
- Las empresas nuevas sin estrategia van directas a `/onboarding` tras `create_organization`. A los invitados se les muestra la versión corta.

---

## 3. Tareas

1. **Esqueleto y estado.** Crear la tabla de sesiones, la ruta `/onboarding` con elección de profundidad, y la opción de reanudar. Comprobación: crear empresa, salir y volver al mismo paso.
2. **Fuentes.** Pantalla de fuentes con web, archivos, texto, Drive y CSV/HubSpot. Cada fuente se guarda en Conocimiento. Comprobación: subir un PDF y una web y verlas listadas.
3. **Lectura en segundo plano.** Trabajo `onboarding_read` con teletipo, aviso al terminar y coste previo según profundidad. Comprobación: lectura real de una web con hallazgos y fuente.
4. **Preguntas que faltan.** Solo las que bloquean bloques, con «propónmelo». Comprobación: una prueba de qué preguntas salen según los datos que faltan.
5. **Aprobación por bloques.** Seis bloques con origen, nivel y las acciones aprobar, rehacer y saltar, más deshacer. Comprobación: pruebas de que no se sobrescriben datos escritos por la persona y de que el progreso sube; aprobar un bloque en el navegador.
6. **A fondo.** Informe Parallel de mercado y competidores, y opinión del debate C-Levels por bloque. Comprobación: ejecución real con presupuesto.
7. **Roadmap y primeros pasos.** Pantalla final y tarjeta en Inicio, enlazadas al ciclo GTM y al piloto automático. Comprobación: completar un paso y verlo marcado.
8. **Invitados y pulido.** Recorrido corto para invitados, móvil y modo oscuro. Pruebas de extremo a extremo de Exprés y Estándar.

Los datos de prueba que se creen durante la verificación se borran al terminar.
