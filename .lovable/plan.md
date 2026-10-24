# Auditoría UX/UI de Nokko: mejoras propuestas

## Resumen
Nokko ya hace muy bien lo más difícil en un SaaS B2B. Cada pantalla abre con una conclusión («5 sugerencias esperan tu decisión, 1 urgente»), el trabajo pesado va en segundo plano y cada dato muestra de dónde sale. El problema es que **hay demasiado a la vez**:
- El menú tiene 23 entradas.
- Inicio enseña la misma tarea tres veces.
- Una persona que vende a diario se encuentra con pantallas pensadas para quien diseña la estrategia.

Lo primero que hay que arreglar es encontrar las cosas y saber qué hacer ahora. Después viene la rapidez de uso: buscar con el teclado, acciones sobre varias filas a la vez y no tener que bajar tanto en cada pantalla.

**Qué revisé:**
- 14 pantallas con sesión iniciada, en escritorio (1280 px) y en móvil (390 px).
- El código de navegación y de las pantallas.
- Accesibilidad básica.
- La analítica de nokko.ai (25 sep–24 oct 2026): 47 visitas y 201 páginas vistas; 25 en escritorio, 20 en móvil y 2 en tableta. Las páginas más visitadas son Portada, Inicio, Sugerencias, Estrategia y Configuración.

## Trabajos del producto
| Trabajo | Quién | Frecuencia | Estado hoy |
|---|---|---|---|
| Decidir qué hacer hoy | Todos | Diaria | Bien resuelto, pero repetido en tres sitios |
| Trabajar cuentas, leads y deals | AE, SDR | Diaria | Funciona, pero con mucha pantalla antes de la lista |
| Definir la estrategia GTM | Owner, Sales Leader | Semanal | Potente, pero densa; tablas que se salen por la derecha |
| Revisar métricas | Liderazgo | Semanal | Correcto |
| Configurar empresa, equipo y conexiones | Owner | Puntual | Repartido en 5 entradas de menú |

## Hallazgos

### P0-1 Menú con 23 entradas iguales para todos los roles
- **Problema:** el menú lateral muestra 5 bloques con 23 entradas (Theory U, Debates, Ciclo GTM, ABM…) a cualquier rol. En pantallas de 1000 px de alto, el bloque Estrategia queda cortado por el resumen «Estrategia completada». Evidencia: `/tmp/browser/ux/d_inbox.png`.
- **A quién afecta:** a todos, a diario. Más a quien vende (AE y SDR), que no usa la mitad.
- **Referencia:** Linear y Notion: un menú corto con lo diario, y lo demás en «Más» o en ⌘K.
- **Propuesta:** dejar fijas las 8 entradas diarias (Inicio, Sugerencias, Cuentas, Leads, Pipeline, Personas, Estrategia, Métricas). El resto pasa a «Más herramientas», un bloque que se puede abrir y cerrar, y Ajustes queda en una sola entrada con pestañas (Empresa, Equipo, Conexiones, Asistentes, Configuración). El orden y lo visible dependen del rol, y cada persona puede fijar sus favoritas.
- **Criterio de aceptación:** un AE ve como mucho 10 entradas sin bajar en la pantalla, y cualquier herramienta se abre en 2 clics o desde ⌘K.
- **Esfuerzo:** M · **Riesgo:** ninguno. No cambia ningún permiso, solo lo que se ve.

