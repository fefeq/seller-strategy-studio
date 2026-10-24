# Nokko: menos texto, una próxima acción clara y navegación más simple

## El problema (medido hoy en la vista previa, como Owner, 1280 px)

| Pantalla | Palabras | Botones y enlaces | Alto de página |
|---|---|---|---|
| Inicio | 470 | 39 | 2.449 px (casi 3 pantallas) |
| Sugerencias | 462 | 31 | 2.121 px |
| Métricas | 897 | 22 | 4.558 px (5 pantallas) |
| Estrategia GTM | 310 | 11 | 1.121 px |
| Leads | 210 | 12 | 1.058 px |
| Cuentas / Pipeline / Personas | 45–83 | 7–11 | 1 pantalla |

Diagnóstico:
- **Sin una próxima acción.** Inicio muestra 3 columnas con el mismo peso visual y ningún botón principal. Cada sugerencia ofrece 4 botones (Resolver, Hecho, En 3 días, Descartar).
- **Texto explicativo siempre visible.** Los avisos semanales se ven completos, con párrafos de ayuda debajo de las tablas y notas largas en las tarjetas de números.
- **Las pantallas de análisis son muy largas.** Métricas apila más de 10 bloques en una sola página.
- **Cada pantalla resuelve la navegación a su manera.** Las pantallas grandes usan pestañas, desplegables o bloques apilados, sin un patrón común.

## Principios (basados en Linear, Attio, Clay y Notion)

1. **Una pantalla, un trabajo, una acción principal.** Solo hay un botón lima por pantalla.
2. **Primero la conclusión, el detalle bajo demanda.** Se ve el título y una línea; el resto se abre al pulsar «Ver más».
3. **Foco guiado.** Nokko siempre propone «tu siguiente paso» y lo lleva a primer plano.
4. **Movimiento con sentido.** Las animaciones aparecen solo al confirmar, cambiar de estado o señalar dónde mirar, y siempre duran menos de 200 ms.
5. **No se quita ninguna función.** Solo se reubica o se pliega.

## P0. Saber qué hacer al entrar

**P0-1 «Tu siguiente paso» en Inicio (modo foco).**
- Arriba de Inicio aparece una sola tarjeta grande: la acción más importante ahora, con su motivo en una línea, un botón principal, «Saltar» y «1 de 5».
- Al resolverla, la tarjeta se desliza y entra la siguiente. Cuando no queda nada, aparece «Todo al día» y lo próximo de la agenda.
- Debajo quedan tres resúmenes compactos que se abren al pulsar: Hoy · Decisiones · Lo que hice solo.
- **Orden de prioridad:** reuniones en las próximas 2 h, después aprobaciones, sugerencias urgentes, leads retrasados, deals en riesgo, el siguiente bloque de la estrategia y, por último, el resto.

**P0-2 Sugerencias tipo Tinder (modo «Decidir»).**
- Las sugerencias se muestran como un mazo de tarjetas apiladas, una cada vez, con el contador «3 de 12» y una barra de progreso.
- **Gestos, con el dedo o arrastrando con el ratón:**
  - Derecha: hacer o aprobar. La tarjeta se tiñe de lima con la palabra «Hacer».
  - Izquierda: descartar. Se tiñe de rojo suave con «Descartar».
  - Arriba: posponer 3 días, con «Más tarde».
  - Tocar la tarjeta: se gira y muestra el detalle completo.
- La tarjeta sigue al dedo, se inclina y, al soltar, sale volando o vuelve con un rebote si el gesto no fue suficiente. La de debajo sube a primer plano.
- Debajo hay tres botones grandes (✕ · Más tarde · ✓) para quien no quiera arrastrar. En el teclado funcionan las flechas ← ↑ →, y Z deshace.
- **Deshacer siempre:** después de cada gesto aparece «Deshacer» durante 6 s y la tarjeta vuelve al mazo.
- **Seguridad:** las acciones que gastan créditos o escriben datos piden confirmar el coste en la propia tarjeta antes de salir. Descartar en grupo sigue reservado al Owner.
- **Final del mazo:** aparece «Todo decidido», con cuántas has hecho, pospuesto y descartado, y un enlace a la vista de lista.
- La vista de lista actual sigue disponible con un cambio «Mazo / Lista». En ella, cada fila tiene un botón principal y un menú «···». En el móvil se pueden deslizar las filas para hacer o descartar, como en el correo.
- El mismo mazo se usa para «Tu siguiente paso» en Inicio, para Descubiertos (aceptar o descartar empresas y contactos) y para revisar los leads importados en cuarentena.

**P0-2b Acciones cotidianas en el resto de la app.**
- Arrastrar y soltar para cambiar de etapa, en Leads (ya existe) y en Pipeline, con la columna de destino resaltada y la tarjeta animada al llegar.
- Deslizar filas en el móvil para las acciones rápidas, en Leads, Cuentas y Personas.
- Tirar hacia abajo para actualizar en el móvil.
- Arrastrar un archivo CSV sobre Cuentas o Leads para importarlo.

**P0-3 Un solo botón principal por pantalla.**
- Revisión de todas las pantallas: la acción principal en lima y el resto como botones secundarios o dentro de «Más».
- Ejemplos: Cuentas «+ Nueva cuenta», con Importar y Reparto en «Más». Leads «+ Nuevo lead». Pipeline «+ Nuevo deal».

