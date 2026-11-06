# Runbook para Claude Code · NOKKO · Tanda 2026-11-06 (señales, hallazgos, reglas de outreach y reactivación)

**Specs:** `SDD-20261106-frontal-rules-integration`, `SDD-20261106-signal-freshness`, `SDD-20261106-proven-findings` (todos en `docs/sdd/`).
**Estado:** listo para ejecutar tras la aprobación de Fede (2026-11-06) y la etapa 0. Sin migraciones en ninguna etapa.

## Reglas que mandan sobre todo
1. Lee `docs/sdd/EXECUTION.md`, `AGENTS.md` y `src/lib/AGENTS.md`; mandan sobre este runbook.
2. Una etapa por sesión, en orden. No empieces la siguiente sin que la anterior esté revisada y fusionada por Fede.
3. Rama `feat/<slug>` desde `main` actualizado; PR en borrador; nunca push ni merge a `main` ni `production`.
4. No toques nada de Postin (repos, proyectos, servidores MCP, bases de datos, documentos). No consultes ninguna base de datos: los datos reales que falten quedan como «sin dato».
5. Test que falla primero para cada CA. Datos de prueba ficticios. No rellenes la sección 17 de ningún SDD.
6. Si el SDD contradice el código, un [Por verificar] no se puede comprobar, o el estado de `main` no es el esperado, para y lista las preguntas.
7. Tras cambiar herramientas: `bun install` y regenera el manifest MCP; añade el título a `TITLES`. Si el manifest tiene conflicto al rebasar, regénéralo, no lo fusiones a mano.

## Etapa 0 · Manual (Fede)
1. Fusiona el PR de `sdd/senales-y-hallazgos-20261106` hacia `main`.
2. Fusiona `feat/plays-library-core` (SDD 1 de Plays, en curso en otra sesión). **Las etapas 2 a 5 no arrancan antes**: comparten registro de herramientas, manifest, `proactive/` y `org-data.ts` con ella, y la migración `0077` es suya.
3. La etapa 1 (`draft-rules`) puede ir antes de que Plays esté fusionada.

## Etapa 1 · `draft-rules`
**Entrada:** paso 0.1 hecho.
```
Lee docs/sdd/EXECUTION.md, AGENTS.md y src/lib/AGENTS.md. Fede aprueba hoy (2026-11-06) docs/sdd/SDD-20261106-frontal-rules-integration.md: cambia su Estado a «Aprobado» con esa fecha.

Ejecuta SOLO la unidad U-1 (draft-rules, CA-1 a CA-4). La U-2 de ese SDD está sustituida por signal-freshness y la U-3 y la U-4 son de etapas posteriores: no las implementes.

Rama feat/draft-rules desde main. Corre bun install y confirma en AGENTS.md los comandos de tipos, lint y pruebas. Test que falla primero para cada CA. No rellenes la sección 17. Si el SDD contradice el código o un [Por verificar] no se puede comprobar, para y lista las preguntas.

No toques nada de Postin. No consultes ninguna base de datos. PR en borrador (nunca push ni merge a main/production). Entrega: enlace al PR, tabla CA → prueba, riesgos, preguntas abiertas. No empieces otra unidad.
```

## Etapa 2 · `signal-freshness` (SDD 2 de Plays)
**Entrada:** etapa 1 fusionada y `plays-library-core` fusionada.
```
Lee docs/sdd/EXECUTION.md, AGENTS.md y src/lib/AGENTS.md. Fede aprueba hoy (2026-11-06) docs/sdd/SDD-20261106-signal-freshness.md: cambia su Estado a «Aprobado» con esa fecha.

Comprueba antes de nada que src/lib/plays/ (catalog.ts y el filtro de detect() por play) existe en main. Si no, para.

Ejecuta ese SDD entero, U-1 a U-4 en orden, un commit por unidad citando SDD y unidad. Rama feat/signal-freshness desde main. Corre bun install y confirma comandos en AGENTS.md. Test que falla primero para cada CA, incluido CA-13 (catálogo de Plays). Valores decididos: tope de 5 sugerencias de señal por ejecución y empresa, ventanas de la sección 13 como valores por defecto. U-4 incluye recorrido local en móvil y escritorio, claro y oscuro. Este SDD sustituye a la U-2 de frontal-rules-integration: no toques ese SDD.

No rellenes la sección 17. No toques nada de Postin. No consultes ninguna base de datos (señales por tipo: «sin dato»). PR en borrador (nunca push ni merge a main/production). Entrega: enlace al PR, tabla CA → prueba, riesgos, preguntas abiertas.
```