### P0-2 Inicio repite la misma tarea tres veces y deja «Hoy» al fondo
- **Problema:** «Completa el posicionamiento» aparece en la barra de estrategia, en el roadmap y en «Necesita tu decisión». En el móvil, la primera pantalla entera es estrategia y «Hoy» no se ve sin bajar. Evidencia: `/tmp/browser/ux/d_home.png` y `/tmp/browser/ux/m_home.png`.
- **A quién afecta:** a todos, cada vez que abren la app (Inicio es la página más vista después de la portada).
- **Referencia:** Linear: una sola bandeja de entrada. Intercom y Loom: la lista de onboarding desaparece al completarla.
- **Propuesta:** Inicio con este orden: 1) Hoy (reuniones, tareas, seguimientos); 2) Necesita tu decisión (como mucho 3, con «ver todas»); 3) Lo que hice solo, plegado. La barra y el roadmap de estrategia se unen en una sola tarjeta compacta, que solo ve el Owner o el Sales Leader mientras la estrategia esté por debajo del 100 %.
- **Criterio de aceptación:** ninguna tarea aparece dos veces en Inicio, y en el móvil «Hoy» se ve sin bajar.
- **Esfuerzo:** M · **Riesgo:** ninguno.

### P1-1 No hay buscador global ni ⌘K para moverse y actuar
- **Problema:** el componente para buscar existe en el código, pero no se usa. Para abrir una cuenta hay que ir a Cuentas y buscarla allí. ⌘J abre el agente, pero no sirve para ir a una pantalla.
- **A quién afecta:** a todos, varias veces al día.
- **Referencia:** Linear, Notion y Attio: ⌘K para ir a una pantalla, abrir un registro o lanzar una acción.
- **Propuesta:** ⌘K y un botón «Buscar» en la barra de arriba. Busca cuentas, leads, personas y deals de la empresa actual, todas las pantallas y acciones como «Nuevo lead», «Completar datos de…» o «Buscar empresas por ICP». Cada acción muestra su atajo de teclado.
- **Criterio de aceptación:** desde cualquier pantalla, abrir una cuenta por su nombre en 3 pulsaciones.
- **Esfuerzo:** M · **Riesgo:** ninguno.

### P1-2 Leads y Cuentas: la lista queda muy abajo
- **Problema:** en Leads, antes del tablero hay 5 botones de configuración, 4 cifras y un embudo, y el tablero empieza a unos 620 px. El interruptor «Completar solo» es una opción para toda la empresa que está mezclada con los botones del día a día. Evidencia: `/tmp/browser/ux/d_leads.png`.
- **A quién afecta:** a SDR y AE, a diario.
- **Referencia:** Attio y Clay: la tabla es el espacio de trabajo, los ajustes van en un menú «⋯» y las cifras son pequeñas encima de la tabla.
- **Propuesta:** la conclusión, una fila fina de cifras y después directamente el tablero o listado. «Entrada de leads», «Pesos de la calificación», «Plazos por etapa» y «Completar solo» pasan a un menú «Ajustes de leads». El embudo y la conversión por origen pasan a una pestaña «Análisis». Lo mismo en Cuentas.
- **Criterio de aceptación:** en un escritorio de 1280×800, la primera fila de leads se ve sin bajar.
- **Esfuerzo:** S · **Riesgo:** ninguno.

### P1-3 Ni acciones sobre varias filas ni vistas guardadas
- **Problema:** las acciones rápidas son fila por fila. No se puede seleccionar 20 leads y asignarlos, calificarlos o descartarlos de una vez, ni guardar un filtro («mis SQL retrasados»).
- **A quién afecta:** a SDR, AE y Sales Leader, a diario.
- **Referencia:** Notion y Attio: vistas guardadas por usuario. Linear: seleccionar varias filas y actuar sobre todas.
- **Propuesta:** casillas en el listado y una barra de acciones (asignar, cambiar etapa, calificar, completar datos, descartar). Las acciones con IA o créditos muestran el coste antes de lanzarse. Vistas guardadas por usuario en Leads, Cuentas y Pipeline.
- **Criterio de aceptación:** asignar 20 leads a una persona en menos de 10 segundos.
- **Esfuerzo:** L · **Riesgo:** sin reglas nuevas; usa los mismos permisos de cada acción.

