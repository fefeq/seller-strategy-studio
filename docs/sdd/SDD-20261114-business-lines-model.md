# SDD-20261114-business-lines-model · [Feature] Modelo de líneas de negocio

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-14
**PRD:** docs/prd/PRD-20261113-onboarding-lineas-de-negocio.md · **Depende de:** —

## 1. Resumen
Definir líneas de negocio completas por empresa, con una principal y un máximo de cuatro. Conservar diagnósticos personales existentes. La copia de datos queda expresamente detenida hasta que Fede vea los cuatro conteos y la autorice.

## 2. Problema y para quién
Owner y Sales Leader necesitan representar negocios distintos sin promediar modelo, ticket, adopción ni etapa (PRD G-1).

## 3. Evidencia y por qué ahora
Decisiones vinculantes: docs/decisiones-fede-20261113.md, NK-0167; autorización general de la cola en roadmap.md. El Estado Borrador del PRD es histórico: la aprobación consta en el documento de decisiones. Reglas vigentes leídas en src/lib/gtm-diagnosis.ts; no se cambian sus umbrales ni vocabularios de motion.

Conteos agregados de solo lectura realizados el 14-11-2026 sobre la base compartida, sin exportar nombres, ids ni tickets individuales:

| Conteo | Resultado |
|---|---:|
| (a) Empresas con inputs distintos entre sesiones con diagnóstico, excluidos superadmins ajenos | 0 |
| (b) Sesiones con diagnóstico y ticket cero | 0 |
| (b) Sesiones con input ausente o inválido, incluido ticket cero | 0 |
| (c) Empresas con diagnóstico válido, excluidos superadmins ajenos | 1 |
| (d) Sesiones de superadmins con diagnóstico en empresas que no crearon | 0 |
| (d) Empresas de ese conjunto que quedarían sin línea | 0 |

Ticket cero por modelo: no hay filas. PostgreSQL real: 17.11. Los conteos son una instantánea, no predicen el estado al ejecutar la copia. Se usó la base compartida en lectura porque la autorización de continuidad permite expresamente estos cuatro conteos; no se creó una copia ni se cambió ningún dato.

## 4. Resultado buscado
PRD G-1: líneas completas y separadas; G-5: tantas empresas copiadas como empresas válidas elegibles al ejecutar. Línea base actual: 1 empresa elegible; uso de múltiples líneas todavía sin dato.

## 5. Alcance
**Incluye:** reglas puras, esquema aditivo, permisos, integridad de principal/tope, enlace con segmentos, RPC de principal y borrado, catálogo de campos, pruebas nuevas y procedimiento repetible de copia autorizado aparte.
**No incluye:** interfaz, consumidores, agente/MCP, IA, borrado de diagnósticos antiguos, copia sin permiso, publicación, despliegue, fusión ni modificación de pruebas existentes.

## 6. Cambios de comportamiento (delta)
**Añadido:** almacenamiento por empresa de las cuatro respuestas de cada línea; primera línea principal por defecto.
**Modificado:** ninguno de los consumidores actuales en esta entrega.
**Eliminado:** nada. Las sesiones y sus diagnósticos permanecen intactos.

## 7. Historias y criterios de aceptación
### H-1: Como líder, quiero guardar cada negocio completo.
- **CA-1** Modelo b2b/b2c/marketplace, adopción self_serve/committee, etapa idea/early/scale y ticket numérico finito >0; rechazo de 0 y entrada incompleta para los tres modelos · G-1 · prueba nueva: src/lib/business-lines.test.ts.
- **CA-2** Como máximo cuatro líneas por empresa; una quinta o inserción múltiple que exceda cuatro falla; org_id inmutable · G-1 · prueba nueva: src/lib/business-lines.pg.test.ts.
- **CA-3** Exactamente una principal cuando existen líneas; la RPC cambia principal atómicamente · G-1 · prueba nueva: src/lib/business-lines.pg.test.ts.
### H-2: Como Owner, quiero quitar líneas sin dejar una principal inválida.
- **CA-4** Miembros leen; Owner y Sales Leader añaden/editan; solo Owner quita; la RPC rechaza quitar la última y promueve la siguiente al quitar la principal; denegación o cero filas nunca se presenta como éxito · G-1 · prueba nueva: src/lib/business-lines.pg.test.ts.
- **CA-5** El enlace segmento–línea rechaza empresa distinta y org_id nulo con línea no nula; al borrar línea solo se limpia business_line_id · G-1 · prueba nueva: src/lib/business-lines.pg.test.ts.
### H-3: Como Owner, quiero conservar el diagnóstico existente.
- **CA-6** La selección excluye superadmins ajenos, prioriza Owner válido más reciente, después cualquier sesión válida más reciente; desempate por id; input inválido o ticket cero no genera línea · G-5 · prueba nueva: src/lib/business-lines-copy.pg.test.ts.
- **CA-7** Copia repetible: crea solo si no hay líneas, refresca únicamente origin=migrated no editada; cualquier edición normal pasa origin a user, incluida principal; nunca toca sesiones ni líneas user · G-5 · prueba nueva: src/lib/business-lines-copy.pg.test.ts.
- **CA-8** Una sola línea conserva archetypeOf/diagnose y no mezcla los tres vocabularios motion · G-1 · prueba nueva: src/lib/business-lines.test.ts.

