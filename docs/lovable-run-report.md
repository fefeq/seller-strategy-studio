# Informe final de F1–F11 — 13-11-2026

**Estado:** F1–F11 cerrado en el alcance autorizado. NK-0176 implementado y verificado en la entrega de abajo. Autorización general de Fede recibida el 13-11-2026 a las 14:08 UTC para continuar toda la cola sin aprobación SDD a SDD, conservando las paradas obligatorias. Este informe sustituye los balances parciales y bloqueos anteriores, no declara una certificación de producción.

## 1. Fusión comprobada
- Base verificada: `734c2026ab2be2312514b3ad491218c2dea6d13d`, idéntica al ref local `main`. El entorno usa una rama temporal `edit/…`; no cambié de rama ni hice operaciones de escritura de Git.
- `git merge-base --is-ancestor` devuelve 0 para `cc71f2a`, `5bbd0b7` y `734c202`. El historial incluye la fusión normal `d53d601` y PR #146 `734c202`.
- El diff de la fusión conserva el trabajo funcional de lovable-sync, `docs/decisiones-fede-20261113.md` y los PRD. Los documentos de decisiones/PRD se conservan frente al primer padre; frente al segundo se incorpora el documento de decisiones. Los conflictos documentales se consolidan en este cierre, sin mantener estados contradictorios.
- `session-cache.test.ts` no cambió entre `5bbd0b7` y la fusión. `399455e` cambió únicamente las dos expectativas nuevas de F4: rechazo → `null`, conservando las aserciones de ausencia de lecturas.
- `c363d4f` renombró la migración a `0088_onboarding_source_uuid_guard.sql` y cambió únicamente el tag de la última entrada del diario (idx 87); no renombró snapshots. El repo no contiene el nombre antiguo. No invoqué herramientas de creación de migraciones ni regeneré el diario: no se ha observado que reaparezca, pero no se garantiza el comportamiento de una futura generación.

## 2. Cierre por fallo
| Fallo | Resultado y evidencia |
|---|---|
| F1 | Drive propaga `originalLength` y `truncated`; prueba del job con 96.000 caracteres conserva 60.000 leídos y estado parcial. `onboarding-read-verification.test.ts`, `drive-read-verification.test.ts`. |
| F2 | Provisión explícita reproducible mediante API nativa, no SQL sobre esquema gestionado: `scripts/provision-onboarding-storage.ts`, `onboarding-storage.server.ts`, tres pruebas de creación/no sobrescritura/permisos. API en lugar de migración según el plan; no se ejecutó sobre el bucket existente. Auditoría real repetida debajo. |
| F3 | Pruebas nuevas PGlite con dos empresas y storage.objects simulado: aislamiento, autor, roles de precio, INSERT/UPDATE bloqueados y activación válida. Pruebas del job de referencias, escritura de estados y presupuesto; Drive simulado con carpeta ajena, 401/403, tamaño y vacío. Todas pasan en la suite. |
| F4 | `meQuery` devuelve `null` durante cierre al entrar, antes de aceptar invitaciones y antes de perfiles/miembros. `me-session-ending.test.ts`, `session-verification.test.tsx`, `session-cache.test.ts` y guardas de useSetup/useLivePipeline pasan. Cambio de usuario en vuelo conserva su rechazo específico. |
| F5 | Todos los archivos de producto permitidos del inventario `387febf → 3ee53f1` pasan `prettier --check`, repetido hoy. Cierre limitado por la prohibición de tocar pruebas existentes y autogenerados: no se formatearon ni se afirma lint global limpio. El formato se hizo como operación separada; el entorno no permite crear un commit de formato manual. No queda un cambio de formato permitido pendiente. |
| F6 | Los errores de referencias pasan por `errorText`; prueba evita persistir texto SQL crudo. |
| F7 | Notas de estado con `source: null`, excluidas del recuento de hallazgos. Prueba del job. |
| F8 | Quitar espera a la subida; fallo de remove conserva fila y avisa; límite compartido; fallidos no consumen cupo; progreso indeterminado sin porcentaje inventado. `sources-verification.test.tsx` y pruebas anteriores pasan; flujo real repetido hoy. |
| F9 | Migración 0088 con regex UUID estricto y vuelta atrás en cabecera. Definición real consultada coincide. Prueba PGlite de cadenas inválidas y `migrations-journal.test.ts` pasan; prefijo duplicado resuelto. |
| F10 | `parseSourceStatuses` valida el JSON persistido; la ruta usa el validador, no el cast inseguro. `source-status-verification.test.ts` pasa. |
| F11 | Descripción en src/lib/AGENTS.md distingue referencias nuevas de formatos legacy. Informe y roadmap consolidados. Snapshots históricos intactos: 0085_snapshot corresponde a 0086; 0086_snapshot a 0087_price_suggestions_and_blocked_plays_guard; 0087_snapshot a la entrada ahora llamada 0088. |

