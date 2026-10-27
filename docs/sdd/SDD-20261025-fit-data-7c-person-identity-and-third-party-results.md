# SDD-20261025-fit-data-7c-person-identity-and-third-party-results · [Feature] Identidad de persona y resultados de terceros (parte c de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD-20261025-universal-field-definitions; SDD-20261025-fit-data-7a-llave-minima-y-completado (llave mínima)


## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

Contexto común, evidencia, privacidad, notas técnicas y preguntas: `annex/fit-data-common.md`.
> Parte 7c de 3 de «Datos mínimos de encaje». Las otras: 7a (llave y completado), 7b (competidores), 7c (identidad de persona y resultados de terceros). Los CA y H conservan la numeración original.

## 2. Problema y para quién
Ver `annex/fit-data-common.md`, sección «Problema y para quién».

## 3. Evidencia y por qué ahora
Ver `annex/fit-data-common.md`, sección «Evidencia y por qué ahora».
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas del anexo.

## 4. Resultado buscado
Ver `annex/fit-data-common.md`, sección «Resultado buscado».

## 5. Alcance
**Incluye:**
- Vínculo entre la persona del CRM y el stakeholder de una cuenta.
- Guardar lo que devuelven los terceros con proveedor y fecha, sin pisar tus datos.
- No volver a pedir un dato fresco.
**No incluye:**
- Unificar las dos tablas de personas si Dani lo decide (hoy solo se propone vincular).
- Contratar proveedores nuevos.
- Llave mínima (7a) y competidores (7b).

## 6. Cambios de comportamiento (delta)
**Añadido:** vínculo persona–stakeholder; origen y fecha por dato externo; propuestas de coincidencia.
**Modificado:** enriquecimiento: guarda como propuesta/origen externo y no sobrescribe valores confirmados.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-4: Como founder, quiero una sola identidad por persona.
- CA-11: El sistema DEBE vincular la persona del CRM y el stakeholder de una cuenta cuando sean la misma (mismo email o mismo LinkedIn).
- CA-12: SI dos registros parecen la misma persona y no hay coincidencia exacta, ENTONCES el sistema DEBE proponer unirlos y esperar mi confirmación.

### H-5: Como founder, quiero que lo que traen las apps externas sea fiable y no pise mis datos.
- CA-13: CUANDO un tercero devuelve un dato, el sistema DEBE guardarlo con proveedor y fecha como origen.
- CA-14: SI el campo tiene un valor escrito o confirmado por una persona, ENTONCES el sistema DEBE guardar lo del tercero como propuesta pendiente sin reemplazar el valor.
- CA-15: CUANDO dos proveedores devuelven valores distintos para el mismo campo, el sistema DEBE mostrar ambos con su origen y no elegir en silencio.
- CA-16: CUANDO un dato ya está guardado y fresco para esa entidad, el sistema NO DEBE volver a pedirlo al tercero ni gastar presupuesto.

## 8. Casos límite y errores
- Tercero devuelve vacíos o contradictorios: no sobrescribir; registrar el intento (CA-14, CA-15).
- Dos proveedores con valores distintos: mostrar ambos con su origen (CA-15).
- Dos fusiones de la misma persona a la vez: la segunda ve el estado actual y no duplica (CA-12).
- Coincidencia dudosa: proponer unir y esperar tu confirmación (CA-12).
- Proveedor caído durante la escritura: no guardar parcial (CA-13).
- Rol sin permiso: respetar roles actuales.

## 9. Experiencia y copy
Mensaje: «Para investigar a *X* falta el dominio. Lo he deducido de su web: *x.com*. ¿Lo confirmas?» Estados: «Completa», «Falta *dato*», «Propuesta de *proveedor*». «Tú», sin iconos.

## 10. Datos, permisos y privacidad
Ver `annex/fit-data-common.md`, sección «Datos, permisos y privacidad».

## 11. Unidades de trabajo
- U-4: Identidad única de persona (H-4).
- U-5: Escritura de resultados de terceros con origen y propuestas (H-5; depende de SDD universal CA-7 a CA-9).


## 12. Notas técnicas [Sugerencia — Dani valida]
Ver `annex/fit-data-common.md`, sección «Notas técnicas».

## 13. Riesgos y dependencias
Ver `annex/fit-data-common.md`, sección «Riesgos y dependencias».

## 14. Preguntas para Dani
Ver `annex/fit-data-common.md`, sección «Preguntas para Dani».

## 15. Pendiente de verificar
Ver `annex/fit-data-common.md`, sección «Pendiente de verificar».
- [Por verificar] Definición de «fresco» (días) para CA-16.
- [Por verificar] Criterio de coincidencia de personas.
- [Por verificar] Base legal y retención de datos de contacto.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
