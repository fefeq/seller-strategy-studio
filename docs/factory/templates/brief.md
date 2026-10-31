# Brief · {ticket id} · {título}

- **Ticket:** {NK-0000} (estado PROMOTED, GO de {humano})
- **SDD:** {ruta del SDD y unidades U-n}
- **Commit base exacto:** `{sha}`  (rama desde ahí: `feat/{slug}`)
- **Worktree:** `../seller-strategy-studio-{slug}`
- **Modelo y esfuerzo:** {según tabla de docs/factory/README.md}

## Checks de aceptación
- [ ] CA-1 …  → prueba: `{archivo}`
- [ ] CA-2 …

## Test que debe fallar primero
`{archivo del test}`: debe fallar sobre `{sha}` (se prueba con `scripts/factory/fail-first.mjs`).

## Contrato (solo si dos sesiones construyen dos mitades)
{Contrato de API escrito y acordado antes de escribir código. Si no aplica: «No aplica».}

## Movimientos prohibidos
- Debilitar aserciones, alargar timeouts, `.skip`/`.only`.
- Desplegar, hacer push o merge, tocar producción.
- `as any`, `window.confirm/prompt`, secretos en `.env` o `VITE_`.
- Cambiar migraciones ya aplicadas; tocar datos reales.
- Ampliar alcance más allá de «No incluye» del SDD.

## Entrega esperada (paquete de resultado)
Rama, commit final, lista de commits, números medidos, rutas de evidencia y **lista de lo que NO se afirma** (plantilla `docs/factory/templates/result.md`).
