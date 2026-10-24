# Crear y editar tus empresas en Nokko, sin pasos de más y sin duplicados

## Situación actual
- **Crear** se hace desde dos sitios distintos: el selector de empresa del menú (un cuadrito con nombre y segmentos) y la pantalla «Crea una empresa». Solo se pide el nombre y los segmentos; la moneda, la web y la marca se rellenan después, cada una en una pantalla diferente.
- **Editar** está repartido: el nombre y la marca están en Equipo, la moneda en Estrategia y los segmentos en Configuración. No existe una pantalla «Empresa».
- **Duplicados:** nada avisa si ya tienes una empresa con ese nombre. Hoy tienes «POSTIN», «Postin V2», «Postin OK OK» y «Po». Además, no hay forma de borrar o archivar una empresa.

## Lo que cambia

**1. Un solo «Nueva empresa», con lo necesario de una vez**
- El mismo formulario desde el selector y desde la primera pantalla: nombre, web (opcional), moneda y segmentos para empezar.
- Mientras escribes, Nokko te avisa si ya tienes una empresa parecida, por nombre o por web: «Ya tienes "Postin OK OK". ¿Entrar en ella o crear otra igualmente?».
- Al crearla entras directamente en el Onboarding. Si diste la web, la lectura empieza con ella, sin volver a pedírtela.

**2. Una pantalla «Empresa» en Ajustes**
- En un solo sitio: nombre en Nokko, nombre de marca para documentos, web y moneda (con el aviso de que cambiar la moneda cambia la etiqueta y no convierte las cifras).
- Enlaces directos a Segmentos, Equipo y Onboarding.
- Desde el selector de empresa: «Ajustes de esta empresa».
- Equipo deja de tener los campos de nombre. Solo el Owner y el Sales Leader editan; los demás lo ven en modo lectura.

**3. Archivar y borrar (solo el Owner)**
- **Archivar:** la empresa desaparece del selector y de los trabajos automáticos (búsquedas, emails, piloto automático), pero se puede recuperar.
- **Borrar:** pide escribir el nombre de la empresa para confirmar, y avisa de todo lo que se elimina.
- En el selector, una sección «Archivadas» para recuperarlas.

**4. Limpiar tus duplicados**
- Al terminar te enseño tus empresas parecidas (los Postin y «Po») con lo que tiene cada una (cuentas, leads, deals). Tú decides cuáles archivar o borrar; no toco ninguna sin tu respuesta.

## Detalles técnicos
- Nueva columna `organizations.website` y `organizations.archived_at`. Un RPC `create_organization` amplía sus parámetros (web, moneda) sin romper las llamadas existentes; el aviso de duplicados usa las reglas ya testeadas de `src/lib/match.ts` sobre `me.memberships`.
- `archive_organization` / `delete_organization`: RPC security definer con comprobación `has_org_role(org, 'owner')`. Antes de habilitar el borrado se verifican las claves foráneas hacia `organizations` (borrado en cascada de los datos de esa empresa); las que falten se añaden en la misma migración. Hoy la tabla solo tiene políticas de lectura y edición.
- Los trabajos automáticos (cron horario, Descubiertos, piloto automático, email diario, informe semanal) se saltan las empresas archivadas; el selector y `useMe` también.
- Nueva ruta `/_authenticated/company` con `head()` propio y entrada en el bloque Ajustes del menú; el formulario de creación será un componente compartido (`src/components/org-create.tsx`).
- Tests: regla de duplicado de empresa, que una archivada no reciba trabajo automático, y que solo el Owner pueda archivar o borrar.
