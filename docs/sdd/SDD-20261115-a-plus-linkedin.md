# SDD A+ — LinkedIn al máximo (lectura pública por robots)

Estado: Aprobado por delegación general de Fede, 15-nov-2026.

## Inventario (antes de esta pieza)
| Qué | Robot Apify | Herramienta agente | Pantalla | Plays |
|---|---|---|---|---|
| Publicaciones de empresa | harvestapi~linkedin-company-posts | linkedin_company_posts | señales | R-1 (vía señales) |
| Publicaciones de persona | harvestapi~linkedin-profile-posts | linkedin_profile_posts | — | — |
| Ofertas de empleo | valig~linkedin-jobs-scraper | company_job_postings | Ficha cuenta | señales |
| Cambios de cargo | — | — | — | — |
| Señales de crecimiento | — (solo ofertas en bruto) | — | — | — |
| Engagement | `likes` leído y sin usar | — | — | — |
Huecos de gasto: las lecturas de LinkedIn no se apuntaban al presupuesto de la empresa.

## Cambios (por valor)
1. Toda lectura de LinkedIn (manual o automática) se apunta al libro de gasto de la empresa con coste «sin dato».
2. Engagement de publicaciones (empresa y persona): media de me gusta solo sobre valores medidos; sin medida = sin dato.
3. Señales de crecimiento desde ofertas: equipos que contratan y perfiles directivos; sin ofertas = sin titular.
4. Cambios de cargo: robot verificado `harvestapi~linkedin-profile-scraper` (0,004 $/perfil, catálogo Apify 15-nov-2026), herramienta `linkedin_role_check` y botón «Comprobar cargo» en la persona. Solo lee; actualizar la ficha requiere Guardar o una escritura confirmada.
Todas son lecturas con gasto: confirmación con coste aprox. (mediana medida o «sin dato»).

## Fuera (pendiente)
Comentarios y reacciones (`harvestapi~linkedin-profile-comments/-reactions` existen) y búsqueda de perfiles: siguiente iteración.

## Criterios con prueba
`src/lib/linkedin-insights.test.ts` (crecimiento, engagement, cargo, null ≠ 0), `decide-suggestion-spend.test.ts`. Reversión: quitar herramienta/botón; no hay migración.
