---
name: nokko-factory
description: Orquesta la software factory de NOKKO (trigger → verificado en producción). Úsala cuando Fede traiga un bug, una feature o una alerta y quiera pasarlo por la línea, o pregunte en qué estación está un trabajo.
---

# Software factory de NOKKO

Línea fija que convierte un trigger (bug, feature, alerta) en un release verificado. Basada en `grandamenium/agent-software-factory`. Tú, Fede, apareces dos veces: **GO** para empezar y **aprobación** para entregar.

Lee antes `docs/factory/GROUND-RULES.md` y `docs/factory/README.md`.

## Estaciones y skill de cada una
| # | Estación | Skill / agente | Comprobación |
|---|---|---|---|
| 1 | Intake y triage | `nokko-intake` (agente `nokko-tracker`) | ID único, owner solo tras GO |
| 1b | Shape: PRD y SDD según el tipo de trabajo | `nokko-shape` | nivel justificado, cada CA con prueba, aprobación de Fede |
| 2 | Brief | `nokko-brief` (coordinador, tú) | commit base, test fail-first y movimientos prohibidos nombrados |
| 3 | Fan-out | `nokko-fanout` | ningún worktree saturado, ninguna sesión callada sin aviso |
| 4 | Build con test fallando | `nokko-build` (agente `nokko-author`) | falla en base, pasa en tip, evidencia en disco |
| 5 | Review e integración | `nokko-review` (agente `nokko-reviewer`) | diff leído, un merge revertible por trabajo |
| 6 | Gate, staging, entrega | `nokko-gate` (agente `nokko-gate`), `nokko-walkthrough`, `nokko-release` | gate PASS, soak PASS, aprobación humana |
| 7 | Vigilancia | `nokko-watch` | medir primero, no cambiar nada hasta saber por qué |

## Cómo conducir un trabajo
1. `nokko-intake` registra → `LOGGED`. Nada tiene owner.
2. Fede dice GO → `ledger.mjs promote` (exige `--go`). Si no hay GO explícito en el chat, no promociones.
2b. `nokko-shape` elige el nivel (solo ticket, SDD corto, PRD + SDD) y redacta lo que toque. Sin SDD aprobado no hay brief.
3. `nokko-brief` → `nokko-fanout` (worktree + sesión por trabajo) → `nokko-build`.
4. `nokko-review` lee el diff y fusiona cada trabajo como commit propio en la rama de integración.
5. `nokko-gate` (sesión sin contexto del código) + `nokko-walkthrough`.
6. `nokko-release` entrega a Fede un único mensaje: qué cambió, qué pasó, «¿listo para entregar?». Solo con su aprobación y `ledger.mjs ship`.
7. `nokko-watch` cierra con `ledger.mjs verify`; los hallazgos vuelven a `nokko-intake` como tickets nuevos con test fail-first.

## Límites duros en NOKKO
No hagas push, merge a `main`/`production`, despliegue ni cambios en producción sin orden explícita de Fede para esa acción. Esta factory prepara y verifica; la entrega física es de Fede.
