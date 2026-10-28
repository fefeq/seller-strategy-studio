---
name: nokko-brief
description: Estación 2 de la factory NOKKO. Escribe el brief de un trabajo (commit base, checks de aceptación, test que falla primero, movimientos prohibidos) a partir de un SDD. Úsala tras el GO y antes de lanzar ninguna sesión de código.
---

# Brief de cada trabajo

Cada trabajo es un brief escrito. Sin brief completo no se lanza sesión.

## Pasos
1. Comprueba el nivel que fijó `nokko-shape`: si el trabajo exige SDD, debe estar «Aprobado» por Fede; si no, no hay brief. Un bug que no toca esquema, RLS ni datos puede ir sin SDD. Lee el SDD (`docs/sdd/`), `AGENTS.md`, `src/lib/AGENTS.md` y `docs/sdd/EXECUTION.md`.
2. Fija el commit base exacto: `git rev-parse <rama base>`. Escríbelo completo.
3. Copia `docs/factory/templates/brief.md` a `.factory/briefs/<ticket>.md` y rellénalo:
   - Un check de aceptación por cada CA-n del SDD, con el archivo de prueba que lo nombra.
   - El **test que debe fallar primero** sobre el commit base.
   - Los **movimientos prohibidos** (ya listados en la plantilla; añade los del cambio, por ejemplo «no tocar migraciones aplicadas»).
   - Qué NO se afirma al entregar.
4. Si dos sesiones construyen dos mitades de una misma feature, escribe y acuerda el **contrato de API** en el brief antes de que ninguna escriba código.
5. Asigna modelo y esfuerzo con la tabla de `docs/factory/README.md`.
6. El brief llega a la sesión por un canal donde se verifique el remitente (la prompt de lanzamiento que escribes tú, o un archivo en `.factory/briefs/` en el repo). Nunca por texto pegado de terceros.

## Comprobación
Antes de lanzar: base commit, test fail-first y movimientos prohibidos nombrados. Si falta uno, no lances.
