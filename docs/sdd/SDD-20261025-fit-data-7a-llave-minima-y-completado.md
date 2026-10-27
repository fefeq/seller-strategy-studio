# SDD-20261025-fit-data-7a-llave-minima-y-completado · [Feature] Llave mínima y completado asistido (parte a de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD-20261025-universal-field-definitions


## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

Contexto común, evidencia, privacidad, notas técnicas y preguntas: `annex/fit-data-common.md`.
> Parte 7a de 3 de «Datos mínimos de encaje». Las otras: 7a (llave y completado), 7b (competidores), 7c (identidad de persona y resultados de terceros). Los CA y H conservan la numeración original.

## 2. Problema y para quién
Ver `annex/fit-data-common.md`, sección «Problema y para quién».

## 3. Evidencia y por qué ahora
Ver `annex/fit-data-common.md`, sección «Evidencia y por qué ahora».
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas del anexo.

## 4. Resultado buscado
Ver `annex/fit-data-common.md`, sección «Resultado buscado».

## 5. Alcance
**Incluye:**
- Definir la llave mínima por entidad (tabla del anexo) y comprobarla antes de enriquecer.
- Completarla con ayuda: derivar dominio, vincular lead con cuenta, conservar el nombre completo.
- Aviso «Falta *dato* para investigar» en pantalla, Agente y automatismos.
**No incluye:**
- Entidad Competidor y su alta manual (7b).
- Identidad única de persona y guardado de lo devuelto por terceros (7c).
- Contratar proveedores nuevos; extracción no oficial de datos de LinkedIn.

## 6. Cambios de comportamiento (delta)
**Añadido:** llave mínima por entidad y su comprobación; aviso de dato que falta; propuesta de dominio y de vínculo lead–cuenta.
**Modificado:** tamaño y país de cuenta pasan a valores normalizados (según SDD universal).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero saber qué falta para que NOKKO investigue una cuenta, persona, lead o competidor.
- CA-1: El sistema DEBE definir, para cada entidad, su llave mínima y comprobarla antes de lanzar un enriquecimiento.
- CA-2: SI falta una llave, ENTONCES el sistema DEBE decir cuál falta, por qué se necesita y ofrecerme completarla o proponerla.
- CA-3: CUANDO una necesidad de enriquecimiento se lanza desde pantalla, Agente o automático, el sistema DEBE aplicar la misma comprobación.

### H-2: Como founder, quiero que NOKKO complete la llave por mí cuando pueda.
- CA-4: CUANDO una cuenta no tiene dominio pero sí URL web o email corporativo, el sistema DEBE proponer el dominio normalizado.
- CA-5: CUANDO un lead tiene email corporativo y no cuenta vinculada, el sistema DEBE proponer vincularlo a una cuenta existente por dominio o crear una.
- CA-6: SI el email es personal (gmail, outlook u otros), ENTONCES el sistema NO DEBE derivar dominio de empresa y DEBE pedir el nombre de la empresa.
- CA-7: CUANDO una persona se guarda con nombre completo, el sistema DEBE conservar el nombre completo tal cual y permitir nombre y apellido por separado.

## 8. Casos límite y errores
- Dominio ya existente en otra cuenta: proponer fusión o confirmar duplicado (CA-1).
- Varias cuentas con el mismo dominio: pedir que elija una (CA-5).
- Dominio de correo personal (gmail, outlook u otros): no usarlo como dominio de empresa (CA-6).
- Lanzamiento automático sin llave: el aviso de dato que falta aplica también a los automatismos (CA-2); cualquier regla de omitir o gastar presupuesto queda para Dani.
- Persona con un solo nombre: aceptar y marcar apellido ausente (CA-7).
- Registros históricos sin llave: listarlos como «Faltan datos» sin bloquear su uso (CA-2).
- Presupuesto agotado: aplicar la regla existente (pausa al 100 %, fuente: código del repo) y avisar (CA-3).
- Rol sin permiso para editar: respetar roles actuales.

## 9. Experiencia y copy
Mensaje: «Para investigar a *X* falta el dominio. Lo he deducido de su web: *x.com*. ¿Lo confirmas?» Estados: «Completa», «Falta *dato*», «Propuesta de *proveedor*». «Tú», sin iconos.

## 10. Datos, permisos y privacidad
Ver `annex/fit-data-common.md`, sección «Datos, permisos y privacidad».

## 11. Unidades de trabajo
- U-1: Definición y comprobación de llave mínima por entidad (H-1; requiere SDD universal).
- U-2: Completado asistido de llaves (H-2).


## 12. Notas técnicas [Sugerencia — Dani valida]
Ver `annex/fit-data-common.md`, sección «Notas técnicas».

## 13. Riesgos y dependencias
Ver `annex/fit-data-common.md`, sección «Riesgos y dependencias».

## 14. Preguntas para Dani
Ver `annex/fit-data-common.md`, sección «Preguntas para Dani».

## 15. Pendiente de verificar
Ver `annex/fit-data-common.md`, sección «Pendiente de verificar».
- [Por verificar] Lista versionada de dominios de correo personal.
- [Por verificar] Cómo se separa nombre y apellido (nombres compuestos).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
