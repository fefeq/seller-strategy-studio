# NK-0177 — Reglas base solo del equipo

Estado: En curso. Autorización general de Fede del 13-11-2026.

## Qué y por qué
El comportamiento ya filtra scope en memoria: una regla personal no reemplaza una regla base de equipo. Completar el filtro en la consulta real para que no entren documentos personales ni consuman la ventana de resultados antes del filtro local. Ambos consumidores, añadir reglas y diagnosticar, usan readTitles.

## Cambio y pruebas
Añadir `eq("scope", "team")` a la consulta, conservando filtro local y contrato de errores. Prueba nueva primero exige filtro de scope y comprueba que nueve reglas personales no impiden crear nueve reglas de equipo. Pruebas protegidas intactas. Mantener «Ya tenías todas las reglas base.»: es cierta solo si existen todas las reglas de equipo, y su expectativa está protegida; no cambiar ese texto.

## Riesgos, comprobación y vuelta atrás
No migración ni cambio visual. Prueba de núcleo con cliente simulado, suite completa, compilación automática. Tipos sin comprobar por restricción del entorno; Fede verifica por lotes. No conversación IA real ni escritura de reglas de una empresa real. Revertir el filtro devuelve la consulta anterior, manteniendo el filtro en memoria. Revisión independiente pendiente.