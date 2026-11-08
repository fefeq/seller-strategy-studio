# SDD-20261031-ux-move-without-drag · [Mejora] Mover deals y leads sin arrastrar

**Tipo:** Mejora · **Prioridad propuesta:** Alta (apuesta de Fede: el arrastre no sirve en táctil, comprobado en el código; cuánta gente usa móvil o teclado es **sin dato**)
**Estado:** Hecho (entregado en el PR #91, merge d149d10; gate mecánico PASS sobre 4c6b339; migración 0074 aplicada, verificada en la base el 2026-11-08; sin prueba manual con sesión, cerrado por decisión de Fede del 2026-11-08; antes: Borrador) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`)
**Depende de:** `SDD-20261031-ux-legibility-contrast` se integra antes (ver §14). El menú de Pipeline ofrece «Ganado» solo cuando se entregue `SDD-20261031-deal-won-duplicate-approvals` (el arreglo de duplicados salió de este SDD el 2026-10-31). · **Ticket:** por asignar
**Base de trabajo:** `origin/main` (decidido por Fede el 2026-10-31). Este SDD se leyó sobre `feat/software-factory`, que puede estar desfasada: **[Por verificar]** que las líneas citadas coincidan en `origin/main`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Al no haber PRD, los objetivos G-n se definen en §4 y cada CA cita el suyo. Los CA que no admiten prueba automática lo dicen en su línea como **manual** y se listan en §16.

## 1. Resumen
Hoy un deal solo se mueve de etapa arrastrando su tarjeta con el ratón, o abriéndolo y cambiando la etapa en su panel. Un lead se puede mover con arrastre, con un selector (solo en la vista de lista) o pasando al siguiente paso desde su menú de acciones. En táctil y con teclado el arrastre no sirve. Esta mejora añade en cada tarjeta un «Mover a…» a cualquier etapa, hace que arrastrar funcione con ratón, táctil y teclado y deja deshacer los movimientos reversibles durante unos segundos.

## 2. Problema y para quién
Quien lleva deals y leads (AE, SDR, Sales Leader, Owner) tiene que poder cambiar una etapa desde el móvil o sin ratón. Hoy, en móvil, el único camino en Pipeline es abrir el deal (el propio texto de la pantalla lo dice: «Abre un deal para cambiar su etapa»). Quien use solo teclado o lector de pantalla no puede mover nada en el tablero.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 en `seller-strategy-studio` (rama `feat/software-factory`; las líneas pueden moverse). Lectura de código; **no se ha abierto la app en vivo** y **no hay datos de uso**.
- Pipeline (`src/routes/_authenticated/deals.tsx`): las tarjetas tienen `draggable`, `onDragStart` y `onDrop` del navegador (`:94-101`), sin teclado. No hay menú de acciones en la tarjeta. El cambio de etapa del panel del deal usa la misma función `move` (`:182`).
- `move` (`deals.tsx:59-74`): si la etapa destino no es «Perdido», comprueba el «camino» y, si faltan datos de MEDDPICC, avisa con un toast pero deja mover; si la etapa es `won`, no mueve el deal: inserta una solicitud en `approvals` (su fallo de duplicados va en `SDD-20261031-deal-won-duplicate-approvals`); en el resto actualiza `stage` y `probability`. Mover a `lost` no pasa por el aviso de MEDDPICC. Mover un deal ya Ganado a una etapa abierta hoy está permitido.
- Leads (`src/routes/_authenticated/leads.index.tsx`): tarjetas con `draggable` (`:183`) y columnas con `onDrop` (`:172-173`). Ya existe un menú de acciones por tarjeta (`LeadQuickActions`, `src/components/quick-actions.tsx:98-133`) con «Pasar a [siguiente etapa]» y «Descartar», pero **no ofrece saltar a cualquier etapa ni volver atrás**; la vista de lista tiene un selector de etapa con todas (`leads.index.tsx:147`).
- Reglas de movimiento de leads (`leads.index.tsx:79-89`): un lead que ya es oportunidad no se mueve («síguelo desde Pipeline»); pasar a `opportunity` crea un deal en la primera etapa y muestra un toast con enlace a Pipeline.
- Reglas de la base que afectan al deshacer (lectura de migraciones, **[Por verificar]** en la base viva): un deal rellena `closed_at` al quedar Ganado o Perdido solo si estaba vacío y nada lo borra al reabrir (`drizzle/migrations/0002_multitenant_organizations.sql:175`); un lead fija `stage_entered_at` al cambiar de etapa (`0012_lead_funnel.sql:54-84`), así que «deshacer» reinicia el contador de días en etapa.
- Hay deshacer con plazo de 5 s en el mazo de Sugerencias (`src/components/swipe-deck.tsx:13`, `undoMs = 5000`; toast con «Deshacer»); es el precedente de la experiencia, no se reutiliza código tal cual.
- Dependencias de arrastre accesible: **no hay ninguna** en `package.json`.
- Líneas base: veces al día que se mueve un deal o lead, desde qué dispositivo, uso de lector de pantalla: **sin dato**.

## 4. Resultado buscado
- **G-1** Cualquier persona que hoy puede mover un deal o un lead puede hacerlo desde móvil, con teclado o con ratón, sin depender de arrastrar.
- **G-2** Un movimiento reversible hecho por error se puede deshacer enseguida.
- **G-3** No cambia quién puede mover, quién aprueba ni las reglas de etapas, probabilidad y cualificación.
- Métrica de éxito: ninguna de uso (**sin dato** de partida; no se estima ninguna). Medible por código: movimiento posible en táctil y teclado = sí.

## 5. Alcance
**Incluye:**
- «Mover a…» en cada tarjeta de Pipeline y en cada tarjeta de Leads (en Leads, ampliando el menú de acciones que ya existe), con todas las etapas disponibles. **«Ganado» aparece en el menú de Pipeline solo cuando se entregue el SDD de duplicados de aprobaciones.**
- Arrastre que funciona con ratón, táctil y teclado, con anuncio para lectores de pantalla. Mientras tanto, soltar en «Ganado» sigue como hoy.
- Deshacer durante 5 s tras mover, solo en los movimientos reversibles (definidos abajo).
- Aviso breve de qué pasó cuando el deal no se mueve (por aprobación) o falla.

**Definiciones usadas en este SDD:**
- **Etapa abierta** = etapa de tipo abierto de la empresa; **Ganado** = la etapa de tipo ganado (clave `won`); **Perdido** = la de tipo perdido. Las etapas de cada empresa son editables y se toman de su configuración, no de una lista fija.
- **Movimiento reversible** (ofrece «Deshacer») = de etapa abierta a otra etapa abierta, en deals; entre las etapas abiertas de lead (Nuevo, Contactado, MQL, SQL), en leads. Se restauran los valores guardados justo antes del movimiento (etapa y probabilidad en deals; etapa en leads). La fecha de entrada en la etapa y los días en etapa se reinician (no se restauran); **[Por verificar]** que no haya otros campos que cambien en la base.
- **Movimiento no reversible** (sin «Deshacer», con aviso de qué ha pasado y dónde seguirlo) = cualquier movimiento con destino u origen en Ganado, Perdido, Oportunidad o Descartado, porque tiene efectos que un deshacer simple no revierte: crea una solicitud (Ganado), crea un deal (Oportunidad), o deja un cierre registrado (Perdido, y Ganado al reabrir) o un estado final (Descartado). **Decidido por Fede el 2026-10-31:** Descartado y Perdido no se pueden deshacer en esta primera versión; si más adelante se quiere, Dani comprueba antes qué rastro dejan.

**No incluye:**
- Evitar solicitudes de «Ganado» duplicadas, la marca «Pendiente de aprobación» y el bloqueo con solicitud pendiente (SDD `deal-won-duplicate-approvals`).
- Cambiar quién puede mover o quién aprueba (permisos actuales).
- Cambiar etapas, probabilidades, el camino ni la cualificación MEDDPICC.
- Acciones masivas, vistas guardadas, filtros nuevos (SDD E).
- Rediseño del panel del deal (SDD E).
- Iconos.
- Arrastrar filas de tablas (Cuentas, Personas, listado de Leads).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- «Mover a…» por tarjeta en Pipeline; «Mover a…» a cualquier etapa en Leads.
- Deshacer tras mover (solo reversibles).
- Anuncio de movimiento para lectores de pantalla.
**Modificado:**
- Arrastrar → funciona también con táctil y teclado (antes solo ratón).
- Texto bajo el tablero en móvil «Abre un deal para cambiar su etapa» → indica el menú «Mover a…».
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como persona que lleva un deal, quiero moverlo de etapa desde su tarjeta, sin arrastrar.
- **CA-1** CUANDO se abre el menú de una tarjeta de Pipeline, el sistema DEBE ofrecer «Mover a…» con todas las etapas de la empresa salvo «Ganado» (que se añade con el SDD de duplicados de aprobaciones), marcando la actual · cubre G-1 · prueba: `src/lib/board-move.test.ts`
- **CA-2** CUANDO se elige una etapa abierta distinta de la actual, el sistema DEBE moverla con las mismas reglas que al arrastrar (aviso de MEDDPICC incluido) y actualizar su probabilidad · cubre G-1, G-3 · prueba: `src/lib/board-move.test.ts`
- **CA-3** CUANDO se elige «Perdido», el sistema DEBE mover el deal sin aviso de MEDDPICC, como hoy · cubre G-3 · prueba: `src/lib/board-move.test.ts`
- **CA-4** El sistema DEBE permitir abrir y recorrer el menú solo con teclado y con un toque · cubre G-1 · prueba: `src/components/board-move.test.tsx` (prueba de interfaz con teclado) y **manual** (toque en móvil, 375 px, con área táctil cómoda; el tamaño exacto lo propone Dani, §15 · 3)
- **CA-5** SI la persona no tiene hoy permiso de escritura sobre deals (o sobre leads), ENTONCES el sistema NO DEBE ofrecerle «Mover a…» · cubre G-3 · prueba: `src/lib/board-move.test.ts` (**[Por verificar]** qué roles tienen hoy escritura: la política actual deja escribir a todo miembro, y la lista de roles de solo lectura, si existe, la confirma Dani)

### H-2: Como persona que lleva un lead, quiero saltar a cualquier etapa desde su menú de acciones.
- **CA-6** CUANDO se abre el menú de acciones de un lead abierto, el sistema DEBE ofrecer «Mover a…» con todas las etapas (incluidas las anteriores y «Descartado») además de lo que ya ofrece · cubre G-1 · prueba: `src/lib/board-move.test.ts`
- **CA-7** SI el lead ya es oportunidad, ENTONCES el sistema NO DEBE ofrecer «Mover a…» y DEBE seguir diciendo «síguelo desde Pipeline» · cubre G-3 · prueba: `src/lib/board-move.test.ts`
- **CA-8** CUANDO el lead pasa a «Oportunidad», el sistema DEBE seguir creando su deal y mostrando el aviso con enlace a Pipeline · cubre G-3 · prueba: `src/lib/board-move.test.ts` (el camino del menú a Oportunidad); las pruebas existentes de la ingesta cubren la creación del deal

### H-3: Como persona sin ratón o en móvil, quiero arrastrar una tarjeta y soltarla en otra etapa.
- **CA-9** El sistema DEBE permitir arrastrar una tarjeta a otra etapa con ratón y soltarla allí · cubre G-1 · prueba: **manual** con ratón en U-2 (Dani puede automatizarla en navegador si la librería elegida lo permite)
- **CA-10** CUANDO la persona usa solo teclado, el sistema DEBE permitir levantar una tarjeta con Espacio, moverla entre etapas con las flechas, soltarla con Espacio y cancelar con Esc · cubre G-1 · prueba: `src/components/board-move.test.tsx`
- **CA-11** CUANDO la persona levanta una tarjeta con una pulsación larga (duración que fija Dani) y la arrastra con un dedo, el sistema DEBE moverla; CUANDO desliza con un dedo fuera de una tarjeta levantada, el sistema DEBE desplazar el tablero en horizontal · cubre G-1 · prueba: **manual** en navegador táctil real (U-2; **[Por verificar]** que ambos gestos convivan)
- **CA-12** CUANDO se levanta, se mueve o se suelta una tarjeta con teclado, el sistema DEBE anunciarlo a un lector de pantalla: al levantar, la etapa de origen; al mover y soltar, la de destino · cubre G-1 · prueba: `src/components/board-move.test.tsx`
- **CA-13** SI se suelta una tarjeta en su misma etapa, ENTONCES el sistema NO DEBE hacer ningún cambio ni mostrar «Deshacer» · cubre G-1 · prueba: `src/lib/board-move.test.ts`

### H-4: Como persona que se ha equivocado, quiero deshacer el movimiento.
- **CA-14** CUANDO se mueve un deal o lead (por menú o por arrastre) con un movimiento reversible, el sistema DEBE guardar el cambio al instante y mostrar un aviso con «Deshacer» durante 5 segundos; si se pulsa, DEBE restaurar los valores guardados justo antes del movimiento (aunque la probabilidad se hubiera editado a mano). Solo hay un aviso vigente por deal o lead: un nuevo movimiento sustituye al anterior · cubre G-2 · prueba: `src/lib/board-move.test.ts`
- **CA-15** CUANDO el movimiento no es reversible, el sistema NO DEBE ofrecer «Deshacer» y DEBE decir qué ha pasado y dónde seguirlo · cubre G-2, G-3 · prueba: `src/lib/board-move.test.ts`
- **CA-16** SI al deshacer la etapa ya no es la que se movió (la cambió otra persona o un proceso), ENTONCES el sistema NO DEBE sobrescribirla y DEBE avisar de que ya cambió · cubre G-2 · prueba: `src/lib/board-move.pg.test.ts` (prueba contra una base real de pruebas, con el patrón de los `*.pg.test.ts` del repo; la restauración solo debe aplicarse si la etapa sigue siendo la movida)
- **CA-17** SI la persona sale de la pantalla antes de que pasen los 5 segundos, ENTONCES el cambio DEBE quedar guardado y la opción de deshacer simplemente desaparece · cubre G-2 · prueba: `src/components/board-move.test.tsx`
- **CA-19** SI falla el guardado al deshacer, ENTONCES el sistema DEBE mantener la etapa actual y avisar con «qué pasó + qué hacer» · cubre G-2 · prueba: `src/lib/board-move.test.ts`
- **CA-18** SI falla el guardado de un movimiento, ENTONCES la tarjeta DEBE volver a su etapa y el sistema DEBE avisar con «qué pasó + qué hacer» · cubre G-1 · prueba: `src/lib/board-move.test.ts`

## 8. Casos límite y errores
- **Falla el guardado:** CA-18.
- **Misma etapa:** CA-13.
- **Salir de la pantalla durante el deshacer:** CA-17.
- **Cambio concurrente por otra persona o por tiempo real:** CA-16; la tarjeta se recoloca sola con la actualización en vivo (**[Por verificar]** el comportamiento actual).
- **Quien no puede mover:** CA-5.
- **Lead que ya es oportunidad:** CA-7.
- **Etapas personalizadas por empresa:** el menú lista las de la empresa (CA-1) y las definiciones de §5 usan el tipo de etapa, no su nombre.
- **Etapa sin tarjetas:** sigue siendo destino de arrastre y de menú.
- **Otra empresa (multitenant):** mover solo afecta a datos de la empresa activa; sin cambios de política.
- **Deal ya Ganado que vuelve a una etapa abierta:** permitido como hoy; movimiento no reversible (CA-15).
- **Doble clic en un lead hacia «Oportunidad»:** podría crear dos deals. Queda **fuera de alcance**; **[Por verificar]** si ocurre hoy y se propone aparte si hace falta.

## 9. Experiencia y copy
- Textos de producto en español, «tú», sin iconos, estados con palabra. Propuestas, a aprobar por Fede (guía de voz de Nokko: **[Por verificar]**, no se ha revisado):
  - Menú: «Mover a…» y, al elegir, la etapa.
  - Aviso: «Movido a [etapa]» con botón «Deshacer».
  - Ganado: «Enviado a Aprobaciones: mover a Ganado requiere aprobación.» (ya existe).
  - Texto móvil bajo el tablero: «Desliza para ver las etapas. Usa «Mover a…» en cada tarjeta para cambiar su etapa.»
- Error: «qué pasó + qué hacer», vía el mecanismo actual de errores.

## 10. Datos, permisos y privacidad
- Sin tablas ni columnas nuevas. Permisos: no cambian (cualquier miembro con permiso de escritura mueve hoy; solo Owner, Sales Leader o Deal Desk aplican aprobaciones). Ningún dato de clientes en pruebas o capturas: datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Regla pura de movimiento (etapas, reversible o no, deshacer) y «Mover a…» **por menú** en Pipeline y Leads; el menú de Pipeline no ofrece «Ganado» hasta que se entregue el SDD de duplicados | CA-1 a CA-8, CA-13 a CA-19 por menú (CA-15 para todos los orígenes y destinos de la definición salvo los de Ganado) | `src/lib/board-move.test.ts`, `src/components/board-move.test.tsx`, `src/lib/board-move.pg.test.ts` |
| U-2 | Arrastre con ratón, táctil y teclado, y anuncio para lector de pantalla. La regla pura de U-1 es única; los CA por arrastre se prueban con el gesto simulado en `src/components/board-move.test.tsx` | CA-9 a CA-12 y, por arrastre, CA-2, CA-3, CA-5, CA-13, CA-14, CA-15, CA-16, CA-17, CA-18 | `src/components/board-move.test.tsx` y comprobación manual |

**Orden obligatorio:** primero se entrega `SDD-20261031-deal-won-duplicate-approvals`; después U-1 → U-2. Así ni el menú ni el arrastre accesible amplían el fallo de duplicados. Con ese SDD ya entregado, U-1 incluye «Ganado» en el menú y cierra CA-15 también para Ganado. Si Fede prefiere no esperar, U-1 y U-2 salen sin «Ganado» (ni menú ni arrastre accesible hacia Ganado) y se añade después.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- La lógica de «¿se puede mover, qué efecto tiene, es reversible?» conviene como función pura nueva (como `src/lib/stages.ts` y `src/lib/swipe.ts`), probada con datos ficticios; las pantallas solo la llaman.
- Reutilizar `move` de `deals.tsx` y de `leads.index.tsx` (mismas reglas que hoy) en vez de duplicarla.
- Arrastre accesible: una librería específica (p. ej. `dnd-kit`, que da ratón, táctil y teclado) frente a seguir con el arrastre nativo del navegador, que no sirve en táctil. **Dani valida** la elección; no está en `package.json` hoy.
- El menú de leads ya existe (`quick-actions.tsx:98-133`); ampliarlo con «Mover a…». Para Pipeline falta un menú equivalente.
- «Deshacer» como una escritura inversa (no como un cambio retrasado): el cambio se guarda al instante (CA-14, CA-17), distinto del mazo de Sugerencias, que retrasa el guardado. El plazo de 5 s sigue el precedente (`swipe-deck.tsx:13`).
- Guardar los valores previos en el propio aviso para restaurar exactamente lo anterior.

## 14. Riesgos y dependencias
- **Conflictos de edición** en `deals.tsx` y `leads.index.tsx` con el SDD `ux-legibility-contrast` (también toca ambos archivos). Orden recomendado: A primero.
- **Mismo `move` en deals** con el SDD `deal-won-duplicate-approvals`: ambos tocan `deals.tsx:59-74`. Orden recomendado: el de duplicados primero (es más pequeño y corrige un fallo activo) o coordinados.
- Arrastre con dedo y desplazamiento horizontal del tablero compiten (CA-11): si no se resuelve limpio, en táctil el menú es el camino principal y el arrastre se limita a ratón y teclado; se decide con Fede.
- «Deshacer» de un movimiento ya visto por otra persona por tiempo real puede sorprenderle. Mitigación: CA-16.
- Una librería nueva es una dependencia nueva (peso, mantenimiento): decisión de Dani.
- Hay otra carpeta de trabajo (`seller-strategy-studio-board-execute`) cuyo contenido **no se ha leído**; **[Por verificar]** que no solape con esto.

## 15. Preguntas para Fede y para la revisión técnica
1. ~~¿Descartado y Perdido sin «Deshacer»?~~ **Decidido por Fede (2026-10-31): sí, sin deshacer en la primera versión.**
2. ¿5 segundos para deshacer, como Sugerencias? Propuesta: sí.
3. Área táctil del menú en móvil: ¿44 px? (criterio de diseño; la guía WCAG 2.5.5 lo recomienda como nivel AAA, no es obligatorio; apuesta). Propuesta: sí en tarjetas y menú.
4. ¿Los textos de §9 son los que quieres (hay que cotejarlos con la guía de voz de Nokko)?
5. Para el gate: ¿qué librería de arrastre? ¿Mover y deshacer escriben historial de actividad, y quién lo lee? ¿Las etapas de lead son editables (si lo son, la definición de «reversible» se pasa a tipos)? ¿Deshacer debe comparar también la probabilidad por si se editó después?
6. ~~Base de trabajo~~ **Decidida por Fede (2026-10-31): `origin/main`.**

## 16. Pendiente de verificar
- Si «Descartado» y «Perdido» se pueden revertir sin dejar rastro erróneo (cierre, fechas, métricas).
- Campos que cambian en la base al mover (más allá de `closed_at` y `stage_entered_at`).
- Qué roles tienen hoy escritura sobre deals y leads (CA-5).
- Si la actualización en vivo recoloca tarjetas (CA-16).
- Comprobaciones **manuales** (no automatizables sin navegador): CA-4 (toque en móvil), CA-9, CA-11.
- Contenido y posible solape de `seller-strategy-studio-board-execute`.
- Guía de voz de Nokko para los textos de §9.
- Visual real a 375 y 1440 px (necesita sesión en la app; no hecho).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: PASS (`gate.mjs`, ticket NK-0051, commit 8ee3543f3b80; informe literal debajo)
- CA sin prueba posible o sin G-n: no revisado
- [Por verificar] que sigue sin comprobarse: ver §16
- Contradicciones con el código o con decisiones previas: no revisado
- Lo que esta revisión NO demuestra: el gate automático no evalúa los CA uno a uno, ni la app en vivo, ni claro/oscuro, táctil, Safari/Firefox ni lectores de pantalla; no hay segunda máquina ni soak (ver informe). La auditoría del 2026-10-31 (linter y revisores sin contexto, dos rondas) se hizo sobre la versión anterior, que incluía el arreglo de duplicados; esta versión recortada **no se ha vuelto a auditar**.

Informe del gate, sin editar:

```
PASS  clean tree on exact commit  8ee3543f3b80b0f6847f1ba1ae784a1735b52bee
PASS  canary: runner detects failure
PASS  guard: no `as any`
PASS  guard: no window.confirm/prompt
PASS  guard: no committed secrets
PASS  guard: no secret in VITE_ vars
PASS  guard: no .only/.skip in tests
PASS  guard: no raw error.message toasts
PASS  guard: .env untouched
PASS  guard: assertions not weakened
PASS  guard: no longer timeouts in tests
PASS  typecheck
PASS  lint (touched files, 75)
PASS  release build (outside network best-effort blocked)
PASS  full unit suite  2936/2936 passed; known failures 0; unexpected 0; files with no assertion run 0
PASS  touched test files, whole (10)
PASS  second-machine full run  NOT RUN: no second runner configured; canary + secret guard above are the local substitute
PASS  artifact size recorded  NOT A SOAK: file handles, memory and restarts are not measured here
PASS  extra: bunx vitest run src/lib/won-approval.pg.test.ts src/lib/board-move.pg.test.ts

VERDICT PASS on 8ee3543f3b80  evidence: /Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/.factory/evidence/NK-0051/8ee3543f3b80
```

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

---
Validación: pendiente. Versión recortada el 2026-10-31 (el arreglo de duplicados de «Ganado» pasó a `SDD-20261031-deal-won-duplicate-approvals`). Auditoría independiente de la versión recortada: «Bloqueado» (rama base, orden con el SDD de duplicados, cobertura de U-2). Se corrigieron orden y cobertura; decisiones de Fede del 2026-10-31 aplicadas (base `origin/main`, Descartado y Perdido sin deshacer). Quedan abiertos plazo de 5 s, área táctil, textos y varios menores para Dani. No hay tercera ronda ni gate.
