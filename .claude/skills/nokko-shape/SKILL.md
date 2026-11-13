---
name: nokko-shape
description: Estación 1b de la factory NOKKO. Decide el nivel de documentación de un trabajo (solo ticket, SDD corto, PRD + SDD) y redacta el PRD o el SDD desde las plantillas. Úsala entre nokko-intake y nokko-brief, cuando un ticket LOGGED es una feature, una mejora o un bug que toca esquema, RLS o datos.
---

# Shape: del ticket al PRD y al SDD

Lee antes `docs/factory/GROUND-RULES.md`. Esta estación redacta documentos; **no promueve tickets, no crea ramas ni escribe código**. El PRD dice qué y por qué; el SDD dice cómo se verifica. Sin SDD aprobado no hay brief.

## 1. Elige el nivel
| Tipo de trabajo | PRD | SDD | Siguiente |
|---|---|---|---|
| Bug que no toca esquema, RLS ni datos | No | No | `nokko-brief` con test que falla primero |
| Bug que toca esquema, RLS o datos | No | Sí, corto | SDD → aprobación → `nokko-brief` |
| Mejora acotada | No | Sí, corto | SDD → aprobación → `nokko-brief` |
| Feature | Sí, una página | Sí | PRD → aprobación → SDD → aprobación → `nokko-brief` |
| Iniciativa (varias features) | Sí, con orden y dependencias | Uno por feature | PRD → aprobación → SDD de cada feature |

Si dudas entre dos niveles, propón el más ligero y dile a Fede qué le añadiría el otro. «Corto» significa rellenar solo las secciones que cambian el resultado y marcar el resto «No aplica».

## 2. Pasos
1. Lee el ticket (`.factory/ledger.json`, solo lectura; el único escritor es `nokko-tracker`), `AGENTS.md`, `src/lib/AGENTS.md`, `docs/sdd/README.md` y `docs/sdd/EXECUTION.md`.
2. Busca PRD y SDD previos sobre el mismo tema en `docs/prd/` y `docs/sdd/`. Si existe uno, extiéndelo o enlázalo; no dupliques.
3. Dile a Fede el nivel elegido y por qué, en una frase. Si el tipo es ambiguo, pregunta.
4. Redacta:
   - PRD: copia `docs/factory/templates/prd.md` a `docs/prd/PRD-<AAAAMMDD>-<slug>.md` (crea la carpeta si no existe).
   - SDD: copia `docs/factory/templates/sdd.md` a `docs/sdd/SDD-<AAAAMMDD>-<slug>.md`.
5. Rellena con evidencia del repo. Cita archivo y línea. Lo que no puedas comprobar va como **[Por verificar]**, no como hecho.
6. Trazabilidad: cada CA-n del SDD cita el G-n del PRD que cubre (si hay PRD) y nombra el archivo de test que lo prueba. Cada unidad U-n nombra el test que debe fallar primero.
7. Estado «Borrador». Entrega a Fede: ruta, nivel elegido, lista de [Por verificar] y preguntas abiertas.
8. Con la aprobación explícita de Fede en el chat, cambia el Estado a «Aprobado» con la fecha. Un PRD aprobado habilita redactar sus SDD; un SDD aprobado habilita `nokko-brief`. Cuando el ticket tenga SDD, enlázalo con `node scripts/factory/ledger.mjs doc NK-xxxx --sdd <ruta> [--prd <ruta>]` (lo ejecuta `nokko-tracker`), no editando el ledger a mano.

## 3. Reglas
- Ningún número de negocio se estima: línea base medida con su fuente, o «sin dato».
- Sin datos de clientes en ejemplos, evidencias ni casos. Datos ficticios.
- Textos de producto en español, «tú», iconos solo con su texto (un icono por concepto, `IconText`; única excepción el `›` del rail colapsado), estados con palabra. Identificadores y commits en inglés.
- La sección 17 del SDD (revisión técnica) la rellena el resultado de un agente `nokko-gate` con contexto fresco, nunca tú. Lánzalo sobre el SDD en «Borrador», copia su informe sin editarlo y pásaselo a Fede junto con el SDD. El gate informa; aprueba Fede.
- No amplíes el alcance: lo que sobre va a «No incluye» o a una sugerencia.
- No uses ni cites plantillas, skills ni reglas de otros productos. Todo sale de `docs/factory/templates/`.
- Nunca push, merge, despliegue ni commit sin orden explícita de Fede para esa acción.

## Comprobación antes de entregar
- El nivel elegido está justificado en una frase.
- Cada CA-n tiene prueba nombrada; cada U-n tiene su test fail-first.
- Cada cifra tiene fuente o dice «sin dato».
- Las preguntas abiertas y [Por verificar] están listadas.