### P1-4 Tablas de Estrategia que se salen por la derecha
- **Problema:** «Tus segmentos y benchmarks» mide 1775 px en una pantalla de 1280 y corta columnas como «Margen bruto» sin avisar. Evidencia: `/tmp/browser/ux/d_strategy.png`.
- **A quién afecta:** a Owner y Sales Leader, cada semana.
- **Referencia:** Notion y Airtable: primera columna fija y el resto se desplaza dentro de la tabla, o una ficha por segmento.
- **Propuesta:** columna «Segmento» fija con desplazamiento lateral y un aviso de que hay más columnas, o una ficha por segmento con los campos agrupados (económicos y capacidad).
- **Criterio de aceptación:** a 1280 px no hay columnas cortadas sin aviso y la página no se desplaza a lo ancho.
- **Esfuerzo:** S · **Riesgo:** ninguno.

### P1-5 El botón «Agente» tapa contenido
- **Problema:** en escritorio, el botón flotante «Agente ⌘J» tapa textos y columnas abajo a la derecha (por ejemplo, la columna «Ganado» en Leads). Evidencia: `/tmp/browser/ux/d_leads.png` y `/tmp/browser/ux/d_strategy.png`.
- **A quién afecta:** a todos en escritorio.
- **Referencia:** Intercom y Linear: un botón pequeño, o el acceso en la barra superior.
- **Propuesta:** pasar el agente a la barra superior, junto a Buscar (⌘K) y Avisos. Si se mantiene flotante, que sea pequeño y deje espacio libre debajo del contenido.
- **Criterio de aceptación:** el botón no tapa ningún contenido en las 14 pantallas revisadas.
- **Esfuerzo:** S · **Riesgo:** ninguno.

### P1-6 Sugerencias en el móvil se sale por la derecha
- **Problema:** a 390 px la página mide 472 px de ancho, así que se desplaza de lado y los botones de cada sugerencia quedan fuera.
- **A quién afecta:** a quien la abre desde el móvil (20 de las 47 visitas fueron en móvil).
- **Referencia:** Slack: en el móvil, cada aviso es para decidir con un toque.
- **Propuesta:** botones que pasan a otra línea cuando no caben y textos que no fuerzan el ancho; en el móvil, «Resolver» como botón principal y el resto en «⋯».
- **Criterio de aceptación:** ninguna pantalla se desplaza a lo ancho a 390 px.
- **Esfuerzo:** S · **Riesgo:** ninguno.

### P2-1 Accesibilidad y zonas para tocar
- **Problema:** hay botones sin nombre accesible (1 en Cuentas, 2 en Leads; por ejemplo, el «—» de las tarjetas). En escritorio hay entre 20 y 33 botones o enlaces por pantalla de menos de 32 px de alto. «Acciones» va en mayúsculas pequeñas y cuesta verlo.
- **Referencia:** las reglas de accesibilidad de la plataforma.
- **Propuesta:** dar nombre a todos los botones de icono, dejar como mínimo 44 px para tocar en el móvil y revisar el contraste de las etiquetas pequeñas en modo claro y oscuro.
- **Criterio de aceptación:** cero botones sin nombre en las pantallas principales.
- **Esfuerzo:** S · **Riesgo:** ninguno.

### P2-2 Estados de carga y textos de ayuda largos
- **Problema:**
  - Pocas pantallas muestran un estado de carga (4 referencias en 28 pantallas), así que algunas se ven vacías un momento antes de llenarse.
  - Los textos de ayuda son párrafos largos y repetidos. En Sugerencias, por ejemplo: «Reviso tu pipeline… cada hora…».
- **Referencia:** Linear: placeholders con la forma del contenido. Stripe: ayuda de una línea con «Saber más».
- **Propuesta:**
  - Placeholders con la forma real de cada lista mientras carga.
  - Textos de ayuda de una línea que se pueden desplegar y que, una vez leídos, se recuerdan.
- **Esfuerzo:** S · **Riesgo:** ninguno.

## Hoja de ruta
- **Fase 1 (P0):** menú corto por rol con «Más herramientas» y Ajustes unificado; Inicio sin repeticiones.
- **Fase 2 (P1):** ⌘K y búsqueda global; Leads y Cuentas con la lista primero; tablas de Estrategia; botón del agente; Sugerencias en el móvil; acciones sobre varias filas y vistas guardadas, la pieza más grande, al final.
- **Fase 3 (P2):** accesibilidad, estados de carga y textos de ayuda.

