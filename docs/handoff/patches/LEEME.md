# Parches NOKKO — Olas 1, 2 y 3 (base: main d0e4821)

Cada parche va en su propia rama y su propio PR pequeño. Las ramas ya existen en el clon local con estos nombres.
Los parches 01–07 fueron revisados por un auditor independiente (y sus hallazgos corregidos). Los 08–15 se revisan
en la segunda auditoría independiente (ver `AUDITORIA-2.md` si está incluido).

    git checkout -b fix/f6-create-lead-events main        && git am 01-f6-create-lead-events.patch
    git checkout -b fix/f4-business-day-sla main          && git am 02-f4-business-day-sla.patch
    git checkout -b fix/f2-anti-icp-phrase-match main     && git am 03-f2-anti-icp-clause.patch
    git checkout -b fix/f2b-fit-evidence-floor fix/f2-anti-icp-phrase-match && git am 08-f2b-fit-evidence-floor.patch   # DESPUÉS de F2
    git checkout -b fix/f1b-spend-guard main              && git am 04-f1b-spend-guard.patch
    git checkout -b fix/f1a-default-spend-caps fix/f1b-spend-guard && git am 05-f1a-default-caps.patch                 # DESPUÉS de F1b
    git checkout -b fix/f5-telegram-decide-approval main  && git am 06-f5-telegram-approvals.patch                      # migración 0064
    git checkout -b fix/f3-setup-data-quality main        && git am 07-f3-setup-data-quality.patch
    git checkout -b fix/f7-sales-navigator-import main    && git am 09-f7-sales-navigator-import.patch
    git checkout -b fix/f8-opps-created main              && git am 10-f8-11-opps-created.patch
    git checkout -b feat/f8-number-format-acv main        && git am 11-f8-number-format-acv-ranges.patch
    git checkout -b feat/w2-broad-icp-warning main        && git am 12-w2-5-broad-icp-warning.patch
    git checkout -b feat/w3a-read-tools main              && git am 13-w3a-read-lookup-tools.patch
    git checkout -b feat/w3b-product-stripe-tools feat/w3a-read-tools && git am 14-w3b-product-stripe-write-tools.patch  # DESPUÉS de W3a
    git checkout -b test/w3c-integration-isolation main   && git am 15-w3c-integration-tools-isolation-test.patch

(10 y 11 salieron de una misma rama de trabajo; 11 aplica sobre main sin necesitar 10.)

## Qué hace cada uno

| # | Qué cambia | Para ti |
|---|---|---|
| 01 F6 | `create_lead` por chat lanza los mismos eventos que el resto de entradas (enriquecimiento, seguimiento) | Un lead creado por chat ya se enriquece |
| 02 F4 | Plazos de lead en días laborables; avisos agrupados por responsable cuando son 4 o más | Menos avisos falsos de fin de semana |
| 03 F2 | Anti-ICP por frases, no por palabras sueltas | «Consultoras pequeñas» ya no descarta a todas las consultoras |
| 08 F2b | Con menos de 5 criterios con dato, la puntuación de encaje se acerca al 50 % | Menos 0 % / 100 % por un solo dato |
| 04 F1b | Las herramientas de chat que gastan créditos pasan por un control de gasto | El chat no puede saltarse el tope |
| 05 F1a | Tope por defecto 25 €/mes y 5 €/día en empresas nuevas; las existentes siguen «sin límite» (migración 0065) | Gasto acotado desde el primer día |
| 06 F5 | Decidir aprobaciones desde Telegram, con comprobación de rol en la base (migración 0064) | Telegram deja de fallar al aprobar |
| 07 F3 | «Configuración completa» exige datos útiles, no solo que exista algún registro | El % de arranque deja de mentir |
| 09 F7 | Importación tipo Sales Navigator: URL de perfil y de empresa, Nombre+Apellidos, personas sin email | Tu lista de Sales Navigator ya entra con personas |
| 10 F8-11 | «Oportunidades creadas (N siguen abiertas)» cuenta lo mismo en los dos números | Se acaba el «1 (0 abiertas)» confuso |
| 11 F8-8/5 | Miles con punto desde 1.000 en toda la app; aviso si los rangos de ACV se solapan o dejan huecos | Cifras coherentes |
| 12 W2-5 | Aviso (no bloquea) si el ICP es demasiado abierto | Menos gasto buscando a todo el mundo |
| 13 W3a | Chat: `list_segments`, `list_members`, `list_trials`, `get_link` (solo lectura) | El chat responde sin mandarte a pantallas |
| 14 W3b | Chat: `upsert_product`, `sync_stripe_now` (piden confirmación) | Catálogo y Stripe desde el chat |
| 15 W3c | Test: ninguna herramienta de integración toca ids de otra empresa | Red de seguridad para Telegram/cron |

## Notas técnicas

- F1a lleva la migración 0065 y F5 la 0064. Si `git am` da conflicto en `drizzle/migrations/meta/_journal.json` al aplicar
  el segundo, conserva las dos entradas (0064 con idx 62, 0065 con idx 63).
- 13 y 14 regeneran `.lovable/mcp/manifest.json` (con `sdk_version` 3.1.1 como en main). Si dan conflicto, regenéralo:
  `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y vuelve a poner `sdk_version` a 3.1.1.
- Las migraciones se prueban primero en una rama/copia de la base de datos de NOKKO, nunca en proyectos de Postin.
- `npx vitest run` y `npx tsc --noEmit` pasan en cada rama.

## Lo que NO está hecho y por qué (necesita algo tuyo)

| Pieza | Falta |
|---|---|
| F8-1 contadores «Avisos» vs «Sugerencias» | No son un fallo de código: cuentan cosas distintas (avisos sin leer vs sugerencias pendientes). Hay que decidir si se unifican o se renombran |
| F8-2 dos versiones del informe semanal, F8-4 cuota entre pantallas, F8-6 plantilla ticket bajo, F8-9 borradores del ciclo, F8-10 posicionamiento | Hay que verlo con la cuenta real abierta; sin datos reales no lo reproduzco y no lo toco a ciegas |
| F8-3 preguntas abiertas de la IA fuera de Sugerencias | Es decisión de producto (dónde viven) |
| F8-7 actividad sin toques / resto de F2 | Tu definición de «toque» |
| W2-4 landing y /precios | Los precios. No los invento |
| W2-9 métrica de activación | Tu definición de «cliente activado» |
| W2-2 datos de demo, W2-3 copy de Inicio, W2-8 estados vacíos, W2-6 asistente Stripe/PostHog | Decisiones de copy/diseño; mejor con una revisión visual tuya |
| `invite_member`, `set_member_role` por chat | Decisión de seguridad: cambiar roles o invitar desde Telegram/chat. Mi recomendación: no, solo en pantalla (`get_link` te lleva a Equipo) |
| `qualify_lead`, `undo_last_action`, `enrich_lead` | Ya cubiertos por `update_lead`, `list_recent_changes` + `undo_change` y `complete_account`/`find_key_people` |
| Telegram con acuse inmediato y proceso en segundo plano, WhatsApp | Cambio de arquitectura; propongo hacerlo como SDD aparte |
| Decisiones D1 (Apollo/Clay compartidos), D2 (Apify/LinkedIn), D3 (un solo Drive) | Tuyas |
