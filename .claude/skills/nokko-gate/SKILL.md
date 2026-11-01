---
name: nokko-gate
description: Estación 6 y capa 3 de la factory NOKKO. Gate independiente con contexto limpio que intenta romper el cambio sobre el commit exacto. Úsala solo desde una sesión que no escribió el código, tras la integración.
---

# Gate independiente

Lo ejecuta un agente con **contexto fresco que no escribió nada de este código** (agente `nokko-gate`). Si tú escribiste el código, no ejecutes este skill: lanza otra sesión.

## Núcleo fijo
```bash
node scripts/factory/gate.mjs --ticket NK-xxxx --base <sha base>
```
Comprueba, sobre el commit exacto y árbol limpio:
1. Canario: el runner detecta fallos.
2. Guards del diff: sin `as any`, `window.confirm/prompt`, secretos, `.only/.skip`, `.env` intacto, aserciones no debilitadas, timeouts no alargados.
3. Tipos, lint y build de release (red exterior bloqueada solo en mejor esfuerzo).
4. Suite completa. Fallos conocidos nombrados de antemano en `.factory/known-failures.json` (`{"tests": ["archivo > nombre"]}`). Los archivos que fallan sin ejecutar una sola aserción se cuentan aparte, para que un import roto no se esconda.
5. Cada archivo de test tocado, entero.
6. Segunda máquina y soak de recursos: el script informa **«NOT RUN»**. No lo des por hecho.

## Específico del cambio (solo añadir)
Lee el diff y el brief y añade intentos de romperlo: `--extra "<comando>"` (por ejemplo una prueba de RLS con dos empresas ficticias, un test de borde de la sección 8 del SDD). Puedes añadir comprobaciones; **nunca quitar ni debilitar una**.

## Protocolo de flakes
Para cada archivo con fallo inesperado:
```bash
node scripts/factory/flake.mjs --ticket NK-xxxx --base <sha base> --file <test> --runs 3
```
- Falla en ambos (base y nuevo) → `FLAKE`: regístralo como ticket nuevo.
- Falla solo en el nuevo → `REGRESSION`: devuélvelo al autor con su firma exacta.

## Reglas
- Nunca edites código de producto, aserciones ni timeouts.
- Los intentos fallidos se quedan en la evidencia (`.factory/evidence/<ticket>/<sha>/`); nada se sobrescribe.
- El veredicto queda en `.factory/evidence/<ticket>/gate-<sha>.json`; sin PASS ahí, `ledger.mjs ship` se niega.
- Después, pasa a `nokko-walkthrough`.