## 3. Verificación ejecutada sobre la base fusionada
- Node **22.23.5**, Bun 1.4.4; Node 26 **no ejecutado**.
- `oj typecheck -b --noEmit`: **exit 0**, sin errores. No ejecuté `tsc` literal: la instrucción del entorno exige el checker permitido. No presentar esta ejecución como un comando tsc.
- `bunx vitest run`: **333/333 archivos; 5570/5570 pruebas**, exit 0; duración 214,89 s. `factory-ledger.test.ts` pasa **15/15 dentro de la suite**, sin expiración ni repetición aislada necesaria. Hay avisos en stderr de pruebas de fallos simulados/React; no hubo pruebas fallidas.
- Formato: todos los archivos de producto permitidos del inventario pasan. No ejecuté lint global ni formateé pruebas/autogenerados.
- Compilación: el log de build automático no está disponible en esta sesión. El servidor supervisado registra reconstrucción y `client bundled (175 files)` de los cambios fusionados, y sirve /onboarding. No ejecuté build manual, prohibido por el entorno; no afirmo haber comprobado un build completo de producción.
- Navegador con sesión válida en `/onboarding`: **cuatro subidas y eliminaciones reales de TXT sintéticos**, 1280×1800 y 375×812, claro/oscuro. Cada fila pasó a «lista» y desapareció tras Quitar; cero errores de página, cero respuestas Storage >=400, sin scroll horizontal. Cuatro capturas inspeccionadas en `/tmp/browser/final-f1-f11/`, privadas por mostrar la sesión. No lancé lectura IA, no hubo envíos ni llamadas de pago.
- Evidencias de comandos en `/tmp/f1-f11-verification/` (temporales); el resumen persistente es este informe.

## 4. Auditoría real de Storage — solo lectura, repetida hoy
Bucket `onboarding-sources`: privado (`public=false`), límite **20971520 bytes**, `allowed_mime_types=null`. El bucket existente no restringe MIME; la provisión para uno nuevo sí limita PDF/TXT/MD/CSV y no sobrescribe configuración existente.

| Política | Operación | Rol | Condición |
|---|---|---|---|
| onboarding sources read | SELECT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,false) |
| onboarding sources upload | INSERT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |
| onboarding sources delete | DELETE | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |

Son las tres políticas del catálogo consultado; todas filtran bucket_id. La función real valida ambos segmentos UUID antes de convertir y comprueba pertenencia/autor. No modifiqué esquema, políticas ni configuración del bucket.

## 5. F12 y límites
**Decisión de Fede:** los documentos de `onboarding-sources` **nunca se borran automáticamente**. No existe una nueva retención por plazo, aprobación o lectura. Quitar un documento sintético fue una acción manual explícita de verificación, no limpieza automática. Retirada de un bucket requiere inventario y autorización explícita; no ejecutada.

No probado: Drive real Doc/Sheet/Slides/PDF, usuarios reales de otros roles, lectura con IA real, Node 26, build completo de producción y entorno nuevo aprovisionado. RLS/Drive indicados arriba son simulaciones, no estas verificaciones externas.

No se publicó ni desplegó. Torre de control GTM y Salida de Lovable intactas. No cambié pruebas, código funcional, migraciones ni snapshots en esta entrega documental. NK-0159, NK-0160 y el resto de la cola no iniciados. NK-0176 se presentó como SDD Borrador y Fede aprobó el plan durante esta sesión; su entrega se documenta debajo.

## Anexo: cambios de pruebas autorizados en una entrega anterior
Este registro histórico no autoriza nuevos cambios de pruebas.

