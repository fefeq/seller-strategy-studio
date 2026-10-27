# SDD-20261025-fit-data-7b-competitors-entity · [Feature] Competidores como entidad y alta manual (parte b de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25
**Depende de:** SDD-20261025-universal-field-definitions; SDD-20261025-fit-data-7a-llave-minima-y-completado (tabla de llaves); SDD-20261025-discoveries-scoped-manual-search (confirmar competidores)


## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

Contexto común, evidencia, privacidad, notas técnicas y preguntas: `annex/fit-data-common.md`.
> Parte 7b de 3 de «Datos mínimos de encaje». Las otras: 7a (llave y completado), 7b (competidores), 7c (identidad de persona y resultados de terceros). Los CA y H conservan la numeración original.

## 2. Problema y para quién
Ver `annex/fit-data-common.md`, sección «Problema y para quién».

## 3. Evidencia y por qué ahora
Ver `annex/fit-data-common.md`, sección «Evidencia y por qué ahora».
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas del anexo.

## 4. Resultado buscado
Ver `annex/fit-data-common.md`, sección «Resultado buscado».

## 5. Alcance
**Incluye:**
- Entidad Competidor con nombre y dominio.
- Alta manual en el onboarding (Posicionamiento), la pantalla de Estrategia y el Agente.
- Confirmar o descartar competidores propuestos por Descubiertos.
- Coherencia con la frase «Alternativa competitiva» del posicionamiento.
- Migración: proponer competidores a partir del texto actual, a confirmar por ti.
**No incluye:**
- Enriquecer competidores con terceros más allá de proponer un dominio.
- Cambiar la búsqueda de Descubiertos (SDD 6).
- Llave mínima de otras entidades (7a) y identidad de persona (7c).

## 6. Cambios de comportamiento (delta)
**Añadido:** entidad Competidor; alta manual en tres puntos; propuestas de competidores desde el texto actual.
**Modificado:** competidores: de texto libre a lista estructurada, manteniendo la frase de posicionamiento.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-3: Como founder, quiero gestionar competidores con datos útiles.
- CA-8: El sistema DEBE permitir crear, editar y borrar competidores con nombre y dominio.
- CA-9: CUANDO Descubiertos encuentra un competidor, el sistema DEBE proponerlo con nombre y dominio y esperar mi confirmación (coherente con el SDD de Descubiertos).
- CA-10: SI cambio la lista de competidores, ENTONCES el sistema DEBE mantener coherente la frase «Alternativa competitiva» del posicionamiento sin pisar un texto que haya escrito yo.

### H-6: Como founder, quiero añadir competidores a mano.
- CA-17: El sistema DEBE permitirme añadir un competidor con nombre y dominio en cada uno de estos puntos (decididos por Fede): bloque de Posicionamiento del onboarding («Alternativas y competidores»), pantalla de Estrategia y desde el Agente. El panel de Descubiertos solo muestra y confirma propuestas.
- CA-18: CUANDO añado un competidor a mano, el sistema DEBE guardarlo como escrito por mí y confirmado.
- CA-19: SI el competidor ya existe por nombre o dominio, ENTONCES el sistema DEBE avisarme y ofrecer abrir el existente.
- CA-20: SI no indico dominio, ENTONCES el sistema DEBE aceptar el competidor, marcarlo «Falta dominio» y proponer uno si puede deducirlo de la web.
- CA-21: MIENTRAS el onboarding no ha terminado, el sistema DEBE permitir saltar este paso sin bloquear el cierre.

## 8. Casos límite y errores
- Competidor sin dominio: aceptarlo, marcar «Falta dominio» y «No enriquecible» (CA-20).
- Competidor duplicado por nombre o dominio: avisar y abrir el existente (CA-19).
- Borrar un competidor que aparece en el posicionamiento o en otra pantalla: avisar dónde se usa y ofrecer archivar (CA-8).
- El texto de posicionamiento fue escrito por una persona: no se toca; el cambio queda como propuesta (CA-10).
- Rol sin permiso: respetar roles actuales.

## 9. Experiencia y copy
Mensaje: «Para investigar a *X* falta el dominio. Lo he deducido de su web: *x.com*. ¿Lo confirmas?» Estados: «Completa», «Falta *dato*», «Propuesta de *proveedor*». «Tú», sin iconos.

## 10. Datos, permisos y privacidad
Ver `annex/fit-data-common.md`, sección «Datos, permisos y privacidad».

## 11. Unidades de trabajo
- U-3: Entidad Competidor, alta manual en tres puntos y sincronía con posicionamiento (H-3, H-6; coordinada con SDD de Descubiertos).


## 12. Notas técnicas [Sugerencia — se valida en la implementación]
Ver `annex/fit-data-common.md`, sección «Notas técnicas».

## 13. Riesgos y dependencias
Ver `annex/fit-data-common.md`, sección «Riesgos y dependencias».

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
Ver `annex/fit-data-common.md`, sección «Decisiones abiertas».

## 15. Pendiente de verificar
Ver `annex/fit-data-common.md`, sección «Pendiente de verificar».
- [Por verificar] Cómo se detecta un texto escrito a mano frente a uno generado (usar el origen del SDD universal).

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
