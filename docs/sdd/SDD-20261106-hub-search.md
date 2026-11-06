# SDD-20261106-hub-search · [Mejora] Buscar en Conocimiento

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 (SDD-C de este sprint toca `src/routes/_authenticated/hub.tsx`), NK-0053 (`SDD-20261030-gtm-control-tower-5a-agent-memory`, toca `memory.tsx`)

> Sprint 1 de mejoras en pantallas core, bloque B. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).

## 1. Resumen
Conocimiento (`/hub`) no tiene buscador: para encontrar un documento hay que adivinar su sección y recorrer la lista. Se añade una caja de búsqueda que encuentra documentos por título y contenido en las siete secciones a la vez, sin distinguir mayúsculas ni acentos, y que se puede compartir por URL. Sin IA, sin esquema nuevo y sin consultas nuevas.

## 2. Problema y para quién
Cualquier persona del equipo que busca una respuesta a una objeción, un playbook o una regla y no recuerda dónde está guardada.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`:
- `src/routes/_authenticated/hub.tsx:58-62`: carga todos los `knowledge_docs` visibles (`select("*")`, sin paginar) y filtra solo por sección.
- `hub.tsx:28-36`: siete secciones (`company`, `objections`, `playbooks`, `methodology`, `campaigns`, `skills`, `rules`) en una constante local; `DRIVE_TAB` (`:39`) es otra pestaña que no son documentos de Conocimiento.
- `hub.tsx:23`: la URL ya admite `?doc=`; no admite búsqueda.
- `hub.tsx:132`, `:138`: estados vacíos con `Empty` (`src/components/page`).
- `src/lib/match.ts:69`: la normalización sin acentos (`normalize("NFD")` + quitar diacríticos + minúsculas) existe, pero como función local no exportada.
- `src/routes/_authenticated/memory.tsx:37-40`: patrón de filtro en cliente con `useMemo`, pero con `toLowerCase()` sin quitar acentos: buscar «estrategia» no encuentra «Estratégia» mal escrita, y buscar «decision» no encuentra «decisión».
- El buscador global (⌘K, `src/components/command-palette.tsx`) no busca en `knowledge_docs` (sin coincidencias de esa tabla en el archivo).
- Número de documentos por empresa: sin dato. [Por verificar] si PostgREST corta la respuesta en 1000 filas en este proyecto: si es así, con más de 1000 documentos la lista y la búsqueda serían incompletas sin aviso.

## 4. Resultado buscado
- Encontrar un documento sin saber su sección. Línea base: imposible hoy (no hay búsqueda). Tiempo o frecuencia de búsqueda: sin dato.

## 5. Alcance
**Incluye:**
- Caja de búsqueda en `/hub` sobre título y contenido de los documentos de las 7 secciones.
- Normalización sin acentos ni mayúsculas, compartida y probada.
- `?q=` en la URL.
- Recuento de coincidencias por sección mientras hay búsqueda.
- Fragmento del contenido alrededor de la coincidencia.

**No incluye:**
- Búsqueda semántica o con IA, ranking por relevancia más allá de «título antes que contenido».
- Buscar en «Drive por cuenta».
- Añadir Conocimiento al buscador global ⌘K.
- Cambiar el filtro de `/memory` (lo toca NK-0053; ver §15).
- Paginación o búsqueda en servidor.
- Estilo visual de la pantalla (NK-0051, SDD-C).
- Esquema, RLS, migraciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** caja «Buscar en Conocimiento»; parámetro `?q=`; fragmento del contenido; estado vacío de búsqueda; función compartida de normalización y coincidencia.
**Modificado:** con búsqueda activa, la lista muestra coincidencias de todas las secciones, cada una con el nombre de su sección, y el número junto a cada sección pasa de «documentos de la sección» a «coincidencias en la sección». Sin búsqueda, todo igual que hoy.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como miembro del equipo, quiero buscar en todo Conocimiento, para encontrar un documento sin saber dónde está.
- **CA-1** Al escribir un texto, la lista muestra los documentos de cualquiera de las 7 secciones cuyo título o contenido lo contiene, sin distinguir mayúsculas ni acentos («decision» encuentra «Decisión»). · prueba: `src/lib/text-search.test.ts`
- **CA-2** Los resultados con coincidencia en el título van antes que los que solo coinciden en el contenido; dentro de cada grupo, el orden actual (`updated_at` descendente). · prueba: `src/lib/text-search.test.ts`
- **CA-3** Cada resultado muestra el nombre de su sección y, si la coincidencia está en el contenido, un fragmento de hasta 120 caracteres alrededor de ella. · prueba: `src/lib/text-search.test.ts`
- **CA-4** Con búsqueda activa, el número junto a cada sección es el de coincidencias en esa sección; al vaciar la caja, vuelve al total de documentos. · prueba: `src/routes/_authenticated/hub.test.tsx`
- **CA-5** Sin coincidencias, la pantalla dice «Nada coincide con «{texto}». Prueba con otra palabra o crea un documento con «+ Nuevo».» · prueba: `src/routes/_authenticated/hub.test.tsx`

### H-2: Como miembro del equipo, quiero compartir una búsqueda, para enviar a un compañero lo que encontré.
- **CA-6** El texto se refleja en `?q=` y al abrir `/hub?q=texto` la búsqueda aparece ya aplicada; `?doc=` sigue funcionando junto a `?q=`. · prueba: `src/routes/_authenticated/hub.test.tsx`
- **CA-7** Escape o el botón «Borrar búsqueda» vacían la caja y quitan `?q=`. · prueba: `src/routes/_authenticated/hub.test.tsx`

### H-3: Como responsable de la pantalla, quiero una sola regla de normalización, para que dos buscadores no den resultados distintos.
- **CA-8** `src/lib/match.ts` y la búsqueda de Conocimiento usan la misma función exportada de normalización, y los tests existentes de `match.ts` pasan sin cambios. · prueba: `src/lib/match.test.ts` (existente) y `src/lib/text-search.test.ts`

## 8. Casos límite y errores
- Texto de solo espacios: no hay búsqueda.
- Texto de un carácter: busca (la lista es local, coste nulo). [Sugerencia] si el gate ve un problema de rendimiento con muchos documentos, mínimo 2 caracteres.
- Caracteres especiales de expresión regular («C++», «(beta)»): coincidencia literal, nunca expresión regular. Se cubre en CA-1.
- Documento personal de otra persona: no llega al cliente (RLS actual); la búsqueda no cambia la consulta.
- Documento seleccionado que deja de coincidir: el editor sigue abierto; la lista no lo muestra.
- Pestaña «Drive por cuenta» con búsqueda: la caja se oculta en esa pestaña.
- Más de 1000 documentos: ver [Por verificar] en §3 y §16.

## 9. Experiencia y copy
- Placeholder: «Buscar en Conocimiento». Botón: «Borrar búsqueda». Vacío: CA-5. Etiqueta accesible del campo: «Buscar en Conocimiento».
- Español, «tú», sin iconos en el texto.
- Posición: encima de las secciones, a lo ancho de la columna izquierda en escritorio y de la pantalla en móvil. El estilo lo fija SDD-C.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Misma consulta (`hub.tsx:60`). El texto buscado no se guarda ni se envía a ningún servicio (solo vive en la URL). Tests con documentos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `foldText` exportada (sale de `match.ts:69`) y `searchDocs` pura en `src/lib/text-search.ts` (coincidencia literal, orden, fragmento) | CA-1, CA-2, CA-3, CA-8 | `src/lib/text-search.test.ts` |
| U-2 | Caja, `?q=`, recuentos, estado vacío y Escape en `hub.tsx` | CA-4, CA-5, CA-6, CA-7 | `src/routes/_authenticated/hub.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Mover el cuerpo de `plain` de `match.ts:69` a una función exportada (`foldText`) y que `match.ts` la importe. Sin cambio de comportamiento (CA-8).
- `searchDocs(docs, q)` devuelve `{ doc, inTitle, snippet }[]`; `hub.tsx` solo la llama dentro de `useMemo`. Coincidencia con `includes` sobre texto normalizado, no `RegExp`.
- Fragmento: posición sobre el texto normalizado, recorte sobre el original. Con NFD los índices pueden desplazarse si hay caracteres compuestos; normalizar a NFC antes de buscar o calcular el índice carácter a carácter. El gate lo comprueba con un caso de prueba.
- `validateSearch` de `hub.tsx:23` pasa a `{ doc?: string; q?: string }`. Escribir en la URL con `navigate({ search, replace: true })` para no llenar el historial.
- Colisión con SDD-C (NK-0051) en `hub.tsx`: contrato igual que en SDD-A: B cambia comportamiento y textos; C cambia clases y estructura visual. Orden propuesto: B antes que C.
- No hay `hub.test.tsx` hoy [Por verificar con `ls`]: si no existe el entorno de render de componentes en rutas, U-2 puede probar la lógica de URL y recuentos como función pura y dejar la interacción al walkthrough.

## 14. Riesgos y dependencias
- Rendimiento con muchos documentos largos: la búsqueda recorre los cuerpos en cada pulsación. Mitigación: `useMemo` y texto normalizado calculado una vez por carga. Sin dato de tamaño real.
- El límite de 1000 filas, si aplica, ya afecta hoy a la lista; la búsqueda lo hace más visible.

## 15. Preguntas para Fede y para la revisión técnica
1. **`/memory`:** tiene el mismo problema de acentos (`memory.tsx:39`). ¿Lo añado a NK-0053 (que ya toca `memory.tsx`) o va en este SDD como una línea más?
2. **Buscador global ⌘K:** ¿quieres que Conocimiento aparezca ahí en un paso posterior?
3. ¿Búsqueda también en «Drive por cuenta», más adelante?

## 16. Pendiente de verificar
- Límite de filas de PostgREST en el proyecto (configuración de Supabase/Lovable Cloud) y número real de documentos por empresa: producción.
- Existencia de un entorno de test de componentes de ruta: el gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