## Reescritura autorizada de 4 pruebas de «Tus fuentes» (permiso de Fede, 13-11-2026)
Motivo común: la Fase 1 cambió la subida (cada archivo va al almacenamiento privado como referencia; Drive como referencia), y las pruebas esperaban archivos en memoria con un tope de 3. Mocks nuevos en esos dos archivos: cuenta con org/usuario, almacenamiento simulado que registra cada subida y un selector de Drive simulado.
1. sources.test.tsx «two files added one after the other are both listed»: se conservan todas las aserciones (dos PDF listados) → se añaden: cada uno se sube una vez a `org-1/user-1/…`, y un documento de Drive se suma a la lista sin sustituir los archivos (3 en total).
2. sources.test.tsx «adding the same file again does not list it twice»: se conserva «listado una sola vez» → se añaden: una sola subida, aviso exacto «Ya estaba en la lista: plan-negocio.pdf.», y en Drive el mismo id no se repite pero otro id con el mismo nombre sí entra. Cambio de producto necesario: como cada subida tiene ruta nueva, el mismo archivo elegido otra vez se reconoce por nombre (antes se habría subido y listado dos veces).
3. sources.test.tsx «past the limit…»: `MAX_FILES` (3) y selecciones de 3 → `MAX_SOURCES` (20) y selecciones de 5; se conservan «lo listado se queda», «se nombra lo que queda fuera» y «N documentos»; el filtro del texto «pendiente» → estados reales «subiendo/lista/error al subir»; se añade: lo que queda fuera nunca se sube.
4. sources-limit.test.tsx «one selection past the limit…»: aviso exacto antiguo «Una lectura admite hasta 3 documentos… súbelos a Drive…» → «Una lectura admite hasta 20 documentos entre archivos y Drive. Se quedan fuera: doc-21.pdf, doc-22.pdf. Quita alguno de la lista si quieres añadirlos.» (el antiguo era falso con el tope de 20); `MAX_FILES` → `MAX_SOURCES`; nombre «mergeFiles» → «mergeRefs» (la función real); se añade: solo se suben 20.
Nota: en la ronda anterior se añadió solo el stub `DriveRefButton` al mock de src/routes/_authenticated/-onboarding.test.tsx (sin tocar aserciones), necesario porque la Fase 1 importa ese componente.

## Entrega NK-0176 — aprobada y verificada, 13-11-2026
- Fede aprobó el plan y el SDD enlazado, incluidos únicamente tres cambios de expectativas y la verificación textual sin fail-first artificial.
- Cambios: dos cadenas de `BLOCKER_TEXT.linkedin_d2`; D2 cerrada en la fila de decisiones y exclusión del PRD. No se cambió catálogo, identificadores, activación, permisos ni herramientas.
- Pruebas protegidas: solo dos expectativas de label en `src/lib/plays/status.test.ts` y una en `src/lib/agent/tools/plays.test.ts`: «Bloqueado: falta una decisión de LinkedIn» → «Bloqueado: falta una integración con la API oficial de LinkedIn». Conservadas todas las aserciones de bloqueo, 28 plays, no escrituras y aislamiento. Ninguna otra prueba existente cambiada.
- Tres pruebas nuevas CA-1/2/3 en `src/lib/plays/linkedin-d2.test.ts`: pasan antes 3/3 y después. Son invariantes de regresión, no pruebas de copy ni fail-first.
- Checker `oj typecheck -b --noEmit`: exit 0. Node 22.23.5; Node 26 y tsc literal no ejecutados.
- Primera suite posterior sin limitar concurrencia: 331 archivos pasan, 3 fallan; 5555 pruebas pasan, 6 expiran y 12 se omiten por timeout del beforeAll. Expiraciones: cinco casos de factory-ledger (5 s), un caso de safe-logs-notes (5 s) y preparación de knowledge-rules-unique.pg (60 s). No se modificaron pruebas ni timeouts.
- Repetición de esos tres archivos con un worker: 32/32 pasan. **Suite completa repetida con `--maxWorkers=4`: 334/334 archivos y 5573/5573 pruebas**, exit 0, 478,68 s. Ninguna omitida. Factory-ledger pasa también en esta suite.
- Build automático: **build OK 2026-11-13T12:28:07Z**, posterior al cambio de producto. Build manual de producción no ejecutado.
- Navegador con sesión válida, `/plays`: seis tarjetas de LinkedIn con el nuevo bloqueo; activación deshabilitada y texto antiguo ausente. Escritorio 1280 y móvil 375, claro/oscuro; cuatro capturas de tarjeta inspeccionadas. Sin overflow horizontal ni errores de página. Se cargaron lecturas reales; no se activó ningún play, no se lanzó IA ni se hicieron envíos. La coherencia del asistente se comprueba por su prueba y estado compartido, no por una conversación IA real.
- Sin migraciones, publicación ni despliegue. F12 intacto; Torre de control GTM y Salida de Lovable intactas. Revisión técnica independiente del SDD no realizada, sin inventar un pase de gate. SDD permanece En curso hasta revisión/aceptación de la entrega por Fede.
- Informe emitido; NK-0159 y los siguientes SDD no iniciados en esta sesión.

## Autorización general y entrega NK-0159 — 13-11-2026, desde 14:08 UTC

