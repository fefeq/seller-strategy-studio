# Informe UX/UI de Nokko · 31 oct 2026

**Conclusión:** la base es buena (diseño Ink + Lima, tokens, ⌘K, mazo de Sugerencias, titulares con conclusión). Lo que más resta hoy no es el estilo: es que **cada pantalla intenta enseñarlo todo a la vez** y que **las tareas clave (mover deals/leads, leer datos pequeños) fallan en teclado, móvil y contraste**. Con 6 cambios cubres la mayor parte del valor.

**Cómo lo hice:** lectura del código de `seller-strategy-studio` (rama `feat/software-factory`): shell, nav, Inicio, Pipeline, Leads, Cuentas, Métricas, Auth, estilos, y la auditoría y el PRD anteriores. **No he abierto la app en vivo** (exige sesión) **ni tengo datos de uso**: todo es criterio experto sobre el código, no medición. Prioridades = propuesta, las decide Fede.

---

## P0 · Haz esto primero

### 1. Pipeline y Leads solo se pueden mover con ratón (o con un selector escondido)
- Tablero: `draggable` + `onDrop` nativo, sin teclado. HTML5 drag **no funciona en táctil**; en móvil el único camino es abrir el deal y cambiar «Etapa» (el propio texto lo admite: «Abre un deal para cambiar su etapa»).
- El roadmap ya lo tiene como pendiente (P0-2b); lo subo a **primero** porque es la acción central del producto.
- **Mejora:** menú «Mover a…» en cada tarjeta (también con teclado: `Enter` abre, flechas eligen), arrastre con `dnd-kit` (ratón, táctil y teclado), y deshacer con toast (ya tienes el patrón en Sugerencias).
- Detalle: mover a «Ganado» manda a Aprobaciones y la tarjeta no se mueve; hoy solo lo dice un toast. Muestra la tarjeta con una marca «Pendiente de aprobación».

