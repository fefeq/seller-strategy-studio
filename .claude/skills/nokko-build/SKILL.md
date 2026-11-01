---
name: nokko-build
description: Estación 4 de la factory NOKKO y capa 1 de verificación (prueba de autor). Implementa un brief en su worktree escribiendo primero el test que falla. Úsala dentro de la sesión de código de un trabajo.
---

# Build contra un test que falla

Trabajas solo en tu worktree y rama, desde el commit base del brief. Lee `docs/factory/GROUND-RULES.md`, `AGENTS.md` y `src/lib/AGENTS.md`.

## Orden
1. **Test primero.** Escríbelo y pruébalo sobre la base:
   ```bash
   node scripts/factory/fail-first.mjs --base <sha base> --file <archivo del test>
   ```
   Si dice «NOT PROVEN», el test no vale: corrígelo.
2. Implementa lo mínimo. Reglas puras en módulos con prueba, como pide `docs/sdd/EXECUTION.md`.
3. **Pasa:** `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` en verde.
4. **Comprobación de mutación:** quita la guarda que añadiste y confirma que los tests se ponen en rojo. Restaura.
5. **Mide la salida real, no un proxy.** Si guarda un dato, léelo de vuelta. Si hay UI, comprueba móvil (375) y escritorio, claro y oscuro.
6. **Source guards:** si el cambio introduce una regla («nunca X en el código»), añade un test que falle si X aparece.
7. **Fixtures aisladas:** datos ficticios, sin claves reales, nada de producción.
8. Commits pequeños en inglés citando SDD y unidad (formato de `git log`). Sin push.
9. Entrega: rellena `docs/factory/templates/result.md` en `.factory/evidence/<ticket>/result.md` con rutas de evidencia y **lo que no se afirma**.

## Prohibido
Debilitar aserciones, alargar timeouts, `.skip`/`.only`, desplegar, push, tocar producción, ampliar alcance, secretos en `.env`.
