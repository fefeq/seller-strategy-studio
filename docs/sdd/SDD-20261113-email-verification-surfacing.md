# SDD-20261113-email-verification-surfacing · [Feature] Estado del email en pantallas, agente y puerta en borradores

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso · **Pide:** Fede · **Aprueba:** Fede (autorización general) · **Fecha:** 2026-11-13
**PRD:** docs/prd/PRD-20261113-verificacion-de-email.md · **Depende de:** SDD-20261113-email-verification-model, SDD-20261113-email-verification-apollo

## 1. Resumen
El estado de verificación se ve junto al email en stakeholders, leads y personas, y en las respuestas del agente y de MCP. La puerta graduada del SDD 1 se aplica en las dos superficies con dirección conocida: `draft_followup` y el detector `followup_sequence`. Cada borrador bloqueado deja un registro con el motivo, sin el email.

## 2. Problema y para quién
Sin el estado a la vista, un miembro puede enviar un borrador a una dirección inválida o catch-all y dañar el buzón (PRD 1). Cubre a cualquier miembro que revela o pide borradores y al agente/MCP.

## 3. Evidencia y por qué ahora
Leído en `main` @ f6efda9 más SDD 2 aplicado. `draft_followup` carga el lead sin `email` (`core-read.ts:528-534`); el detector recibe leads sin `email` (`org-data.ts:277-280`); las fichas muestran el email sin estado (`stakeholders-tab.tsx:172`, `lead-detail.tsx:103`, `people.tsx:205,256`). Las pruebas existentes de ambas superficies usan leads sin email: la regla no las toca (PRD 6.5: un destinatario sin email sigue como hoy). Sin datos de uso.

## 4. Resultado buscado
G-1: estado visible en las tres fichas y en agente/MCP. G-2: cero borradores para «inválido» o «catch-all» en las superficies con regla; «sin verificar» y «no verificable» pasan con marca. Se verifica por prueba automática, línea base sin dato.

## 5. Alcance
**Incluye:** etiquetas y frases de la puerta (puro); puerta y registro en `draft_followup` y `followup_sequence`; carga del estado en el snapshot proactivo; insignia de estado en stakeholders, leads y personas; `estado_email` en respuestas de revelado del agente/MCP; botón «Verificar email» en el stakeholder (reutiliza el revelado, con coste a la vista); tabla de registro de bloqueados.
**No incluye:** puerta «solo verificado» en plays (SDD 4, NK-0171); verificador independiente (2b); revelado de leads o people (no existe: en esas fichas el botón no aparece); texto libre del agente ni revisión de llamada (fuera de la regla, PRD 7.1); cambios en el envío (NOKKO no envía).

## 6. Cambios de comportamiento (delta)
**Añadido:** insignia de estado y fecha junto al email; marca «email sin verificar» en borradores que pasan; bloqueo con motivo y qué hacer; registro `email_draft_blocks`; `estado_email` en revelados del agente; botón «Verificar email» en stakeholders.
**Modificado:** `draft_followup` carga `email` y aplica la puerta; el snapshot proactivo adjunta `email` y `email_status` a cada lead; `followup_sequence` bloquea o marca según el estado.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como miembro, quiero ver el estado del email donde aparece.
- **CA-1** Cada estado tiene su palabra en español (verificado, catch-all, no verificable, inválido, sin verificar) y la fecha de comprobación acompaña al estado vigente · G-1 · prueba: `src/lib/email-status.test.ts`
- **CA-2** La insignia aparece junto al email en la ficha del stakeholder, del lead y de la persona, leída con el cliente del miembro (RLS) · G-1 · revisión en navegador
### H-2: Como miembro, quiero que ningún borrador salga hacia un email inválido o catch-all.
- **CA-3** `draft_followup` con estado «inválido» o «catch-all» no redacta: devuelve el motivo y qué hacer, y lo registra sin el email · G-2 · prueba: `src/lib/agent-tools-email-gate.test.ts`
- **CA-4** Con «sin verificar» o «no verificable» redacta y añade la marca; sin email en el lead, se comporta exactamente como hoy · G-2 · misma prueba
- **CA-5** `followup_sequence` con estado bloqueado emite una sugerencia sin borrador ni acción, con el motivo; con marca, el cuerpo la lleva; sin email, idéntico a hoy · G-2 · prueba: `src/lib/proactive-email-gate.test.ts`
- **CA-6** Toda sugerencia de bloqueo que se sincroniza deja fila en `email_draft_blocks` (superficie, estado, motivo; nunca el email) · G-2 · misma prueba (vía syncSuggestions)
### H-3: Como miembro, quiero el estado también en el agente y poder reverificar.
- **CA-7** `apollo_reveal_contacts` y `apollo_reveal_stakeholder` incluyen `estado_email` por persona · G-1 · prueba: `src/lib/agent-tools-email-gate.test.ts`
- **CA-8** El stakeholder con email ofrece «Verificar email» con el coste aproximado a la vista; la llamada es el revelado ya existente · G-1 · revisión en navegador

