# Revisión de coherencia entre los SDD del Sprint 1 (2026-11-06)

> **Renumeración (2026-11-08):** al sincronizar con `main`, los tickets del sprint pasaron a la numeración de `main`: A = NK-0068, B = NK-0067, D = NK-0076, C1 = NK-0077, C2 = NK-0078 (ampliaciones de NK-0051, ya entregado en PR #91), bug falso rechazado = NK-0079, seguimientos y Sprint 2 = NK-0080 a NK-0086. El informe de abajo es copia literal y conservan la antigua (NK-0066→0079, 0067→0068, 0068→0067, 0069→0076, 0070…0075→0080…0085). Ramas, briefs y evidencias anteriores conservan los nombres de rama originales.


Revisión independiente (`nokko-gate`) de A, B, C1, C2 y D juntos. Copiada sin editar. Sus dos bloqueantes se corrigen en D v4 (dependencia de B, rutas de `/hub`, texto de la casilla ≤ 135 caracteres) y en el contrato común de los cinco SDD.

- Veredicto del gate (coherencia entre SDD): Objeciones
- SDD afectados: SDD-D `SDD-20261106-agent-rules-reader` (las dos bloqueantes), SDD-C2 `SDD-20261106-ux-metrics-data-state` (bloqueante 2 y notas), SDD-B `SDD-20261106-hub-search`, SDD-C1 `SDD-20261106-ux-core-screens-pattern` y SDD-A `SDD-20261106-metrics-honest-data` (solo notas). También las enmiendas al PRD de GTM Lab y al SDD 5a (solo notas).
- CA sin prueba posible o sin G-n: ninguno imposible de probar. Sin PRD propio no exijo G-n; el CA-38 de 5a sí lo trae (G-7) y tiene archivo de prueba. Hay tres partes que solo se comprueban a mano:
  - B CA-0: que la ruta solo conserve `validateSearch`, `head` y `component` se ve en el diff.
  - D CA-6, parte de pantalla: solo walkthrough (U-4).
  - C2 CA-1: teclado y móvil, en el walkthrough.
- [Por verificar] que sigue sin comprobarse:
  - Los ids de sección de `/hub` y `/theory-u`: siguen pendientes de Fede (C1 §15.1, B §15.6) y de ellos dependen C1 CA-3 y B CA-6 y §8.
  - El umbral de 160 caracteres de C2 (§15.1): sin decidir.
  - Que los tests de componente de A sigan pasando cuando C1 ponga `ScreenState` y haga lanzar las consultas de esos paneles. Esos tests aún no existen.
  - Que las llamadas de A a `DataMark` compilen con el tipo más estricto de `DataState` (C2 exige `reason` en «Estimado» y «Sin dato»; A lo deja opcional).
  - Que el recuento L de N que D pinta en `/hub` salga igual que lo que lee el agente. En `/hub` la lista incluye documentos personales del usuario y puede llegar cortada (`truncated` de B).
  - Datos de producción: deals sin `closed_at`, `source` o `segment_id` (A); `max_rows` (B); número y longitud de las reglas (D).
  - Radix Tabs controladas desde la URL en jsdom (C1).
- Contradicciones con el código o con decisiones previas:
  - D da por hecho el `hub.tsx` de `f76f639` y pone «Depende de: —». Choca con el orden decidido A → B → C1 → D → C2, porque B ya habrá movido la pantalla (bloqueante 1).
  - D, línea 8, dice que la decisión de Fede «no está registrada aún en `docs/`». Ya lo está en el PRD, A-3 (enmienda aplicada).
  - D §5 dice «No incluye: editar el PRD o el SDD 5a (solo textos propuestos)», y D §15.5 dice que esas enmiendas ya están «aplicadas».
  - C1 U-5 dice «hoy no aparece nada» con `quotas` en error. Es falso (lo señaló su tercera pasada): la página se pinta igual con `quotas = []`, aunque el test sigue fallando primero.
- Lo que esta revisión NO demuestra:
  - No ejecuté tests, build ni `scripts/factory/gate.mjs`. Es un cambio solo de documentación y no hay `node_modules`.
  - No volví a comprobar todas las citas archivo:línea de cada SDD. Solo las de `hub.tsx:28-37`, `:125-135` y `:155-170`, y la de `metrics.tsx:283-300`.
  - El cálculo de 181 caracteres visibles de la bloqueante 2 es mío: aplica el método de C2 §3 sobre el texto literal (24 + 1 + 156). No ejecuté su script.
  - De los informes del gate anteriores dentro de A y C1 solo leí partes.
  - No consulté el ledger, datos de producción ni el navegador.
  - Que el texto del contrato sea idéntico lo comprobé con md5 sobre la frase. No lo comprobé en el resto del documento.

**Objeciones bloqueantes**

1. **D da por hecho un `hub.tsx` que B ya habrá cambiado de sitio y de forma de datos.**
   - Evidencia:
     - D:5 pone «Depende de: —».
     - D:10 (contrato) dice «D toca hub.tsx … (hub.tsx:163)».
     - D:20 y D:100 (U-4) citan `hub.tsx:35`, `:129` y `:163`.
     - B:107 (U-0) y B:115 dicen que, tras B, esos textos viven en `src/components/hub/hub-screen.tsx` (`SECTIONS`) y en `src/components/hub/doc-editor.tsx` (la casilla).
     - B:120 cambia la caché `["docs"]` a `{ rows, truncated }`, y B:127 avisa de que C1 y D deben reescribir sus referencias.
     - C1:9 sí lleva ese aviso; D no.
     - El aviso «El agente lee {L} de {N} reglas…» de D CA-6 necesita leer los documentos en pantalla. D no dice de dónde los saca, ni que debe usar `rows` y filtrar `scope = 'team'`, ni qué hacer si `truncated` es verdadero, ni que tras C1 va dentro de `ScreenState`.
   - Corrección:
     - En la cabecera de D: «Depende de: B (mueve `/hub` y cambia la caché `["docs"]`); se integra después de C1».
     - Añadir a D la misma nota de números de línea que lleva C1:9.
     - U-4 trabaja sobre `hub-screen.tsx` y `doc-editor.tsx`. N y L salen de `data.rows`, con solo las reglas de equipo. Si `truncated`, decir que N puede estar incompleto o no mostrar el aviso. El aviso solo aparece tras responder la consulta.
     - Añadir a `src/components/hub/hub-screen.test.tsx` un caso con L < N.
     - Cambiar el contrato en los cinco SDD, con el mismo texto: «D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio»». La etiqueta pasa a «el mismo texto en A, B, C1, C2 y D».

2. **El texto nuevo de la casilla que pone D rompe la lista cerrada de C2.**
   - Evidencia:
     - El bloque `hub.tsx:161-164` mide hoy 146 caracteres visibles (C2:38; lo reproduje: 24 + 1 + 121).
     - El texto de D U-4 (D:100) mide 156, así que el bloque pasa a unos 181, por encima del umbral de 160.
     - C2 §4 da 0 bloques en `/hub`, C2 §5 excluye `src/components/hub/*` y la lista del §9 no lo incluye. Su U-1 se parará de forma segura y se lo llevará a Fede (C2:135).
     - Además, el texto de D empieza con mayúscula («El agente…») tras el prefijo «Todo lo de Reglas lo es: » (`hub.tsx:163`).
   - Corrección: decidirlo antes del brief.
     - Opción (a): D acorta la frase a 135 caracteres o menos, y da el texto de las dos ramas (con y sin el prefijo de Reglas).
     - Opción (b): C2 añade un X-13 en `/hub`, quita la exclusión de `src/components/hub/*` y actualiza el §4 (línea base 13).

**Notas para el brief**

1. **El contrato es idéntico en los cinco** (mismo md5 de la frase).
   - Diferencias de forma: A y C2 lo ponen entre «…»; D lo titula «Contrato del sprint» y no se incluye a sí mismo en la etiqueta.
   - No nombra trabajo que sí está en los SDD, aunque sin choque de archivos:
     - las pistas enlazadas de `/metrics` y la extracción a `performance-panels.tsx` (A);
     - la extracción de `/hub` y el paso a `fetchAll` (B);
     - la extracción de Theory U a `theory-u-screen.tsx` (C1);
     - el lector del agente (D).
   - El reparto de los vacíos de `/metrics` entre A (con trimestre) y C1 (carga y error) solo lo explica A §13 («Aplicación del contrato»). C1 §5 es compatible con él.
2. **Archivos y símbolos compartidos que resuelve el orden** (sin acción):
   - `src/components/metrics/data-mark.tsx` y `src/test/data-marks.ts`: los crea A y los amplía C2.
   - `src/components/hub/hub-screen.test.tsx`: lo crea B y lo amplía C1.
   - `validateSearch` de `/hub`: B añade `q` y C1 añade `seccion`.
   - `ScreenState` va en `page.tsx` (C1) y `DataState` en su propio archivo (C2), así que no chocan.
   - Riesgo: B (`src/lib/hub-search.ts`) y C1 (`src/lib/screen-sections.ts`) calculan cada uno la búsqueda siguiente de `/hub`. El brief de C1 debe reutilizar o componer la de B, para que conservar `q` y quitar `doc` estén en un solo sitio.
3. **Pulsar una sección con búsqueda activa sigue sin definir.** B §8 dice que la sección «sigue marcada» y C1 CA-3 conserva `q`. Con búsqueda la lista muestra todas las secciones, así que el clic no cambia la lista. Hay que fijarlo (nota 4 de la tercera pasada de B, abierta).
4. **C2 cambia el tipo de las props de `DataMark`.** Dice «sin cambiar sus props» (C2:122, :126), pero su tipo exige `reason` donde A lo deja opcional (A §13). El brief de C2 debe comprobar que compila (`tsc`) sin tocar archivos de A.
5. **Ventanas frente a marcas.** C2:58 dice que «Últimos 365 días», «Todo el histórico · no depende del trimestre» y «Últimas 12 semanas · no depende del trimestre» no llevan `data-mark`. A CA-10 no lo dice, y el regex de A rechazaría esas frases si se pintaran como marca. Hay que escribirlo en el brief de A.
6. **`Kpi`, `Panel`, `Bar` y `Muted` pasan a `performance-panels.tsx` (A).** El SDD de legibilidad (citado en C1:5) los quiere en `page.tsx`. Es un conflicto de archivo fuera del sprint: anotarlo.
7. **C1 §13 nombra solo 3 de los tests de A.** El brief debe exigir que los tests de A y de B pasen sin cambios (`git diff` vacío en sus archivos de test), como hace C2 en su U-1.
8. **Palabras de producto.**
   - A usa dos variantes a propósito: «Estimado · N de M deals asignados por importe» (Cobertura) y «Estimado · N de M asignados por importe» (CAC real y Presupuesto por segmento). Es correcto, pero el brief debe copiarlas literalmente.
   - «Sin origen» es coherente: solo lo usa A, igual que `revops-panels.tsx:9`.
   - Los «Sin dato · …» y los vacíos con trimestre solo los define A; C1 y C2 no los repiten ni los contradicen.
   - D se contradice a sí mismo en dos textos:
     - §6 dice «El agente lee {L} de {N} reglas (las más recientes)…» y CA-6 dice «… reglas completas…». Manda el del CA.
     - §6 dice «seguimientos y briefs de reunión» y U-4 dice «seguimientos y preparaciones de reunión». Hay que elegir uno, teniendo en cuenta el glosario: «Preparación de llamada».
9. **D, citas desfasadas.** La línea 8 (decisión «no registrada») y el §5 frente al §15.5 (enmiendas «propuestas» o «aplicadas») hay que alinearlos con el estado real. Las citas `PRD:133` y `5a:80` valen en `f76f639`, pero en esta rama son `:134` y `:82`.
10. **Enmiendas al PRD y a 5a: coherentes con D.**
    - Están A-3 bloqueado, la pieza 8 con el inventario de `bmad/`, la fila 5a de §6.2, §7 y la pieza 2.
    - El CA-38 de 5a cita D CA-1a a CA-4 y la prueba `agent-modes.test.ts`.
    - Matices:
      - El CA-38 aplicado dice «modos y canales», y el texto propuesto en D §15.5 solo «modos». Es inocuo, pero no es literal.
      - El CA-38 no lleva la guardia «MIENTRAS la fase esté activa», a diferencia de CA-18. No choca con CA-6, porque el «agente actual» ya llevará el bloque tras D. Conviene decirlo en una línea.
      - PRD §7 exige pasar las enmiendas por el gate. Lo cubre la segunda pasada de D (aplicadas en `014ae3d`), pero D y C2 no tienen tercera pasada.
11. **Para que `/hub` pueda calcular L de N** (bloqueante 1), `src/lib/knowledge-rules.ts` debe poder importarse desde el cliente, sin nada `.server`, o exponer la parte pura aparte. D §13 no lo dice.
12. **Estado de los documentos.** A está aprobado; B, C1, C2 y D siguen en «Borrador». C2 §17 empieza con «No revisado» aunque luego incluye la segunda pasada, y C2 §3 cita «SDD-A v3» cuando A ya va por la v4 (que no afecta a C2).
