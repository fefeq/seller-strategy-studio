# NK-0160 — Detectar títulos y nombres en registros

Estado: En curso. Autorización general de Fede, 13-11-2026.

## Qué y por qué
El escáner existente solo sigue colecciones que contienen `.message`. Una colección alimentada únicamente por `.title` o `.name` puede llegar a consola sin ser detectada. Añadir un escáner complementario basado en AST, ejecutado por una prueba nueva sobre las mismas fuentes de servidor y Sugerencias. No modificar `server-log-scan.test.ts` ni sus expectativas.

## Cambio mínimo
Herramienta local de análisis en scripts, sin entrar en el código servido. Detecta asignaciones, arrays, push, aliases y logs de portadores de título/nombre. Permite contadores `.length`; incluye todos los métodos habituales de consola. El error de Sugerencias ya no registra el objeto: mantenerlo y verificarlo, no rehacerlo.

## Pruebas
Prueba nueva falla primero con colección de títulos, después prueba nombres, alias, propiedades, interpolación y contadores. Guardia nueva recorre fuentes reales sin mostrar su texto (solo ruta y línea). Suite completa antes de la siguiente entrega. Tipos sin comprobar por restricción del entorno; Fede los verifica por lotes.

## Riesgos y vuelta atrás
Análisis estático local, no interprocedimental: no garantiza detectar valores que cruzan funciones o archivos. No afirma auditoría exhaustiva de datos personales. Revertir los dos archivos nuevos elimina el complemento, dejando intacto el escáner protegido. No hay cambio visual ni llamadas reales; navegador no sustituye una prueba de análisis estático.