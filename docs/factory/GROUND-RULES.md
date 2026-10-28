# Reglas base de la factory (capa 0)

Aplican a cada sesión y a cada turno, de cualquier rol. Todos los skills y agentes de la factory las leen primero.

1. **Verifica antes de afirmar.** Si no lo has comprobado con una herramienta, dilo y compruébalo.
2. **Declara supuestos** antes de un cambio no trivial. Haz el cambio más pequeño que resuelva el problema.
3. **Retráctate al instante** si te equivocas. No defiendas una afirmación errónea.
4. **El autor nunca califica su propio trabajo.** El gate no escribió el código que prueba.
5. **Un test cuenta solo si falla antes** sobre el commit base.
6. **El gate se adapta, nunca se afloja.** Puede añadir comprobaciones; nunca quitar una, debilitar una aserción, alargar un timeout ni añadir excepciones para pasar.
7. **Cada cifra apunta a un archivo de evidencia**, y cada informe lista lo que no demuestra.
8. **Paralelo, nunca compartido.** Un worktree, una rama y un contexto por sesión. Contrato escrito antes de que dos sesiones toquen una misma interfaz.
9. **Humanos deciden dirección:** qué construir y cuándo entregar. Dos momentos: GO y aprobación de entrega.

## Reglas de NOKKO que se suman (de `AGENTS.md` y `docs/sdd/EXECUTION.md`)

- Nunca push ni merge a `main`/`production`, nunca desplegar ni tocar producción, salvo que Fede lo ordene en el chat para esa acción.
- Nunca `reset --hard`, force push ni reescribir historial publicado (rama conectada a Lovable).
- Ningún dato de clientes en código, tests, fixtures, logs ni evidencias. Datos ficticios.
- Nunca inventar ni estimar cifras. Si falta, «sin dato».
- Nunca secretos en `.env` ni en variables `VITE_`.
- Textos de producto en español, «tú». Código, identificadores y commits en inglés.