### 2. Texto pequeño y de bajo contraste
- 83 usos de `text-[10px]`/`text-[11px]` (36 + 47), justo en la información útil: «Enfriado: N días…», retrasos, etiquetas de origen, fecha de seguimiento.
- `--ink-faint` (#868a94) sobre `--paper` (#fafaf7) da **≈3,3:1** (cálculo mío con la fórmula WCAG; confírmalo con una herramienta). Para texto pequeño el mínimo AA es 4,5:1. En oscuro (#737985 sobre #0f1115) queda en el límite.
- **Mejora:** suelo de 12 px para texto con significado; `ink-faint` solo para decoración o texto grande; subir su valor a ~#6b6f7a. Lo que importa (retraso, enfriado) como etiqueta con palabra y filete de color, no como texto gris diminuto.

### 3. Inicio muestra demasiado y repite
Orden actual: guía → mazo «Tu siguiente paso» → Briefing → tarjeta Roadmap → 4 KPI → Payback → NextSteps → 4 paneles. Son ~10 bloques; «NextSteps» y el mazo compiten, y «Base de personas» y «Cuentas» son paneles de una línea que solo sirven de enlace.
- **Mejora:** primer pantallazo = **titular + una acción principal + 3 KPI**. Todo lo demás, bajo un «Más detalle» plegado o en su pantalla.
- Fusiona «Tu siguiente paso» y NextSteps (hoy dos listas de lo mismo con otro nombre).
- Quita los paneles de enlace «Base de personas» y «Cuentas» (ya están en el menú).
- El roadmap lo anota (P0-3 «un botón principal por pantalla»): aplícalo aquí primero.

### 4. Barra de acciones sobrecargada en cabeceras
- Cuentas: hasta 6 controles en la cabecera (Reparto, ICP, Enriquecer, Importar CSV, Nueva cuenta…). Pipeline: 4 (Umbral de enfriado, «Conectar leads reales», Etapas, Nuevo deal). Leads: 3 + popover de ajustes.
- Todos pesan igual: no se sabe cuál es la acción principal. «Conectar leads reales» en Pipeline es configuración, no una acción de pipeline.
- **Mejora:** 1 botón primario (`+ Nueva cuenta`) + 1 menú «Más» con el resto, y los ajustes (umbral, etapas, entrada de leads) en un único «Ajustes de pantalla» como ya haces en Leads.

### 5. Navegación móvil sin iconos y con tres sitios para lo mismo
- Barra inferior solo con texto (11 px) y «Buscar» como texto suelto arriba; ☰/✕ son caracteres de texto. Hay buscador arriba, menú ☰ y barra inferior: tres entradas.
- El menú escritorio tiene 8 + 10 + 5 entradas (23 destinos). «Más herramientas» mezcla cosas diarias (Aprobaciones, Descubiertos) con experimentales (Theory U, Debates, Ciclo GTM, Memoria).
- **Mejora:** en barra y menú, mayor tamaño de letra y marca clara de la sección activa (sin iconos: la plantilla de SDD de Nokko pide «sin iconos, estados con palabra»; si Fede quiere iconos, es una decisión de diseño aparte); Aprobaciones y Descubiertos al grupo diario si se usan (necesita dato de uso: **mídelo antes de mover**); resto en «Más» con descripción de una línea. Barra inferior: Inicio · Sugerencias · Leads · Pipeline · Más (en vez de «Agente» como pestaña, que ya tiene botón propio).

### 6. Estados de carga y vacío inconsistentes
- Solo 2 archivos usan `Skeleton`; Leads muestra «Cargando leads…» como texto. Las pantallas se precargan por loader, pero cuando falla o tarda se ve un hueco.
- Vacíos: algunos orientan («Crea la primera para empezar su plan de cuenta»), otros solo informan («Sin reuniones planificadas»).
- **Mejora:** el componente `Empty` (ya compartido) con una frase de qué es y **un botón de la acción siguiente**; un skeleton por tipo (tabla, tarjetas KPI, tablero).

---

## P1 · Siguiente ronda

| # | Problema (dónde) | Mejora |
|---|---|---|
| 7 | **Explicaciones largas en medio de la pantalla**: el párrafo de Leads («La puntuación es el encaje con el ICP (70 %)…») y el de Pipeline (umbral de enfriado) son 3-4 líneas fijas bajo el tablero | Texto bajo demanda: enlace «Cómo se calcula» que abre un popover; deja una línea como máximo (el roadmap ya lo apunta) |
| 8 | **Tablas sin acciones masivas, orden ni filtros guardados** (Cuentas, Leads, Personas); en Cuentas solo hay búsqueda por nombre | Filtros por responsable/salud/tier, ordenar por cabecera, selección múltiple (asignar, etiquetar, enriquecer), vistas guardadas. Decisión pendiente de Fede según el roadmap |
| 9 | **Tablas en móvil**: Cuentas oculta Tier/Stakeholders/Responsable con `hidden sm:table-cell` y el resto hace scroll horizontal; Leads en lista tiene 7 columnas | En móvil, filas-tarjeta (nombre, estado, 1 dato clave, acciones) en vez de tabla reducida |
| 10 | **Panel de deal de 11 campos + MEDDPICC (8 criterios con nota) + plan conjunto + líneas** en un solo Sheet de scroll largo | Pestañas dentro del panel: Resumen · Cualificación · Plan conjunto · Líneas; «Guardar deal» fijo abajo. Guardado automático por campo (hoy mezclas «Etapa» que guarda al instante con el resto que exige «Guardar deal»: confuso) |
| 11 | **Controles MEDDPICC 0-3** son 4 botones de 36 px (móvil) / 24 px (escritorio) sin `aria-label` ni estado pulsado | Grupo de radio accesible, objetivo de 44 px en móvil, etiqueta «0 = sin evidencia … 3 = confirmado» visible |
| 12 | **26 `<select>` en 16 archivos**; solo uno es el `Pick` del sistema (`fields.tsx`), los otros 25 tienen altura, borde y letra propios (p. ej. `h-8 text-xs` en Leads lista vs `h-10 text-base` en `Pick`) *(corregido tras leer el código: no es «nativo vs sistema», `Pick` también es nativo)* | Un solo control de selección con dos densidades; mismo aspecto y foco → SDD A |
| 13 | **Auth**: sin «¿Olvidaste la contraseña?», sin mostrar/ocultar contraseña, `Label` sin `htmlFor`, mínimo 6 caracteres, Google debajo de la contraseña | Recuperar contraseña, ojo para ver la contraseña, `htmlFor`+`autocomplete`, Google primero si es el camino principal (mídelo), enlace de «Confirma tu email» con reenvío |
| 14 | **Jerga**: MEDDPICC, SQL, MQL, ICP, forecast ponderado, «Best case» sin ayuda; el glosario de AGENTS.md dice que los acrónimos de industria se quedan en inglés | Mantén el término, pero con tooltip de una línea la primera vez. Para usuarios que no vienen de ventas es la mayor barrera de comprensión |
| 15 | **Métricas**: 9 secciones en pestañas y el resumen mezcla KPI, gráficos y tablas | Resumen = 4-5 KPI con tendencia y «qué hacer»; ver detalle abre la sección. Cada gráfico, una conclusión en el título (ya lo haces en las pantallas; replícalo aquí) |
| 16 | **Contenido que no cabe en el grupo de menú «Ajustes»**: Empresa, Equipo, Conexiones, Configuración, Conectar asistentes = 5 sitios para ajustes, con nombres parecidos (Conexiones / Conectar asistentes / Configuración) | Una sola pantalla Ajustes con pestañas; renombra «Conectar asistentes» (¿MCP?) a algo que describa para qué sirve |

## P2 · Pulido

- **Accesibilidad:** hay 144 `aria-label` y 34 `focus-visible`, buena base; faltan comprobar orden de foco en Sheets, trampa de foco del mazo de Sugerencias, `prefers-reduced-motion` (no aparece en el código; el mazo usa `motion`), y anuncio de toasts para lectores de pantalla.
- **Escritorio:** «‹ Plegar» como texto pequeño; dale más área de clic y muestra `⌘B` en su ayuda. El botón «Agente ⌘J» es el único elemento oscuro sólido: está bien como CTA, pero compite con el primario de cada pantalla.
- **Densidad:** `eyebrow` en mayúsculas pequeñas se usa en casi todo (KPI, columnas, títulos de tarjeta); pierde jerarquía. Reserva el eyebrow para el contexto de página y usa peso/tamaño en el resto.
- **Salud:** `HealthDot` es una palabra con filete de color (bonito, pero sin icono ni forma): se lee solo por color en los tres estados. Para daltonismo, la palabra ya aporta el estado; revisa solo que el filete tenga contraste suficiente (sin añadir iconos, por la regla de diseño).
- **Transiciones:** al mover una tarjeta o descartar una sugerencia, anima el cambio (roadmap P2).
- **`Kpi`, `Stat` y `Panel` copiados** en 11 definiciones locales (6 `Kpi`, 2 `Stat`, 3 `Panel`, en Inicio, Pipeline, Leads, Métricas, presupuesto, embudo self-service, finanzas y tablero) *(corregido: antes decía 8)* con estilos ligeramente distintos (`p-5` vs `px-4 py-3`, `text-4xl` vs `text-2xl`). `Empty` ya está compartido *(corregido)*. Extrae `Kpi` y `Panel` junto a `Empty` en `components/page.tsx` → SDD A.

---

## Lo que ya funciona (no lo toques)
Titulares con conclusión calculada, ⌘K, plegado de la barra lateral recordado, sidebar con grupos que se abren solos, deshacer en el mazo, errores en español con «qué pasó + qué hacer», tema oscuro sin parpadeo, precarga de pantallas, aviso de duplicados al crear cuentas.

## Qué falta para decidir bien
1. **Uso real** (qué pantallas y acciones se usan): sin ello, mover Aprobaciones/Descubiertos al menú diario o quitar paneles es una apuesta. Pídelo a la base de datos o a PostHog; no lo estimo.
2. **Pasar por la app en vivo** con una cuenta de prueba a 375 px y 1440 px para validar los puntos 2, 5 y 9 (los saqué del código).
3. **Contraste real**: medir con una herramienta (el 3,3:1 es mi cálculo).
4. **Decisión de Fede** abierta del roadmap: acciones masivas y vistas guardadas, ¿ahora o después?

## Cómo llevarlo a Dani
Todo lo que toca código pasa por SDD aprobado por ti (regla de Postin/Nokko). Propuesta de empaquetado, de menos a más riesgo:
1. **SDD A · Legibilidad y contraste** (puntos 2, 12, `Kpi/Panel/Empty` compartidos): bajo riesgo, solo tokens y componentes.
2. **SDD B · Mover sin arrastrar** (punto 1): el más valioso; toca Pipeline y Leads.
3. **SDD C · Inicio y cabeceras con un primario** (3, 4): requiere tu decisión sobre qué queda en Inicio.
4. **SDD D · Navegación y ajustes** (5, 16): requiere dato de uso antes.
5. **SDD E · Tablas y panel de deal** (8, 9, 10, 11): el mayor; depende de tu decisión sobre vistas guardadas.

Puedo redactar cualquiera con `postin-sdd` cuando me digas por cuál empezar.
