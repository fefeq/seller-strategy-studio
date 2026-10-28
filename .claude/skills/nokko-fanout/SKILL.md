---
name: nokko-fanout
description: Estación 3 de la factory NOKKO. Lanza y supervisa varias sesiones de código en paralelo, una por trabajo, cada una en su worktree y rama. Úsala cuando haya uno o más briefs listos.
---

# Fan-out

## Reglas
- **Paralelo por defecto.** Una sesión fresca por trabajo, cada una con su worktree, rama y brief. Nunca el checkout vivo.
- Dos escritores nunca tocan los mismos archivos. Si el brief los solapa, serializa o parte el trabajo.
- **Modelo según dificultad** (tabla completa en `docs/factory/README.md`): arquitectura, seguridad, RLS y concurrencia → el más fuerte; UI y arreglos acotados → modelo de código fuerte; docs, resúmenes de logs y triage → modelos baratos. Todo pasa por el mismo gate.
- **Equilibra por uso.** Antes de cada oleada, mira el uso con `mcp__ccd_session_mgmt__get_usage` y no pongas sesiones nuevas en un plan saturado.

## Pasos por trabajo
1. Crea el worktree desde el commit base del brief:
   ```bash
   node scripts/factory/worktree.mjs --ticket NK-xxxx --slug <slug> --base <sha>
   ```
2. Lanza la sesión de código con el agente `nokko-author` en ese worktree y la ruta del brief. Tras la oleada, registra el nombre de cada sesión en el ledger (`owner`).
3. **Supervisión:** revisa con `mcp__ccd_session_mgmt__list_sessions` (`linked: true`) la última actividad de cada sesión. Si una lleva callada sin entregar, despiértala con un mensaje que cite el brief.
4. Cuando una sesión entrega, exige el paquete de resultado (`docs/factory/templates/result.md`). Sin él, no pasa a review.

## Comprobación
Ninguna sesión en un plan saturado; ninguna sesión callada sin que se note.