En cada fase saco capturas de antes y después en escritorio y en móvil, y mantengo las pruebas automáticas en verde.

## Decisiones para ti
1. **Menú por rol:** ¿te parecen bien las 8 entradas fijas propuestas? ¿Theory U, Debates, Ciclo GTM y ABM pasan a «Más herramientas» para todos?
2. **Agente:** ¿lo pasamos a la barra superior o lo mantenemos flotante pero más pequeño?
3. **Acciones sobre varias filas:** ¿las hacemos ahora (son la pieza más grande) o después de las fases 1 y 2?

## No comprobado
- Las pantallas con sesión de otros roles (AE, SDR o invitado): solo tengo tu sesión de Owner.
- Usar la app solo con teclado, de principio a fin, y el contraste exacto en modo oscuro.
- Fichas de cuenta, lead y deal por dentro, Debates, Ciclo GTM, Theory U y ABM: revisé las listas, no cada ficha.
- La analítica cuenta visitas y páginas, no qué hace cada persona: no se pueden ver abandonos dentro de una pantalla.

---

# Nuevo aspecto visual: moderno, business casual, startupero

Sustituye «Nokko Edición» (papel, tinta y un solo rojo, esquinas rectas, sin sombras) por un estilo más cercano y con energía, en la línea de Clay y Attio. Se aplica antes que las fases de la auditoría, así cada pantalla que se rehace ya sale con el estilo nuevo.

## Paleta «Ink + Lima»
- **Fondo:** blanco cálido (#FAFAF7). **Texto:** casi negro (#0F1115). **Texto secundario:** gris (#5B5F6A).
- **Acento lima** (#C6F432): botón principal, selección, barras de progreso y estado activo del menú. Siempre con texto oscuro encima, porque el lima no se lee como texto sobre fondo claro.
- **Azul** (#2B59FF): enlaces y foco del teclado.
- **Estados con color propio** (siempre acompañados de la palabra): verde para hecho, ámbar para aviso, rojo solo para errores y acciones peligrosas.
- **Modo oscuro:** fondo tinta, texto claro y el mismo lima de acento.

## Forma y tipografía
- **Esquinas redondeadas** (8–12 px), tarjetas con borde suave y una sombra ligera. Los botones son píldoras o rectángulos redondeados.
- **Tipografía:** Space Grotesk para titulares y cifras (con carácter, muy de startup) y DM Sans para el texto y las tablas (legible y compacta). Sustituyen a Jost y a Spline Sans Mono.
- **Etiquetas de estado** como «chips» de color suave en lugar de palabras en mayúsculas pequeñas.
- **Menú lateral** claro con el elemento activo resaltado en lima, más aire y grupos plegables (encaja con P0-1).

## Qué no cambia
- La forma del logo de Nokko se mantiene; solo cambia su color a tinta y lima.
- Los textos, las funciones y los datos.

## Detalles técnicos
- Tokens nuevos en `src/styles.css` (claro y oscuro), sustituyendo las reglas globales «radio 0», «tarjeta = línea superior» y «sin sombras». Restyle de los componentes base de `src/components/ui` (botón, tarjeta, pestañas, inputs, badges, diálogos) para que todas las pantallas cambien sin tocarlas una a una.
- Space Grotesk y DM Sans vía @fontsource; se retiran las fuentes binarias anteriores del sistema de diseño.
- Revisión de los colores que estén escritos a mano en las pantallas, para pasarlos a los tokens.
- Se actualizan la memoria del diseño, las reglas del proyecto y los iconos de la app (PWA y favicon) con la nueva paleta.
- Capturas antes y después de Inicio, Leads, Estrategia y Sugerencias, en escritorio, en móvil y en modo oscuro; contraste comprobado en los dos temas.
