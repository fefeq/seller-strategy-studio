# Segunda auditoría independiente (parches 07–15)

Sin críticos. Tests y `tsc` en verde en todas las ramas. Sin fugas entre empresas en el código nuevo.

## Corregido tras la auditoría
- F2b: una sola pista de peso 2 llegaba a 70 («alto»); ahora queda en 69 (y 31 por abajo) mientras haya menos de 3 de peso.
- F7: dos personas con el mismo nombre y perfiles distintos ya no se fusionan; los acentos y mayúsculas no cuentan al casar nombres; perfil guardado con barra final se encuentra; la misma persona en otra empresa genera lead en la nueva sin tocar el de la vieja; reimportar sin etapa ya no devuelve a «new» a la persona; una fila con solo perfil crea persona. Tests nuevos.
- F8-5: los rangos de ACV se comparan con el techo acumulado (un rango ancho que contiene a otros ya no se lee como «hueco»).
- F8-11: «1 sigue abierta» en singular.
- W2-5: «todo en uno» ya no cuenta como «todos los sectores»; el aviso solo sale con 2 o más puntos.
- W3a: `list_members` no duplica a quien tiene dos roles.
- W3b: renombrar un producto a un nombre ya usado se rechaza; comparación exacta en código (un `*` no es comodín); el cobro es obligatorio al crear; la confirmación de una actualización dice qué cambia; el test de Stripe comprueba el filtro por empresa.

## No corregido (menores, anotados)
- `numbersIn("0.500")` lee 500.
- Quedan `toLocaleString("es-ES")` sin migrar a `formatNumber` en otras pantallas.
- F3: con cuentas incompletas el asistente aún muestra «añadir cuenta» en vez de guiar a completarlas (UX).
- `list_trials` devuelve emails a cualquier rol (igual que `list_people`): decide si lo limitas.
- `get_link` casa por coincidencia aproximada; texto muy corto puede resolver a la primera pantalla que lo contenga.
- La cobertura del test de aislamiento es por prefijo de nombre: no incluye `research_stakeholder`, `get_product_usage`, `prepare_meeting_brief`, `draft_*`.
- URLs `/sales/lead/…` se guardan tal cual como perfil (no son públicas y su sufijo puede cambiar; el respaldo por nombre lo mitiga).

## No verificado
Restricciones reales de la base (unicidad de `products.name`), políticas RLS reales y CSV reales de Sales Navigator (solo cabeceras sintéticas).