La autorización permite guardar cada SDD y construir sin esperar confirmación entre entregas. No autoriza modificar pruebas existentes, llamadas de pago de verificación, publicación, despliegue, migración de empresas existentes ni correo real. La revisión independiente de NK-0176 no se inventa ni se marca realizada.

### Hecho y comprobado
- SDD: `docs/sdd/SDD-20261113-inngest-safe-autopilot-output.md`. Implementación mínima: dentro del callback `step.run("autopilot")`, después del notificador, retornar únicamente `researched`, `prepped`, `cooling` y `noteCount`. La salida final reutiliza ese resultado saneado. Ningún spread ni nota privada llega a esos dos resultados durables.
- Prueba nueva `src/lib/inngest/autopilot-output.test.ts`: ejecuta el callback real de mantenimiento con SDK, cliente y servicios simulados. Primero falló por la presencia del testigo sintético de error en la salida del paso y final; después pasa. Comprueba también que se conserva el resultado entregado al notificador y se rechazan propiedades extra en la salida persistida.
- Las cinco pruebas protegidas de `safe-logs-notes.test.ts` siguen intactas y pasan: los cores siguen retornando sus notas internas; se sanea la frontera de Inngest, no su contrato.
- Selección de cuatro archivos: 10/10 pruebas. Suite completa `bunx vitest run --maxWorkers=4`: **335/335 archivos y 5574/5574 pruebas**, exit 0, 279,80 segundos. Sin expiraciones ni pruebas omitidas. Node 22.23.5. Log temporal: `/tmp/queue-verification/nk0159-suite.log`.
- Compilación automática: última señal consultada `build OK`, 2026-11-13T14:10:08Z, posterior al cambio funcional. Ningún build manual ejecutado.
- Cero pruebas existentes modificadas; sin migraciones, proveedores reales, envíos, publicación, despliegue o operaciones Git de escritura. El entorno mantiene una rama temporal `edit/…`; no cambié de rama ni fusioné. Se añadió a AGENTS la regla técnica de proyección de salida durable.

### Hecho pero sin poder comprobar
- No ejecuté un checker manual: las instrucciones vigentes del entorno prohíben tanto typecheck como build manuales del proyecto. La señal de compilación automática está disponible, pero no expone un resultado separado del checker de tipos; **no se afirma typecheck limpio**. No ejecuté `tsc` ni Node 26.
- No ejecuté una función real de Inngest ni inspeccioné sus nuevos registros alojados: requiere desplegar el cambio, prohibido. La evidencia es el callback real con servicios simulados, no un historial real. El historial anterior no se borra.
- No hay superficie visual del resultado durable cambiado; no ejecuté una visita irrelevante en navegador como sustituto de su prueba. Escritorio/375 px y claro/oscuro no comprobados para esta entrega sin cambio visual.

### Parado / pendiente
- **Cierre de NK-0159:** bloqueo de tipos resuelto el 13-11-2026 a las 14:25 UTC con resultado externo de Claude comunicado por Fede: `main` 47b0f81, `tsc --noEmit` limpio, Node 22. Lovable no ejecutó ese comando. Inngest alojado sigue sin comprobar porque no se despliega.
- **Continuación:** Fede autoriza que la falta de checker local no detenga entregas posteriores; informar «tipos sin comprobar por restricción del entorno» y Fede los comprobará por lotes.
- Inspección previa de NK-0160: el escáner actual vive dentro de `server-log-scan.test.ts`, una prueba protegida; ampliarlo editando ese archivo está prohibido. No se ha editado ni declarado imposible una alternativa con guardas nuevas. El `console.warn` señalado de Sugerencias ya usa únicamente el nombre del error, no el objeto: comprobado en el código y en `log-hygiene-phase3.test.ts` (pasa).
- Inspección previa de NK-0177: `readTitles` ya filtra reglas de equipo en memoria y su prueba personal/equipo pasa. La expectativa protegida `play-diagnosis.test.ts`, caso «with every base rule present it adds none and says so», exige exactamente «Ya tenías todas las reglas base.» y ausencia de escrituras. No se cambió ni se inició una entrega de redacción que la contradiga.
- F12 permanece: los documentos de `onboarding-sources` nunca se borran automáticamente. Torre de control GTM y Salida de Lovable intactas.