## 8. Casos límite y errores
Estado caducado (> 90 días) se muestra como «sin verificar» con la fecha de la última comprobación. Fallo al leer la verificación: se trata como «sin verificar» (marca, nunca bloqueo por un fallo de lectura). Otra empresa: toda lectura filtra por `org_id`. Registro de bloqueo que falla: se anota con `safeErrorLog` y no rompe la respuesta. Detector con snapshot antiguo sin `email`: comportamiento intacto (pruebas existentes lo cubren).

## 9. Experiencia y copy
Marca: «email sin verificar» / «email no verificable». Bloqueo: «Este email es inválido: no preparo el borrador. Busca otro contacto de la cuenta.» / «Este dominio acepta cualquier dirección (catch-all): no preparo el borrador. Busca otro contacto de la cuenta.» Estados con palabra, sin iconos nuevos (NK-0168 en curso). Errores por `errorText`.

## 10. Datos, permisos y privacidad
Tabla nueva `email_draft_blocks` (aditiva, autorizada): `org_id` con `current_org()`, `surface`, `status`, `reason`, `created_at`; miembros leen e insertan los de su empresa (no lleva dato personal), `service_role` todo. Lectura de `email_verifications` desde el navegador bajo la política SELECT del SDD 1. Ningún email en el registro, en logs ni en pruebas (`.invalid`).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Etiquetas y frases puras | CA-1 | `src/lib/email-status.test.ts` |
| U-2 | Migración `email_draft_blocks` | CA-6 | prueba PGlite `src/lib/email-draft-blocks.pg.test.ts` |
| U-3 | Puerta y registro en `draft_followup`; `estado_email` en revelados | CA-3, CA-4, CA-7 | `src/lib/agent-tools-email-gate.test.ts` |
| U-4 | Snapshot con estado + puerta en el detector + registro en sync | CA-5, CA-6 | `src/lib/proactive-email-gate.test.ts` |
| U-5 | Insignia en las tres fichas + botón «Verificar email» | CA-2, CA-8 | revisión en navegador |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
`src/lib/email-status.ts` puro: etiquetas, marca, motivo y `EmailStatus` efectivo a partir de fila + fecha (reutiliza `effectiveEmailStatus` y `emailDraftGate` del SDD 1). El snapshot carga `email_verifications` solo para los emails de leads abiertos (una consulta `in`). `syncSuggestions` escribe el registro para sugerencias con `email_block`, así cron, Inngest y el agente quedan cubiertos por un solo punto. La insignia es un componente con un hook que lee por lotes los emails visibles.

## 14. Riesgos y dependencias
Un lead nunca llega a «verificado» en este paso (solo se revelan stakeholders): la marca será frecuente en leads; aceptado en Q-3. El detector cambia su salida solo cuando el lead tiene email con estado bloqueado o marcable. Vuelta atrás: revertir archivos; la tabla de registro se retira en migración aparte autorizada.

## 15. Preguntas para Fede y para la revisión técnica
Ninguna abierta. No publicar ni desplegar.

## 16. Pendiente de verificar
Insignia y botón en navegador real (desktop y móvil, claro y oscuro). Tipos sin comprobar por restricción del entorno.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
No revisado; no se rellena veredicto independiente.

## 18. Delta de implementación
Pendiente de rellenar al entregar.