## P1. Menos texto y menos scroll

**P1-1 Texto bajo demanda.**
- Los párrafos de ayuda pasan a un enlace «¿Cómo funciona?» que abre una explicación breve.
- Los textos de más de 2 líneas en las tarjetas se recortan, con «Ver más».
- Las notas de los números quedan en una sola línea corta, con el detalle al pasar el cursor o al tocar.
- Repaso de los textos de las pantallas principales: frases más cortas y sin repetir lo que ya dice el título.

**P1-2 Métricas y Estrategia GTM en secciones.**
- Una barra de secciones fija arriba (Resumen · Embudo · Cobertura · CAC y payback · Presupuesto · Deals ganados) en lugar de una página de 5 pantallas.
- Se muestra una sección cada vez. La sección «Resumen» enseña 4 números y su conclusión.
- La sección elegida queda en la dirección de la página, para que se pueda compartir y recordar.

**P1-3 Acciones en grupo y vistas guardadas (aprobado).**
- En Leads, Cuentas y Personas, cada fila lleva una casilla. Al marcar varias aparece una barra flotante abajo: Completar datos, Asignar, Cambiar etapa, Calificar y Descartar (este último solo para Owner).
- Las acciones pesadas van en segundo plano y avisan al terminar, como ahora.
- Vistas guardadas: guarda filtros y orden con un nombre, por ejemplo «Mis leads retrasados». Pueden ser personales o compartidas con la empresa.

**P1-4 Detalle sin salir de la lista.**
- Al abrir un lead, una persona o un deal se muestra un panel lateral, como hoy en Leads. Se extiende a Personas y Pipeline.
- Se navega con ↑/↓ entre registros sin cerrar el panel.

## P2. Movimiento y foco

- **Transiciones:** fundido corto entre pantallas; los paneles y la paleta ⌘K entran deslizando.
- **Confirmación visible:** el número que cambia hace un breve conteo y la fila guardada se ilumina un instante en lima suave.
- **Foco guiado:** al llegar desde un aviso, el elemento destacado se desplaza a la vista y se resalta 1,5 s.
- **Primeros pasos:** en una empresa nueva, 3 pasos guiados (estrategia, primeros leads, conectar fuentes). Cada uno señala el botón exacto y se puede saltar.
- **Estados vacíos:** cada estado vacío enseña una acción concreta y no solo un texto.
- **Accesibilidad:** se respeta «reducir movimiento» del sistema, el anillo de foco es visible y todo se puede usar con teclado.

## Decisiones ya tomadas
- Acciones en grupo y vistas guardadas: **sí, ahora**.
- Solo el Owner borra o descarta en grupo, como hasta ahora.

## Cómo lo verificaré
- Repito esta medición después del cambio. Objetivos: Inicio con menos de 150 palabras y una sola acción principal visible; Métricas con 1 pantalla por sección.
- Capturas antes y después en ordenador y móvil, en tema claro y oscuro.
- Pruebas automáticas para el orden de «Tu siguiente paso», los atajos de triaje y los permisos de acciones en grupo.

---

## Detalles técnicos
- `src/lib/next-step.ts` (pura, con test): reúne reuniones, aprobaciones, sugerencias, leads retrasados, deals en riesgo y la configuración en una lista ordenada. Reutiliza `todayItems`/`digest`.
- `src/components/home/focus-card.tsx` y `src/components/briefing.tsx`, con resúmenes plegables.
- Mazo: componente genérico `SwipeDeck<T>` (`src/components/swipe-deck.tsx`) con la librería `motion` (drag, umbral por distancia y velocidad, spring, AnimatePresence). Se reutiliza en Sugerencias, Inicio, Descubiertos y cuarentena. Las reglas de umbral y dirección van en `src/lib/swipe.ts` (pura, con test).
- `SuggestionCard`: variantes `deck` y `row`, menú «···», hook de teclado `useTriageKeys` y aviso de deshacer con sonner (posponer o descartar se revierte cambiando el estado; «hacer» solo se deshace si la acción es reversible, y si no se confirma antes).
- Deslizar filas en el móvil: componente `SwipeRow`. Arrastrar y soltar en Pipeline con el mismo patrón que ya usa Leads.
- Animaciones: utilidades CSS en `src/styles.css` (keyframes de entrada y salida, `@media (prefers-reduced-motion)`), sin librería nueva. Si hace falta animar la salida de listas, valorar `motion`.
- Métricas y Estrategia: añadir `?seccion=` con `validateSearch` y renderizar un panel por vez a partir de los módulos que ya existen en `src/components/<screen>/`.
- Vistas guardadas: nueva tabla `saved_views` (org_id por defecto `current_org()`, user_id, screen, name, filters jsonb, shared bool) con RLS: propias o compartidas de la empresa; solo el autor o el Owner editan y borran. GRANT a `authenticated`.
- Acciones en grupo: componente `BulkBar` y estado de selección por pantalla. Se reutilizan los lanzadores de segundo plano de `quick-actions.tsx` con varios IDs. El descarte en grupo se comprueba con el rol `owner`.
- Componente `HelpHint` («¿Cómo funciona?», un popover) para sustituir los párrafos de ayuda.