## Etapa 3 · `proven-findings`
**Entrada:** etapa 2 fusionada.
```
Lee docs/sdd/EXECUTION.md, AGENTS.md y src/lib/AGENTS.md. Fede aprueba hoy (2026-11-06) docs/sdd/SDD-20261106-proven-findings.md: cambia su Estado a «Aprobado» con esa fecha.

Ejecuta ese SDD entero, U-1 a U-3 en orden, un commit por unidad citando SDD y unidad. Rama feat/proven-findings desde main. Corre bun install y confirma comandos en AGENTS.md. Test que falla primero para cada CA. Decisiones ya tomadas: mínimo 3 pérdidas, incluir experimentos descartados, lectura abierta (sin rol). En U-1 mueve MIN_LOSSES a src/lib/loss-reasons.ts y que el detector lo importe sin cambiar su comportamiento. No devuelvas textos libres de deals. En el prompt del sistema hay una sola línea nueva por SDD y el test de herramientas nombradas las cubre todas.

No rellenes la sección 17. No toques nada de Postin. No consultes ninguna base de datos (pérdidas y experimentos: «sin dato»). PR en borrador (nunca push ni merge a main/production). Entrega: enlace al PR, tabla CA → prueba, riesgos, preguntas abiertas.
```

## Etapa 4 · Reactivación (U-3, SDD 3 de Plays)
**Entrada:** etapas 1, 2 y 3 fusionadas.
```
Lee docs/sdd/EXECUTION.md, AGENTS.md y src/lib/AGENTS.md. docs/sdd/SDD-20261106-frontal-rules-integration.md ya está «Aprobado» (Fede, 2026-11-06).

Ejecuta SOLO la unidad U-3 (CA-9 a CA-15 y CA-19). Rama feat/closed-lost-revival desde main. Corre bun install y confirma comandos en AGENTS.md. Test que falla primero para cada CA.

Decisiones ya tomadas: tope por empresa (constante MAX_REVIVALS_PER_RUN, valor por defecto 5; anótalo en el PR para que Fede lo ajuste); la puerta «algo cambió de verdad» NO entra en esta entrega; el detector nuevo se registra en el play closed-lost-revival del catálogo de Plays (CA-19); reutiliza el patrón de proven-findings y signal-freshness ya fusionados. Compara roles.ts con los 5 roles de comité y repórtalo sin cambiarlo.

No rellenes la sección 17. No toques nada de Postin. No consultes ninguna base de datos (pérdidas por motivo: «sin dato»). PR en borrador (nunca push ni merge a main/production). Entrega: enlace al PR, tabla CA → prueba, riesgos, preguntas abiertas.
```

## Etapa 5 · Jugadas (U-4)
**Entrada:** etapa 4 fusionada.
```
Lee docs/sdd/EXECUTION.md, AGENTS.md y src/lib/AGENTS.md. docs/sdd/SDD-20261106-frontal-rules-integration.md ya está «Aprobado» (Fede, 2026-11-06).

Ejecuta SOLO la unidad U-4 (CA-16 a CA-18). Rama feat/playbook-base-plays desde main. Corre bun install y confirma comandos en AGENTS.md. Test que falla primero para cada CA. Esta unidad toca src/lib/playbooks/ (guiones de venta), distinto del módulo src/lib/plays/ del catálogo de Plays.

Los números de las jugadas salen de REVIVAL_WINDOWS, DRAFT_LIMITS y la tabla de src/lib/signal-freshness.ts, nunca escritos a mano. En el prompt del sistema, una sola línea nueva para reactivación y vigencia de señales.

No rellenes la sección 17. No toques nada de Postin. No consultes ninguna base de datos. PR en borrador (nunca push ni merge a main/production). Entrega: enlace al PR, tabla CA → prueba, riesgos, preguntas abiertas.
```

## Revisión independiente, tras cada etapa
Otra sesión, sin el contexto de quien implementó:
```
Eres el gate independiente (agente nokko-gate). Revisa el PR <ENLACE> sobre el commit exacto <SHA>, contra docs/sdd/<SDD>.md. Intenta romperlo: CA sin prueba, contradicciones con el código o con decisiones del README, datos de clientes, alcance ampliado, filtros de org_id, archivos de Postin tocados. Puedes añadir comprobaciones, nunca quitarlas. No edites código. Rellena la sección 17 del SDD y devuelve veredicto (Listo / Cambios menores / Bloqueado) con hallazgos ordenados por gravedad.
```
Fede aprueba y fusiona; después, la siguiente etapa.

## Anuncios (aparte de esta tanda)
`SDD-20261106-ads-foundations` tiene su propio runbook (`RUNBOOK-20261106-ads-u1-demand-stage`). Su U-1 solo crea archivos nuevos y puede correr en paralelo con la etapa 1. Sus U-2 a U-4 esperan a: (a) `plays-library-core` fusionada, que ocupa la migración `0077`; (b) que Fede confirme el último número aplicado en la base real. Antes de implementar ads, `nokko-gate` sobre su SDD.

## Pendientes que no puede cerrar Claude Code
- Aprobación del SDD de anuncios y número de migración (Fede).
- Comportamiento real en producción tras publicar (Fede).
- Valores por defecto por confirmar con el uso real: ventanas de señales, tope de 5 y `get_proven_findings` abierta.