## 8. Casos límite y errores
Empresa sin líneas sigue siendo válida. Borrado en cascada de empresa no se bloquea. La última línea se protege en RPC/UI, no en trigger. Serializar operaciones por empresa antes del conteo; comprobar concurrencia con dos conexiones reales de prueba sin tocar datos compartidos. RLS puede devolver cero filas sin error: exigir comprobación explícita. Ningún fixture usa datos reales.

## 9. Experiencia y copy
Sin pantalla nueva en SDD 1. Errores reutilizan errorText: «Completa el ticket de tu línea», «Solo el Owner puede quitar líneas» y «Puedes guardar hasta cuatro líneas». Iconos solo con texto según decisiones actuales; no se aplica la frase histórica «sin iconos» de la plantilla.

## 10. Datos, permisos y privacidad
business_lines: id, org_id DEFAULT current_org(), model, acv, friction, stage, name opcional, is_primary, position, origin, created_at, updated_at. GRANT antes de RLS; miembros SELECT, líderes INSERT/UPDATE, Owner DELETE, service_role privilegios para tareas expresamente autorizadas. CHECK de dominios/ticket; org_id inmutable; bloqueo transaccional advisory por empresa; índice único parcial de principal más constraint trigger diferido. RPC SECURITY INVOKER con rol explícito y filas afectadas verificadas. segments.business_line_id nullable, FK compuesta (business_line_id,org_id) con MATCH SIMPLE y CHECK de org_id no nulo si hay enlace; ON DELETE SET NULL (business_line_id).

Copia fuera de la migración DDL: operación administrativa autorizada por separado, con contexto transaccional local privado para conservar origin=migrated. Ninguna copia en carga de página. No exposición de tickets o nombres por agente/MCP (SDD 4); los miembros ya pueden leerlos con RLS. Catalogar campos nuevos y documentar en docs/BASE-DE-DATOS.md. Leer reglas de esquema antes de escribir migración.

## 11. Llamadas a IA
| Llamada | Orden | Modelo/esfuerzo | Coste |
|---|---|---|---|
| Ninguna | Regla determinista | No aplica | Sin llamadas |

## 12. Unidades de trabajo
| U | Entrega | CA | Test que falla primero |
|---|---|---|---|
| U-0 | SDD y conteos de lectura; parada antes de copia | CA-6 | No cambia comportamiento; evidencia de lectura arriba |
| U-1 | Reglas puras | CA-1, CA-8 | business-lines.test.ts |
| U-2 | Integridad, RLS y RPC aditivas | CA-2..CA-5 | business-lines.pg.test.ts |
| U-3 | Procedimiento repetible, solo ejecutado con permiso específico | CA-6, CA-7 | business-lines-copy.pg.test.ts |
| U-4 | Catálogo, documentación, suite completa e informe | Todos | Pruebas existentes intactas + pruebas nuevas |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
Reutilizar DiagnosisInput, archetypeOf y diagnose; módulo business-lines puro. No persistir resultados derivados. Bloqueo limitado a READ COMMITTED: no afirmar seguridad en REPEATABLE READ. Índice único parcial obliga a desmarcar antes de marcar en la misma RPC; constraint diferido verifica el final. Copia prioriza solo candidatos válidos, no un Owner inválido sobre un miembro válido.

## 14. Riesgos y dependencias
SDD 1→2→3→4 estrictos, no paralelos. Los consumidores no leen líneas hasta sus entregas. No retirar escritura de sesiones hasta cerrar el sprint siguiente a SDD 4. La copia puede cambiar la vista de usuarios con sesiones distintas; los conteos actuales no garantizan ausencia futura de excepciones. El SDD 4 propone cambiar una prueba protegida del PRD: necesitará permiso específico antes de esa entrega, no queda autorizado aquí.

## 15. Preguntas para Fede y para la revisión técnica
Fede: vistos los conteos 0 / 0 / 1 / 0, ¿autorizas copiar el diagnóstico válido existente a una línea principal, manteniendo intacta su sesión original? No se interpreta «continúa» como permiso específico de copia.
Revisión: integridad concurrente en READ COMMITTED, aislamiento de empresa y protección del indicador de copia.

## 16. Pendiente de verificar
- Permiso específico de copia: Fede; bloqueo actual.
- FK con limpieza selectiva y concurrencia: pruebas nuevas antes de aplicar DDL.
- Tipos/suite: todavía no hay código nuevo; ejecutar tras implementación.
- Concurrencia real: PGlite de una conexión no la demuestra.

## 17. Revisión técnica independiente
Pendiente de nokko-gate; no realizada por el autor.

## 18. Delta de implementación
14-11-2026: solo SDD y recuentos agregados de lectura; sin esquema nuevo, código, copia, llamadas IA, gasto, envíos ni publicación. Entrega detenida en U-0 para presentar resultados a Fede.