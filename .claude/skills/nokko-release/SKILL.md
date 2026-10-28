---
name: nokko-release
description: Estación 6 (staging, soak y entrega) de la factory NOKKO. Prepara el mensaje único para Fede (qué cambió, qué pasó, ¿listo para entregar?) y registra la entrega solo tras su aprobación. Úsala cuando el gate y el walkthrough estén en verde.
---

# Staging, soak y entrega

## Preproducción
En NOKKO la app va por Lovable Cloud y el despliegue lo hace Fede. Esta estación **no despliega**. Prepara la entrega para que él la haga y verifica lo que se pueda leer.

1. Confirma que el commit a entregar es exactamente el del gate: `git rev-parse HEAD` igual a `gate-<sha>.json` con `PASS`.
2. Si hay migraciones (`drizzle/migrations`), sigue `APLICAR-MIGRACIONES-GUIA.md` y `PLAN-orden-migraciones.md`, y ejecuta `node check-migration-journal.mjs`. Las migraciones las aplica Fede.
3. Tras su despliegue a preproducción: comprueba, solo lectura, que corre el commit esperado y que hay cero errores durante el soak (con `mcp__f6237d78-…__get_advisors` y `query_logs` de Supabase si están conectados). Si no puedes medirlo, di «sin medir».

## Mensaje único a Fede
- **Qué cambió** (una línea por ticket, con ID).
- **Qué pasó:** veredicto del gate, walkthrough, flakes registrados, lo que **no** se ejecutó (segunda máquina, soak de recursos).
- **Riesgos y migraciones.**
- **«¿Listo para entregar?»**

## Tras su aprobación explícita
```bash
node scripts/factory/ledger.mjs ship NK-xxxx --sha <sha> --approved-by Fede
```
El script se niega si no hay gate PASS para ese commit. La promoción a producción y el rollback los ejecuta Fede, con el commit anterior listo. Esta factory no ejecuta ni arma el rollback automático: es una brecha declarada (ver `docs/factory/README.md`).
