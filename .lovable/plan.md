# Experto UX/UI para SaaS B2B: auditar, proponer en SDD y construir

Una habilidad reutilizable en cualquier proyecto SaaS B2B. Se activa al pedir «audita la UX», «revisa la UI», «mejora la experiencia» o «propón mejoras de diseño». Recorre la app como un usuario real, entrega un documento SDD con las mejoras ordenadas por prioridad y, cuando lo apruebas, las construye.

## Nombre y cuándo se activa
- **Nombre:** `b2b-saas-ux-expert`
- **Se activa con:** auditoría UX/UI, revisión de usabilidad o accesibilidad, fricción en onboarding, «la app es confusa», propuesta de rediseño, SDD de mejoras de diseño.

## Cómo trabaja (en orden)
1. **Contexto:** lee el sistema de diseño del proyecto, sus reglas guardadas, los roles, las pantallas y el idioma. Usa siempre el diseño de cada proyecto y no impone uno propio.
2. **Recorrido real:** inicia sesión en la vista previa y prueba los flujos principales (primer uso, tarea diaria, crear, editar, borrar, errores, vacíos) en escritorio y en móvil. Saca una captura de cada hallazgo.
3. **Lectura del código:** revisa pantallas y componentes en busca de inconsistencias, textos, estados que faltan (cargando, vacío, error, sin permiso) y reglas del sistema de diseño que se incumplen.
4. **Accesibilidad:** contraste, teclado, foco, nombres de botones, tamaño para tocar, un solo contenido principal por página.
5. **Datos de uso:** si hay analítica, usa páginas, abandonos y dispositivos para priorizar. Si no la hay, lo indica y prioriza sin ella.
6. **SDD:** escribe el documento (ver formato) y lo presenta para aprobar.
7. **Construir:** cuando apruebas, implementa por prioridad, comprueba cada mejora con capturas antes y después, y mantiene las pruebas en verde. Antes de tocar reglas de negocio pide permiso.

## Lente B2B SaaS (lo que un experto genérico pasa por alto)
- Tiempo hasta el primer valor y onboarding por rol (quien compra, quien administra, quien usa a diario).
- Densidad de información en tablas, filtros guardados, acciones masivas, atajos de teclado.
- Permisos visibles: qué ve y qué puede hacer cada rol, y por qué un botón está bloqueado.
- Multiempresa: saber siempre en qué empresa estás, sin mezclar datos.
- Estados vacíos que enseñan el siguiente paso; errores con «qué pasó y qué hacer».
- Confianza: deshacer, confirmaciones proporcionales al riesgo, historial y origen de los datos.
- Navegación agrupada por trabajo, no por funcionalidad; móvil para consultar y decidir.

## Formato del SDD
Para cada hallazgo:
- **Problema:** qué le pasa al usuario, en qué pantalla, con captura y a quién afecta.
- **Impacto, esfuerzo y prioridad:** P0 bloquea, P1 frena, P2 pule.
- **Propuesta:** el cambio y el criterio de aceptación comprobable.
- **Riesgo:** si cambia una regla de negocio o datos, se marca para decidir.

Cierre: hoja de ruta por fases y lo que no se pudo comprobar.

## Detalles técnicos
- La habilidad se guarda como borrador y se activa. Contiene `SKILL.md`, con el flujo y la lente B2B, y `references/sdd-template.md`, con la plantilla del documento. Se escribe en inglés para que funcione en cualquier proyecto, y el SDD se entrega en el idioma del usuario.
- Para el recorrido usa el inicio de sesión de la vista previa y Playwright: 1280px en escritorio y 390px en móvil.
- El SDD se guarda en `.lovable/plan.md` para que lo apruebes; las capturas, en `/tmp`.
- No duplica reglas que ya están en la plataforma (accesibilidad básica de shadcn, tokens de diseño): solo las referencia.
