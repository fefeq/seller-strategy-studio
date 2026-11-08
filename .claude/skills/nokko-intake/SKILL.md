---
name: nokko-intake
description: Estación 1 de la factory NOKKO. Registra bugs, features y alertas en el ledger con ID único y detección de duplicados. Úsala al recibir un reporte antes de cualquier trabajo. Registrar no es despachar.
---

# Intake y triage

Un solo escritor del ledger: `scripts/factory/ledger.mjs` (archivo `.factory/ledger.json`). Estados: `LOGGED → PROMOTED → SHIPPED → VERIFIED`, o `LOGGED → REJECTED` si Fede decide que el reporte no es válido: `node scripts/factory/ledger.mjs reject NK-xxxx --by Fede --note "<por qué, con evidencia>"` (solo desde `LOGGED` y solo con su decisión explícita en el chat).

## Pasos
1. Reformula el reporte en una línea clara en español, sin datos de clientes (ni nombres, ni emails, ni textos suyos).
2. Registra:
   ```bash
   node scripts/factory/ledger.mjs log "<título>" --kind bug|feature|alert --source "<dónde llegó>" [--sdd docs/sdd/<archivo>.md] [--prd docs/prd/<archivo>.md]
   ```
   Si el SDD o el PRD se escriben después (estación `nokko-shape`), enlázalos con `node scripts/factory/ledger.mjs doc NK-xxxx --sdd <ruta> [--prd <ruta>]`.
3. Si dice «DUPLICATE of NK-xxxx», enlaza en vez de duplicar y avisa a Fede. No lo despaches.
4. Informa a Fede del ID y pregunta si da GO. **Sin GO no hay owner.**
5. Con GO explícito en el chat:
   ```bash
   node scripts/factory/ledger.mjs promote NK-xxxx --go Fede --owner <sesión> --base <sha> --branch feat/<slug>
   ```

## Reglas
- Una feature o un bug que toque código o datos debe tener su SDD (`docs/sdd/`). Si no existe, dilo y pásalo a `nokko-shape` antes de promover.
- Nunca promuevas por tu cuenta. Nunca estimes prioridad con cifras inventadas.