## Entrega NK-0160 — 13-11-2026
- SDD `SDD-20261113-log-scan-title-carriers.md`: complemento AST local en `scripts/server-title-log-scan.ts`, no importado por el código servido. Detecta colecciones alimentadas solo por títulos/nombres, aliases y contenedores; permite longitud/estado y clasificación de errores. Guardia nueva recorre las fuentes de servidor y Sugerencias, devuelve solo ruta y línea, no texto fuente.
- Prueba primero: cinco casos nuevos fallaron por ausencia de detección. Después del cambio hubo tres falsos positivos en ai-gateway (contadores seguros); causa identificada: propagación desde la respuesta entera hacia status. Se corrigió permitiendo la proyección de status, sin tocar producto ni pruebas existentes. Selección final 26/26.
- Suite completa: **336/336 archivos, 5584/5584 pruebas**, exit 0, 261,90 s, cuatro workers. Sin expiraciones ni omitidas. Log temporal `/tmp/queue-verification/nk0160-suite.log`.
- Compilación automática `build OK` 2026-11-13T14:26:45Z. **Tipos sin comprobar por restricción del entorno**, pendiente del lote de Fede. Node 26 no ejecutado.
- El escáner protegido y todas las pruebas existentes permanecen intactos. Sugerencias ya clasificaba el error por nombre y no registraba el objeto: sin cambio de interfaz ni navegador ajeno para suplir una prueba estática. No hay flujo visual cambiado.
- Límite: análisis por nombres dentro de un archivo, no interprocedimental, sin garantía de detección total de datos privados. No envíos, pagos, migraciones, publicación ni despliegue. Informe emitido antes de NK-0177.

## Entrega NK-0177 — 13-11-2026
- SDD `SDD-20261113-default-rules-team-query.md`. Se añadió filtro `scope=team` en la consulta compartida por diagnóstico y creación de reglas. Se conserva el filtro en memoria, la comparación de títulos, los errores y las notas de reglas personales. El filtro evita que las reglas personales consuman la ventana de lectura de reglas del equipo.
- Prueba nueva falló primero por ausencia del filtro; después comprueba nueve reglas personales y creación de nueve reglas de equipo sin sobrescribirlas. Selección de cuatro archivos: **90/90 pruebas**, incluidas las 62 protegidas de herramientas de diagnóstico. Todas las pruebas existentes intactas.
- Suite completa: **337/337 archivos, 5585/5585 pruebas**, exit 0, 242,97 s, cuatro workers. Sin expiraciones ni omitidas. Log temporal `/tmp/queue-verification/nk0177-suite.log`.
- Compilación automática OK 2026-11-13T14:32:11Z, posterior al filtro. **Tipos sin comprobar por restricción del entorno**, pendiente del lote de Fede. No navegador: no cambió ninguna superficie visual; núcleo probado con cliente simulado. No conversación IA real ni creación de reglas reales.
- «Ya tenías todas las reglas base.» se conserva: la prueba protegida exige ese contrato y solo se produce cuando las reglas del equipo están completas. No fue necesario cambiarla para corregir el comportamiento. No migraciones, pagos, envíos, publicación ni despliegue. Informe emitido antes del Bloque B; revisión independiente pendiente.

## Parada compartida del Bloque B — requisito de redacción de SDD
- Los cinco PRD del Bloque B exigen redactar sus SDD con `nokko-shape`. La habilidad no está activa en este entorno: `.workspace/skills` solo contiene `b2b-saas-ux-expert` y `geo-aeo-optimizer`. La copia encontrada en el repositorio es un borrador, no una habilidad activa; las instrucciones de la plataforma prohíben ejecutarla como si estuviera activada.
- No se reabren las decisiones de Fede ni se confunde el Estado Borrador histórico de los PRD con falta de aprobación: el documento de decisiones ya los aprobó. Lo que falta es la habilidad activa exigida para redactar, o autorización expresa de Fede para usar la plantilla del repositorio sin ejecutarla. Esta parada afecta a todas las iniciativas restantes, no solo NK-0173; no se ha empezado implementación del Bloque B.
- Primera investigación de NK-0173 sin gasto: documentación oficial pública de Apollo consultada (`https://docs.apollo.io/docs/enrich-people-data`, `https://docs.apollo.io/reference/get-complete-person-info`, `https://docs.apollo.io/reference/people-enrichment`, `https://knowledge.apollo.io/hc/en-us/articles/4423314404621-Understand-Email-Statuses`). El endpoint show enumera verified/extrapolated/unavailable, pero no demuestra que bulk_match tenga exactamente esos mismos valores. No se hizo una llamada de pago, no se inventó mapeo ni se añadió esquema. No se redactó SDD 2b.
- F12, Torre de control GTM y Salida de Lovable siguen intactos. Ningún trabajo continúa automáticamente después del turno.
