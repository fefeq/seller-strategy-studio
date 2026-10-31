---
name: nokko-review
description: Estación 5 de la factory NOKKO y capa 2. Lee el diff (no el resumen) de cada trabajo entregado y lo integra como un commit revertible en una única rama de integración. Úsala cuando una sesión entregue su paquete de resultado.
---

# Review e integración

## Revisión del diff (lee código, no el resumen)
- **Base:** confirma que el commit base es el del brief y que cada afirmación del resultado apunta a un archivo de evidencia real.
- **Auth y multitenencia:** en cada ruta, función de servidor o tabla nueva: RLS con `org_id` por defecto `current_org()`, solo el Owner gestiona miembros, GRANTs en migraciones.
- **Entradas y rutas:** validación de entrada, nada de rutas ni SQL construidos con texto del usuario.
- **Renderizado:** nada de HTML sin sanear.
- **Dependencias nuevas:** no se instalan proveedores ni paquetes sin que el brief lo diga.
- **Reglas de `AGENTS.md`:** sin `as any`, sin `window.confirm/prompt`, errores por `errorText()`, colores por tokens, `.env` intacto, dinero con `useCurrency()`.
- **Datos:** ningún dato de clientes en código, tests ni fixtures.
- **Aserciones y timeouts:** ninguna debilitada ni alargada.

## Integración
1. Una rama de integración (`integration/<fecha>`), desde el commit base común.
2. Fusiona **cada trabajo como su propio commit de merge** (`git merge --no-ff`), para poder revertir cualquiera por separado.
3. Tras cada merge, `npx tsc --noEmit` y `npx vitest run`. Un conflicto entre trabajos se devuelve a su autor, no se resuelve a ojo.
4. Nada de push, `reset --hard` ni force push.

## Resultado
Devuelve al autor lo que falle, con firma exacta. Si todo pasa, pide el gate (`nokko-gate`). Usa el agente `nokko-reviewer`.
