# GTM Brain: hub de conocimiento + CRM de leads

Una sola app para el equipo comercial, basada en el sistema descrito en el texto.

## 1. Landing pública (/)
- Explica el sistema en 6 pasos: cerebro GTM, responsable, reps, skills personales, base de personas, CRM automático.
- Botón "Entrar" hacia el login.

## 2. Acceso por rep
- Login con email y contraseña.
- Perfil con nombre y rol: **owner** (responsable) o **rep**.
- Los reps no pueden borrar registros; cada registro guarda quién lo creó o editó.

## 3. Hub de conocimiento (/hub)
Secciones como pestañas, cada una con lista + editor de texto:
- Empresa (servicios, ICP, ofertas, precios, objeciones)
- Llamadas (resumen de cada llamada, vinculada a una cuenta)
- Cuentas (una ficha por cliente: qué se dijo, próximos pasos)
- Campañas (lista, copy, reuniones conseguidas)
- Playbooks (prospección, seguimiento, demo, traspaso)
- Skills (de equipo y personales; el owner puede "promover" una personal a equipo)
- Reglas (lo que los agentes no pueden hacer sin una persona)

## 4. CRM de personas (/people)
- Tabla única: una fila por persona, sin duplicados por email o URL de LinkedIn.
- Fuente (lista fría, interacción con post, visita web), tier, etapa de secuencia, etapa CRM.
- Historial de resultados de campaña por persona (enviado, respondió, reunión...).
- Filtros rápidos, p. ej. "respondió y no reservó".
- Importación por CSV que omite duplicados y avisa cuántos se saltaron.

## 5. Bandeja de aprobaciones (/approvals)
- Cambios importantes propuestos (mover etapa, fusionar duplicados) con su evidencia.
- Botones Aplicar / Omitir; solo owner aplica.

## Fuera de alcance (por ahora)
Sincronización real con GitHub, Fireflies, Attio o Slack y agentes automáticos: se pueden conectar después.

## Detalles técnicos
- Lovable Cloud: auth email/contraseña, tablas `profiles`, `user_roles` (enum owner/rep, `has_role`), `knowledge_docs` (section, title, body, scope team/personal, owner_id), `accounts`, `calls`, `campaigns`, `people` (unique índices en lower(email) y linkedin_url normalizada), `campaign_results`, `approvals`.
- RLS: autenticados leen todo; insertan/actualizan con `created_by/updated_by = auth.uid()`; DELETE solo owner; skills personales solo visibles para su autor.
- Rutas protegidas bajo `_authenticated`; diseño sobrio tipo herramienta interna con tipografía propia.
- Tests para la regla de deduplicación del importador CSV.
