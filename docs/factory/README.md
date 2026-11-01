# Software factory de NOKKO

Línea fija que convierte un trigger (bug, feature, alerta) en un release verificado. Adaptación a NOKKO de `grandamenium/agent-software-factory`. Fede aparece dos veces: **GO** para empezar y **aprobación** para entregar.

Entrada: skill `nokko-factory`. Reglas base: `GROUND-RULES.md`.

## Mapa del README original a NOKKO
| Original | En NOKKO | Estado |
|---|---|---|
| 1 Intake, ledger LOGGED→PROMOTED→SHIPPED→VERIFIED | `nokko-intake`, `scripts/factory/ledger.mjs`, `.factory/ledger.json` | Hecho y probado (ID único, duplicados, owner solo con `--go`) |
| 1b Shape (PRD y SDD por niveles; añadido en NOKKO) | `nokko-shape`, `templates/prd.md`, `templates/sdd.md` | Hecho; el ledger enlaza `--sdd` y `--prd` con `ledger.mjs doc` y `promote` exige SDD (y PRD, si está enlazado) en Aprobado; una feature sin SDD no se promueve (pruebas en `src/test/factory-ledger.test.ts`) |
| 2 Brief | `nokko-brief`, `templates/brief.md` | Hecho |
| 3 Fan-out, worktrees, balance por uso, supervisión | `nokko-fanout`, `scripts/factory/worktree.mjs` | Hecho; la supervisión es manual con `list_sessions` (sin tarea programada) |
| 4 Build contra test que falla | `nokko-build`, `scripts/factory/fail-first.mjs`, `templates/result.md` | Hecho |
| 5 Review e integración | `nokko-review` | Hecho (procedimiento, sin script) |
| 6 Gate independiente | `nokko-gate`, `gate.mjs`, `flake.mjs` | Hecho y probado |
| Capa 4 agente usa la app | `nokko-walkthrough` (navegador integrado) | Hecho (procedimiento); sin grabación de frames |
| Capa 5 soak en staging, capa 6 promote con rollback | `nokko-release` | **Parcial:** prepara y verifica, no despliega |
| 7 Vigilancia | `nokko-watch` | Hecho (procedimiento, sin programar) |

## Modelos por tipo de tarea
| Tarea | Modelo | Agente |
|---|---|---|
| Coordinación, review, decisiones de release | El más fuerte, esfuerzo alto | `nokko-reviewer` |
| Arquitectura, RLS, seguridad, concurrencia | El más fuerte | `nokko-author` lanzado con opus |
| Gate y análisis de fallos | Razonamiento fuerte | `nokko-gate` |
| UI, arreglos acotados, infraestructura de tests | Modelo de código fuerte | `nokko-author` (sonnet) |
| Cambios mecánicos, docs, resúmenes de logs | Barato | `nokko-author` lanzado con haiku |
| Triage y ledger | Rápido | `nokko-tracker` (haiku) |

## Qué no existe todavía (brechas declaradas)
1. **Build con red bloqueada:** solo mejor esfuerzo (proxy muerto). Un bloqueo real exige sandbox.
2. **Segunda máquina:** no hay runner. El gate lo informa como «NOT RUN».
3. **Soak de recursos** (descriptores, memoria, reinicios, tiempo de apagado): no se mide; solo se registra el tamaño del artefacto.
4. **Staging, promote a producción y rollback automático:** los hace Fede; la factory no despliega (regla de `docs/sdd/EXECUTION.md`).
5. **Pruebas de navegador con emulación móvil:** no hay Playwright; el recorrido usa el navegador integrado a mano.
6. **Bus de mensajes con verificación de remitente y despertador de sesiones:** sin implementar; se usa `list_sessions` y `SendMessage`.
7. **Lint:** el repo ya arrastra miles de errores de prettier en la base. El gate valida solo los archivos que toca cada cambio.

## Dónde viven los tickets
`.factory/ledger.json` en el **checkout principal** (`seller-strategy-studio`). Todos los worktrees de trabajo leen y escriben ese mismo archivo (lo resuelve `scripts/factory/paths.mjs`), y solo el tracker lo escribe. El ledger se versiona en la rama de referencia; la evidencia (`.factory/evidence/`) no. BMAD (`tickets.toml`, `.bmad/`) está archivado en `docs/archivado/bmad/`; sus 5 tickets de «auditoría técnica» están en el ledger como NK-0001 a NK-0005. Las unidades de trabajo (U-n) viven en cada SDD.

## Uso rápido
```bash
node scripts/factory/ledger.mjs log "<título>" --kind bug
node scripts/factory/ledger.mjs promote NK-0001 --go Fede --owner <sesión> --base <sha>
node scripts/factory/worktree.mjs --ticket NK-0001 --slug <slug> --base <sha>
node scripts/factory/fail-first.mjs --base <sha> --file src/lib/x.test.ts
node scripts/factory/gate.mjs --ticket NK-0001 --base <sha>
node scripts/factory/flake.mjs --ticket NK-0001 --base <sha> --file src/lib/x.test.ts
node scripts/factory/ledger.mjs ship NK-0001 --sha <sha> --approved-by Fede
```
